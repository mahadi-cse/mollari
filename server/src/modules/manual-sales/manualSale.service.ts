import { Prisma } from '@prisma/client';
import { prisma } from '../../config/database';
import { ConflictError, NotFoundError } from '../../shared/utils/AppError';
import { parsePagination } from '../../shared/utils/pagination';
import { CreateManualSaleInput } from './manualSale.schema';
import { cacheInvalidatePattern } from '../../shared/utils/cache';

const toNumber = (value: Prisma.Decimal | number | string) => Number(value);

export class ManualSaleService {
  async createManualSale(data: CreateManualSaleInput) {
    if (!data.branchId) {
      throw new ConflictError('Branch is required to record a sale');
    }
    const productIds = data.items.map((i) => i.productId);
    const uniqueProductIds = [...new Set(productIds)];

    return prisma.$transaction(async (tx) => {
      const products = await tx.product.findMany({
        where: { id: { in: uniqueProductIds } },
        include: {
          inventories: {
            where: { warehouseId: data.branchId },
          },
          sizes: {
            where: { isActive: true },
          },
          colors: {
            where: { isActive: true },
            include: {
              sizes: { where: { isActive: true } },
            },
          },
        },
      });

      if (products.length !== uniqueProductIds.length) {
        throw new NotFoundError('One or more products were not found');
      }

      const productMap = new Map(products.map((p) => [p.id, p]));
      const productQtyMap = data.items.reduce<Record<number, number>>((acc, item) => {
        acc[item.productId] = (acc[item.productId] || 0) + item.quantity;
        return acc;
      }, {});

      for (const [productIdStr, requestedQty] of Object.entries(productQtyMap)) {
        const productId = Number(productIdStr);
        const product = productMap.get(productId);
        const inventory = product?.inventories[0];
        if (!inventory) {
          throw new ConflictError(`Product ${product?.name || productId} is not stocked in this branch`);
        }
        if (inventory.quantity < requestedQty) {
          throw new ConflictError(`Insufficient stock for product ${product.name}`);
        }
      }

      const lineItems = data.items.map((item) => {
        const product = productMap.get(item.productId)!;
        const matchedColor = item.colorName
          ? product.colors?.find((c) => c.name === item.colorName)
          : null;
        const matchedSize = item.sizeName
          ? (matchedColor?.sizes?.find((s) => s.name === item.sizeName) || product.sizes?.find((s) => s.name === item.sizeName))
          : null;

        const unitPrice = item.unitPrice && item.unitPrice > 0
          ? item.unitPrice
          : matchedSize && matchedSize.priceOverride !== null
            ? toNumber(matchedSize.priceOverride)
            : matchedColor && matchedColor.priceOverride !== null
              ? toNumber(matchedColor.priceOverride)
              : toNumber(product.price);

        const costPrice = matchedSize && matchedSize.costPriceOverride !== null
          ? toNumber(matchedSize.costPriceOverride)
          : matchedColor && matchedColor.costPriceOverride !== null
            ? toNumber(matchedColor.costPriceOverride)
            : product.costPrice !== null
              ? toNumber(product.costPrice)
              : null;

        const lineTotal = unitPrice * item.quantity;
        return {
          productId: product.id,
          productNameSnapshot: product.name,
          productSkuSnapshot: product.sku,
          quantity: item.quantity,
          unitPrice,
          lineTotal,
          costPrice,
          sizeName: item.sizeName || null,
          colorName: item.colorName || null,
        };
      });

      const totalQty = lineItems.reduce((sum, item) => sum + item.quantity, 0);
      const totalAmount = lineItems.reduce((sum, item) => sum + item.lineTotal, 0);

      // Get branch details to find the branchCode
      const branch = await tx.branch.findUnique({
        where: { id: data.branchId },
      });
      const branchCode = branch?.branchCode ? branch.branchCode.toUpperCase() : 'HQ';

      const today = new Date();
      const yy = String(today.getFullYear()).slice(-2);
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const dd = String(today.getDate()).padStart(2, '0');
      const dateStr = `${yy}${mm}${dd}`;

      // Start & end of today in local system time (for daily count reset)
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0);
      const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);

      // Count sales for this branch today
      const dailyCount = await tx.manualSale.count({
        where: {
          branchId: data.branchId,
          createdAt: {
            gte: startOfDay,
            lte: endOfDay,
          },
        },
      });

      const sequence = String(dailyCount + 1).padStart(4, '0');
      const saleNumber = `${branchCode}-${dateStr}-${sequence}`;

      let resolvedSoldBy = data.soldBy || 'Staff';
      if (resolvedSoldBy.includes('@')) {
        const u = await tx.user.findUnique({
          where: { email: resolvedSoldBy.toLowerCase().trim() },
          select: { firstName: true, lastName: true },
        });
        if (u) {
          const fullName = `${u.firstName || ''} ${u.lastName || ''}`.trim();
          if (fullName) resolvedSoldBy = fullName;
        }
      }

      const sale = await tx.manualSale.create({
        data: {
          saleNumber,
          totalAmount,
          totalQty,
          branchId: data.branchId,
          branchName: data.branchName,
          note: data.note,
          soldBy: resolvedSoldBy,
          items: {
            create: lineItems.map((item) => ({
              productId: item.productId,
              productNameSnapshot: item.productNameSnapshot,
              productSkuSnapshot: item.productSkuSnapshot,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              lineTotal: item.lineTotal,
              costPrice: item.costPrice,
              sizeName: item.sizeName,
              colorName: item.colorName,
            })),
          },
        },
        include: { items: true },
      });

      for (const [productIdStr, requestedQty] of Object.entries(productQtyMap)) {
        const productId = Number(productIdStr);
        const product = productMap.get(productId)!;
        
        // Lock inventory record
        const lockedRows = await tx.$queryRaw<any[]>`
          SELECT * FROM inventory 
          WHERE "productId" = ${productId} AND "warehouseId" = ${data.branchId}
          FOR UPDATE
        `;
        const inventory = lockedRows[0];
        
        if (!inventory) throw new ConflictError(`Inventory record vanished for product ${product.name}`);
        if (inventory.quantity < requestedQty) {
          throw new ConflictError(`Insufficient stock for product ${product.name} (Available: ${inventory.quantity})`);
        }

        const beforeQty = inventory.quantity;
        const afterQty = beforeQty - requestedQty;

        await tx.inventory.update({
          where: { id: inventory.id },
          data: { quantity: { decrement: requestedQty } },
        });

        const productItems = lineItems.filter((i) => i.productId === productId);
        let runningBalance = beforeQty;
        for (const pItem of productItems) {
          const itemBefore = runningBalance;
          const itemAfter = itemBefore - pItem.quantity;
          runningBalance = itemAfter;
          await tx.inventoryTransaction.create({
            data: {
              inventoryId: inventory.id,
              type: 'POS_SALE',
              quantity: -pItem.quantity,
              balanceBefore: itemBefore,
              balanceAfter: itemAfter,
              reference: saleNumber,
              notes: `Manual sale recorded (${saleNumber})`,
              sizeName: pItem.sizeName || null,
              colorName: pItem.colorName || null,
              performedBy: resolvedSoldBy,
            },
          });
        }
      }

      // Validate and decrement variant quantity (color and/or size) for items sold
      for (const item of lineItems) {
        if (item.colorName && item.sizeName) {
          const colorRecord = await tx.productColor.findFirst({
            where: { productId: item.productId, name: item.colorName },
            include: { sizes: true },
          });
          const sizeRecord = colorRecord?.sizes.find((s) => s.name === item.sizeName);
          if (sizeRecord && sizeRecord.quantity < item.quantity) {
            throw new ConflictError(
              `Insufficient stock for ${item.productNameSnapshot} (Color: ${item.colorName}, Size: ${item.sizeName}). Available: ${sizeRecord.quantity}, requested: ${item.quantity}`
            );
          }
          if (sizeRecord) {
            await tx.productSize.update({
              where: { id: sizeRecord.id },
              data: { quantity: { decrement: item.quantity } },
            });
          }
        } else if (item.colorName) {
          const colorRecord = await tx.productColor.findFirst({
            where: { productId: item.productId, name: item.colorName },
          });
          if (colorRecord && colorRecord.quantity < item.quantity) {
            throw new ConflictError(
              `Insufficient stock for ${item.productNameSnapshot} (Color: ${item.colorName}). Available: ${colorRecord.quantity}, requested: ${item.quantity}`
            );
          }
          if (colorRecord) {
            await tx.productColor.update({
              where: { id: colorRecord.id },
              data: { quantity: { decrement: item.quantity } },
            });
          }
        } else if (item.sizeName) {
          const productSize = await tx.productSize.findFirst({
            where: { productId: item.productId, name: item.sizeName },
          });
          if (productSize && productSize.quantity < item.quantity) {
            throw new ConflictError(
              `Insufficient stock for ${item.productNameSnapshot} (Size: ${item.sizeName}). Available: ${productSize.quantity}, requested: ${item.quantity}`
            );
          }
          if (productSize) {
            await tx.productSize.update({
              where: { id: productSize.id },
              data: { quantity: { decrement: item.quantity } },
            });
          }
        }
      }

      return {
        id: sale.id,
        saleNumber: sale.saleNumber,
        totalQty: sale.totalQty,
        totalAmount: toNumber(sale.totalAmount),
        branchId: sale.branchId,
        branchName: sale.branchName,
        soldBy: sale.soldBy,
        note: sale.note,
        createdAt: sale.createdAt,
        items: sale.items.map((item) => ({
          id: item.id,
          productId: item.productId,
          productNameSnapshot: item.productNameSnapshot,
          productSkuSnapshot: item.productSkuSnapshot,
          quantity: item.quantity,
          unitPrice: toNumber(item.unitPrice),
          lineTotal: toNumber(item.lineTotal),
          sizeName: item.sizeName,
          colorName: item.colorName,
        })),
      };
    }).then(async (result) => {
      // Bust overview & inventory analytics caches and product list caches
      // so the dashboard overview and products reflect this sale immediately.
      await Promise.all([
        cacheInvalidatePattern('analytics:overview:*'),
        cacheInvalidatePattern('products:list:*'),
        cacheInvalidatePattern('products:slug:*'),
      ]);
      return result;
    });
  }

  async listManualSales(filters: {
    page?: number;
    limit?: number;
    search?: string;
    sortBy?: 'createdAt' | 'totalAmount' | 'totalQty' | 'saleNumber';
    sortOrder?: 'asc' | 'desc';
  }) {
    const { page = 1, limit = 20, search, sortBy = 'createdAt', sortOrder = 'desc' } = filters;
    const { skip, take } = parsePagination({ page, limit });
    const where: Prisma.ManualSaleWhereInput = search
      ? {
          OR: [
            { saleNumber: { contains: search, mode: 'insensitive' } },
            { branchName: { contains: search, mode: 'insensitive' } },
            { soldBy: { contains: search, mode: 'insensitive' } },
            { note: { contains: search, mode: 'insensitive' } },
            {
              items: {
                some: {
                  OR: [
                    { productNameSnapshot: { contains: search, mode: 'insensitive' } },
                    { productSkuSnapshot: { contains: search, mode: 'insensitive' } },
                    { sizeName: { contains: search, mode: 'insensitive' } },
                    { colorName: { contains: search, mode: 'insensitive' } },
                  ],
                },
              },
            },
          ],
        }
      : {};
    const orderBy: Prisma.ManualSaleOrderByWithRelationInput = { [sortBy]: sortOrder };

    const [sales, total] = await Promise.all([
      prisma.manualSale.findMany({
        where,
        skip,
        take,
        orderBy,
        include: { items: true },
      }),
      prisma.manualSale.count({ where }),
    ]);

    return {
      data: sales.map((sale) => ({
        id: sale.id,
        saleNumber: sale.saleNumber,
        totalQty: sale.totalQty,
        totalAmount: toNumber(sale.totalAmount),
        branchId: sale.branchId,
        branchName: sale.branchName,
        soldBy: sale.soldBy,
        note: sale.note,
        createdAt: sale.createdAt,
        items: sale.items.map((item) => ({
          id: item.id,
          productId: item.productId,
          productNameSnapshot: item.productNameSnapshot,
          productSkuSnapshot: item.productSkuSnapshot,
          quantity: item.quantity,
          unitPrice: toNumber(item.unitPrice),
          lineTotal: toNumber(item.lineTotal),
          sizeName: item.sizeName,
          colorName: item.colorName,
        })),
      })),
      total,
      page,
      limit,
    };
  }
}

export default new ManualSaleService();

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
        const matchedSize = item.sizeName
          ? product.sizes.find((s) => s.name === item.sizeName)
          : null;

        const unitPrice = item.unitPrice && item.unitPrice > 0
          ? item.unitPrice
          : matchedSize && matchedSize.priceOverride !== null
            ? toNumber(matchedSize.priceOverride)
            : toNumber(product.price);

        const costPrice = matchedSize && matchedSize.costPriceOverride !== null
          ? toNumber(matchedSize.costPriceOverride)
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

      const sale = await tx.manualSale.create({
        data: {
          saleNumber,
          totalAmount,
          totalQty,
          branchId: data.branchId,
          branchName: data.branchName,
          note: data.note,
          soldBy: data.soldBy || 'Staff',
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

        await tx.inventoryTransaction.create({
          data: {
            inventoryId: inventory.id,
            type: 'POS_SALE',
            quantity: -requestedQty,
            balanceBefore: beforeQty,
            balanceAfter: afterQty,
            reference: saleNumber,
            notes: `Manual sale recorded (${saleNumber})`,
          },
        });
      }

      // Validate and decrement size quantity for items sold with a specific size
      for (const item of lineItems) {
        if (item.sizeName) {
          const productSize = await tx.productSize.findFirst({
            where: { productId: item.productId, name: item.sizeName },
          });
          if (productSize && productSize.quantity < item.quantity) {
            throw new ConflictError(
              `Insufficient stock for ${item.productNameSnapshot} (Size: ${item.sizeName}). Available: ${productSize.quantity}, requested: ${item.quantity}`
            );
          }
          await tx.productSize.updateMany({
            where: { productId: item.productId, name: item.sizeName },
            data: { quantity: { decrement: item.quantity } },
          });
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
        })),
      })),
      total,
      page,
      limit,
    };
  }
}

export default new ManualSaleService();

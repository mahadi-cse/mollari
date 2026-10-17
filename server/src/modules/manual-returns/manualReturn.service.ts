import { Prisma } from '@prisma/client';
import { prisma } from '../../config/database';
import { ConflictError, NotFoundError } from '../../shared/utils/AppError';
import { parsePagination } from '../../shared/utils/pagination';
import { CreateManualReturnInput } from './manualReturn.schema';
import { cacheInvalidatePattern } from '../../shared/utils/cache';

const toNumber = (value: Prisma.Decimal | number | string) => Number(value);

export class ManualReturnService {
  async createManualReturn(data: CreateManualReturnInput) {
    if (!data.branchId) {
      throw new ConflictError('Branch is required to record a return');
    }

    const productIds = [...new Set(data.items.map((i) => i.productId))];

    return prisma.$transaction(async (tx) => {
      const products = await tx.product.findMany({
        where: { id: { in: productIds } },
      });

      if (products.length !== productIds.length) {
        throw new NotFoundError('One or more products were not found');
      }

      const productMap = new Map(products.map((p) => [p.id, p]));

      const lineItems = data.items.map((item) => {
        const product = productMap.get(item.productId)!;
        const unitPrice = item.unitPrice && item.unitPrice > 0 ? item.unitPrice : toNumber(product.price);
        const lineTotal = unitPrice * item.quantity;
        return {
          productId: product.id,
          productNameSnapshot: product.name,
          productSkuSnapshot: product.sku,
          quantity: item.quantity,
          unitPrice,
          lineTotal,
          sizeName: item.sizeName || null,
        };
      });

      const totalQty = lineItems.reduce((sum, item) => sum + item.quantity, 0);
      const totalAmount = lineItems.reduce((sum, item) => sum + item.lineTotal, 0);

      const count = await tx.manualReturn.count();
      const returnNumber = `MR-${String(count + 1).padStart(6, '0')}`;

      const manualReturn = await tx.manualReturn.create({
        data: {
          returnNumber,
          totalAmount,
          totalQty,
          branchId: data.branchId,
          branchName: data.branchName,
          reason: data.reason,
          returnedBy: data.returnedBy || 'Staff',
          items: {
            create: lineItems.map((item) => ({
              productId: item.productId,
              productNameSnapshot: item.productNameSnapshot,
              productSkuSnapshot: item.productSkuSnapshot,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              lineTotal: item.lineTotal,
              sizeName: item.sizeName,
            })),
          },
        },
        include: { items: true },
      });

      // Add stock back to inventory for each product
      const productQtyMap = data.items.reduce<Record<number, number>>((acc, item) => {
        acc[item.productId] = (acc[item.productId] || 0) + item.quantity;
        return acc;
      }, {});

      for (const [productIdStr, returnedQty] of Object.entries(productQtyMap)) {
        const productId = Number(productIdStr);

        // Ensure inventory record exists
        await tx.inventory.upsert({
          where: { productId_warehouseId: { productId, warehouseId: data.branchId } },
          update: {},
          create: { productId, warehouseId: data.branchId, quantity: 0, reservedQty: 0 },
        });

        // Lock inventory record
        const lockedRows = await tx.$queryRaw<any[]>`
          SELECT * FROM inventory 
          WHERE "productId" = ${productId} AND "warehouseId" = ${data.branchId}
          FOR UPDATE
        `;
        const inventory = lockedRows[0];

        if (!inventory) throw new ConflictError('Inventory record vanished');

        const beforeQty = inventory.quantity;
        const afterQty = beforeQty + returnedQty;

        await tx.inventory.update({
          where: { id: inventory.id },
          data: { quantity: { increment: returnedQty } },
        });

        const productItems = lineItems.filter((i) => i.productId === productId);
        let runningBalance = beforeQty;
        for (const pItem of productItems) {
          const itemBefore = runningBalance;
          const itemAfter = itemBefore + pItem.quantity;
          runningBalance = itemAfter;
          await tx.inventoryTransaction.create({
            data: {
              inventoryId: inventory.id,
              type: 'RETURN',
              quantity: pItem.quantity,
              balanceBefore: itemBefore,
              balanceAfter: itemAfter,
              reference: returnNumber,
              notes: `Manual return recorded (${returnNumber})`,
              sizeName: pItem.sizeName || null,
              performedBy: data.returnedBy || 'Staff',
            },
          });
        }
      }

      // Increment size quantity for items returned with a specific size
      for (const item of lineItems) {
        if (item.sizeName) {
          await tx.productSize.updateMany({
            where: { productId: item.productId, name: item.sizeName },
            data: { quantity: { increment: item.quantity } },
          });
        }
      }

      return {
        id: manualReturn.id,
        returnNumber: manualReturn.returnNumber,
        totalQty: manualReturn.totalQty,
        totalAmount: toNumber(manualReturn.totalAmount),
        branchId: manualReturn.branchId,
        branchName: manualReturn.branchName,
        returnedBy: manualReturn.returnedBy,
        reason: manualReturn.reason,
        createdAt: manualReturn.createdAt,
        items: manualReturn.items.map((item) => ({
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
      await Promise.all([
        cacheInvalidatePattern('analytics:overview:*'),
        cacheInvalidatePattern('products:list:*'),
        cacheInvalidatePattern('products:slug:*'),
      ]);
      return result;
    });
  }

  async listManualReturns(filters: {
    page?: number;
    limit?: number;
    search?: string;
    sortBy?: 'createdAt' | 'totalAmount' | 'totalQty' | 'returnNumber';
    sortOrder?: 'asc' | 'desc';
  }) {
    const { page = 1, limit = 20, search, sortBy = 'createdAt', sortOrder = 'desc' } = filters;
    const { skip, take } = parsePagination({ page, limit });

    const where: Prisma.ManualReturnWhereInput = search
      ? {
          OR: [
            { returnNumber: { contains: search, mode: 'insensitive' } },
            { branchName: { contains: search, mode: 'insensitive' } },
            { returnedBy: { contains: search, mode: 'insensitive' } },
            { reason: { contains: search, mode: 'insensitive' } },
            { items: { some: { OR: [
              { productNameSnapshot: { contains: search, mode: 'insensitive' } },
              { productSkuSnapshot: { contains: search, mode: 'insensitive' } },
            ] } } },
          ],
        }
      : {};

    const orderBy: Prisma.ManualReturnOrderByWithRelationInput = { [sortBy]: sortOrder };

    const [returns, total] = await Promise.all([
      prisma.manualReturn.findMany({ where, skip, take, orderBy, include: { items: true } }),
      prisma.manualReturn.count({ where }),
    ]);

    return {
      data: returns.map((r) => ({
        id: r.id,
        returnNumber: r.returnNumber,
        totalQty: r.totalQty,
        totalAmount: toNumber(r.totalAmount),
        branchId: r.branchId,
        branchName: r.branchName,
        returnedBy: r.returnedBy,
        reason: r.reason,
        createdAt: r.createdAt,
        items: r.items.map((item) => ({
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

export default new ManualReturnService();

import { prisma } from '../../config/database';
import { ConflictError, NotFoundError } from '../../shared/utils/AppError';
import { parsePagination } from '../../shared/utils/pagination';
import { AdjustStockInput, TransferStockInput, ReconcileStockInput } from './inventory.schema';
import { InventoryTransactionType, Prisma } from '@prisma/client';
import { cacheInvalidatePattern } from '../../shared/utils/cache';

export class InventoryService {
  private async ensureBranchId(warehouseId?: number, tx: Prisma.TransactionClient = prisma) {
    if (warehouseId) return warehouseId;
    const branch = await tx.branch.findFirst({
      where: { isActive: true },
      orderBy: { id: 'asc' },
      select: { id: true },
    });
    if (!branch) throw new NotFoundError('No active branch found');
    return branch.id;
  }

  async getInventorySummary(filters: {
    page?: number;
    limit?: number;
    warehouseId?: number;
    lowStockOnly?: boolean;
  }) {
    const { page = 1, limit = 10, warehouseId, lowStockOnly } = filters;
    const { skip, take } = parsePagination({ page, limit });

    const where: any = {};
    if (warehouseId) where.warehouseId = warehouseId;
    if (lowStockOnly) where.quantity = { lte: prisma.inventory.fields.lowStockThreshold };

    const [data, total] = await Promise.all([
      prisma.inventory.findMany({
        where,
        include: {
          product: {
            include: {
              sizes: { orderBy: { sortOrder: 'asc' } },
            },
          },
          branch: true,
          transactions: { take: 5, orderBy: { createdAt: 'desc' } },
        },
        skip,
        take,
        orderBy: { updatedAt: 'desc' },
      }),
      prisma.inventory.count({ where }),
    ]);

    return {
      data: data.map(inv => ({
        id: inv.id,
        productId: inv.productId,
        product: {
          id: inv.product.id,
          name: inv.product.name,
          sku: inv.product.sku,
          price: inv.product.price,
          unitType: inv.product.unitType,
          unitLabel: inv.product.unitLabel,
          sizes: inv.product.sizes,
        },
        quantity: inv.quantity,
        reservedQty: inv.reservedQty,
        availableQty: inv.quantity - inv.reservedQty,
        lowStockThreshold: inv.lowStockThreshold,
        reorderPoint: inv.reorderPoint,
        warehouseId: inv.warehouseId,
        warehouse: inv.branch?.name || 'N/A',
        lastCountedAt: inv.lastCountedAt,
      })),
      total,
      page,
      limit,
    };
  }

  async getProductStockDetails(productId: number) {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        sizes: { orderBy: { sortOrder: 'asc' } },
      },
    });
    if (!product) throw new NotFoundError('Product not found');

    const inventoryRows = await prisma.inventory.findMany({
      where: { productId },
      include: {
        branch: true,
      },
      orderBy: { warehouseId: 'asc' },
    });

    if (inventoryRows.length === 0) throw new NotFoundError('Inventory record not found');

    const totalQuantity = inventoryRows.reduce((sum, row) => sum + row.quantity, 0);
    const totalReserved = inventoryRows.reduce((sum, row) => sum + row.reservedQty, 0);
    const primaryRow = inventoryRows[0];

    return {
      productId,
      product: { name: product.name, sku: product.sku, price: product.price, sizes: product.sizes },
      totalQuantity,
      totalReserved,
      availableQty: totalQuantity - totalReserved,
      warehouse: primaryRow.branch?.name || 'Main Warehouse',
      lowStockThreshold: primaryRow.lowStockThreshold,
      reorderPoint: primaryRow.reorderPoint,
      reorderQuantity: primaryRow.reorderQuantity,
      lastCountedAt: primaryRow.lastCountedAt,
      branches: inventoryRows.map((row) => ({
        warehouseId: row.warehouseId,
        warehouse: row.branch?.name || 'Main',
        quantity: row.quantity,
        reservedQty: row.reservedQty,
        availableQty: row.quantity - row.reservedQty,
      })),
    };
  }

  async adjustStock(data: AdjustStockInput) {
    return await prisma.$transaction(async (tx) => {
      const warehouseId = await this.ensureBranchId(data.warehouseId, tx);

      // Ensure inventory record exists
      await tx.inventory.upsert({
        where: {
          productId_warehouseId: {
            productId: data.productId,
            warehouseId,
          },
        },
        update: {},
        create: {
          productId: data.productId,
          warehouseId,
          quantity: 0,
          reservedQty: 0,
        },
      });

      // Lock the record for update
      const lockedRows = await tx.$queryRaw<any[]>`
        SELECT * FROM inventory 
        WHERE "productId" = ${data.productId} AND "warehouseId" = ${warehouseId}
        FOR UPDATE
      `;
      const inventory = lockedRows[0];

      if (!inventory) throw new NotFoundError('Inventory record not found');

      const beforeQty = inventory.quantity;
      let newBalance = beforeQty + data.quantity;

      // Handle size-level quantity updates
      if (data.sizeName) {
        const sizeRecord = await tx.productSize.findFirst({
          where: { productId: data.productId, name: data.sizeName },
        });
        if (sizeRecord) {
          const updatedSizeQty = Math.max(0, sizeRecord.quantity + data.quantity);
          await tx.productSize.update({
            where: { id: sizeRecord.id },
            data: { quantity: updatedSizeQty },
          });
        }
      } else if (data.sizes && data.sizes.length > 0) {
        for (const s of data.sizes) {
          await tx.productSize.updateMany({
            where: { productId: data.productId, name: s.name },
            data: { quantity: Math.max(0, s.quantity) },
          });
        }
      }

      // If product has sizes, keep total inventory quantity synchronized with the sum of all sizes
      const productSizes = await tx.productSize.findMany({
        where: { productId: data.productId },
      });
      if (productSizes.length > 0 && (data.sizeName || (data.sizes && data.sizes.length > 0))) {
        newBalance = productSizes.reduce((sum, s) => sum + s.quantity, 0);
      }

      const transaction = await tx.inventoryTransaction.create({
        data: {
          inventoryId: inventory.id,
          type: data.type as InventoryTransactionType,
          quantity: data.quantity,
          balanceBefore: beforeQty,
          balanceAfter: newBalance,
          reference: data.reference,
          notes: `${data.notes || ''} [Branch:${warehouseId}]`.trim(),
          batchName: data.batchName,
          manufactureDate: data.manufactureDate ? new Date(data.manufactureDate) : undefined,
          expiryDate: data.expiryDate ? new Date(data.expiryDate) : undefined,
          sizeName: data.sizeName || null,
          performedBy: data.performedBy || 'Staff',
        },
      });

      await tx.inventory.update({
        where: { id: inventory.id },
        data: {
          quantity: newBalance,
        },
      });

      return transaction;
    }).then(async (result) => {
      await Promise.all([
        cacheInvalidatePattern('analytics:overview:*'),
        cacheInvalidatePattern('products:list:*'),
        cacheInvalidatePattern('products:slug:*'),
      ]);
      return result;
    });
  }

  async transferStock(data: TransferStockInput) {
    if (!data.fromWarehouseId) {
      throw new ConflictError('Source branch is required for transfer');
    }

    return await prisma.$transaction(async (tx) => {
      // Lock source inventory
      const lockedRows = await tx.$queryRaw<any[]>`
        SELECT * FROM inventory 
        WHERE "productId" = ${data.productId} AND "warehouseId" = ${data.fromWarehouseId}
        FOR UPDATE
      `;
      const fromInventory = lockedRows[0];

      if (!fromInventory) throw new NotFoundError('Source inventory not found');
      if (fromInventory.quantity < data.quantity) {
        throw new ConflictError('Insufficient stock for transfer');
      }

      const transfer = await tx.stockTransfer.create({
        data: {
          productId: data.productId,
          inventoryId: fromInventory.id,
          fromWarehouseId: data.fromWarehouseId,
          toWarehouseId: data.toWarehouseId,
          quantity: data.quantity,
          notes: data.notes,
          referenceNumber: `ST-${Date.now()}`,
          initiatedBy: 1, // TODO: Get from auth context
        },
      });

      const beforeQty = fromInventory.quantity;
      const afterQty = beforeQty - data.quantity;

      // Deduct from source inventory
      await tx.inventory.update({
        where: { id: fromInventory.id },
        data: {
          quantity: afterQty,
        },
      });

      // Record transaction
      await tx.inventoryTransaction.create({
        data: {
          inventoryId: fromInventory.id,
          type: 'ADJUSTMENT',
          quantity: -data.quantity,
          balanceBefore: beforeQty,
          balanceAfter: afterQty,
          reference: transfer.referenceNumber,
          notes: `Transfer to warehouse ${data.toWarehouseId}: ${data.notes}`,
          performedBy: data.performedBy || 'Staff',
        },
      });

      return transfer;
    });
  }

  async getLowStockItems(filters: {
    warehouseId?: number;
    page?: number;
    limit?: number;
  }) {
    const { page = 1, limit = 10, warehouseId } = filters;
    const { skip, take } = parsePagination({ page, limit });

    const where: any = {
      quantity: { lt: prisma.inventory.fields.lowStockThreshold },
    };

    if (warehouseId) where.warehouseId = warehouseId;

    const [data, total] = await Promise.all([
      prisma.inventory.findMany({
        where,
        include: { product: true, branch: true },
        skip,
        take,
        orderBy: { quantity: 'asc' },
      }),
      prisma.inventory.count({ where }),
    ]);

    return {
      data: data.map(inv => ({
        productId: inv.productId,
        name: inv.product.name,
        sku: inv.product.sku,
        currentStock: inv.quantity,
        lowStockThreshold: inv.lowStockThreshold,
        reorderPoint: inv.reorderPoint,
        warehouse: inv.branch?.name || 'Main',
      })),
      total,
      page,
      limit,
    };
  }

  async getInventoryHistory(productId: number, filters: {
    page?: number;
    limit?: number;
    startDate?: string;
    endDate?: string;
    type?: string;
  }) {
    const { page = 1, limit = 10, startDate, endDate, type } = filters;
    const { skip, take } = parsePagination({ page, limit });

    const inventoryRows = await prisma.inventory.findMany({
      where: { productId },
      select: { id: true },
    });
    if (inventoryRows.length === 0) throw new NotFoundError('Inventory not found');
    const where: any = { inventoryId: { in: inventoryRows.map((row) => row.id) } };

    if (type) where.type = type;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const [data, total] = await Promise.all([
      prisma.inventoryTransaction.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.inventoryTransaction.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async reconcileStock(data: ReconcileStockInput) {
    const results = { reconciled: 0, errors: [] as any[] };

    return await prisma.$transaction(async (tx) => {
      for (const item of data.items) {
        try {
          // Lock record for update
          const lockedRows = await tx.$queryRaw<any[]>`
            SELECT * FROM inventory 
            WHERE "productId" = ${item.productId} AND "warehouseId" = ${data.warehouseId}
            FOR UPDATE
          `;
          const inventory = lockedRows[0];

          if (!inventory) {
            results.errors.push({ productId: item.productId, error: 'Inventory not found' });
            continue;
          }

          const difference = item.physicalCount - inventory.quantity;

          if (difference !== 0) {
            await tx.inventoryTransaction.create({
              data: {
                inventoryId: inventory.id,
                type: 'ADJUSTMENT',
                quantity: difference,
                balanceBefore: inventory.quantity,
                balanceAfter: item.physicalCount,
                reference: `RECONCILE-${data.warehouseId}`,
                notes: data.notes || 'Stock reconciliation',
                performedBy: data.performedBy || 'System Admin',
              },
            });

            await tx.inventory.update({
              where: { id: inventory.id },
              data: {
                quantity: item.physicalCount,
                lastCountedAt: new Date(),
              },
            });
          }

          results.reconciled++;
        } catch (error: any) {
          results.errors.push({ productId: item.productId, error: error.message });
        }
      }

      return results;
    });
  }

  async getInventoryReports(filters: {
    reportType?: 'summary' | 'detailed' | 'valuation';
    startDate?: string;
    endDate?: string;
    warehouseId?: number;
  }) {
    const where: any = {};
    if (filters.warehouseId) where.warehouseId = filters.warehouseId;

    const inventory = await prisma.inventory.findMany({
      where,
      include: { product: true, branch: true },
    });

    if (filters.reportType === 'summary') {
      const aggregate = await prisma.inventory.aggregate({
        where,
        _sum: {
          quantity: true,
          reservedQty: true,
        },
        _count: {
          id: true,
        },
      });

      const valuationRows = await prisma.inventory.findMany({
        where,
        select: {
          quantity: true,
          product: {
            select: {
              costPrice: true,
            },
          },
        },
      });

      const totalValue = valuationRows.reduce(
        (sum, inv) => sum + (inv.product.costPrice ? Number(inv.product.costPrice) * inv.quantity : 0),
        0
      );

      const thresholdRows = await prisma.inventory.findMany({
        where,
        select: {
          quantity: true,
          lowStockThreshold: true,
        },
      });
      const lowStockCount = thresholdRows.filter(inv => inv.quantity < inv.lowStockThreshold).length;

      return {
        totalItems: aggregate._count.id,
        totalQuantity: aggregate._sum.quantity || 0,
        totalReserved: aggregate._sum.reservedQty || 0,
        totalValue,
        lowStockCount,
      };
    }

    if (filters.reportType === 'valuation') {
      return inventory.map(inv => ({
        productId: inv.productId,
        name: inv.product.name,
        sku: inv.product.sku,
        quantity: inv.quantity,
        costPrice: inv.product.costPrice,
        totalValue: inv.quantity * (Number(inv.product.costPrice) || 0),
      }));
    }

    // Detailed report
    return inventory.map(inv => ({
      id: inv.id,
      product: { id: inv.productId, name: inv.product.name, sku: inv.product.sku, price: inv.product.price },
      quantity: inv.quantity,
      reservedQty: inv.reservedQty,
      availableQty: inv.quantity - inv.reservedQty,
      warehouse: inv.branch?.name || 'Main',
      lastCountedAt: inv.lastCountedAt,
    }));
  }

  async getInventoryLedger(filters: {
    page?: number;
    limit?: number;
    warehouseId?: number;
    productId?: number;
    type?: string;
    startDate?: string;
    endDate?: string;
    search?: string;
  }) {
    const { page = 1, limit = 20, warehouseId, productId, type, startDate, endDate, search } = filters;
    const { skip, take } = parsePagination({ page, limit });

    const where: any = {};

    if (warehouseId || productId) {
      where.inventory = {};
      if (warehouseId) where.inventory.warehouseId = warehouseId;
      if (productId) where.inventory.productId = productId;
    }

    if (type && type !== 'ALL') {
      where.type = type;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        where.createdAt.gte = start;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }

    if (search && search.trim()) {
      const q = search.trim();
      where.OR = [
        { reference: { contains: q, mode: 'insensitive' } },
        { notes: { contains: q, mode: 'insensitive' } },
        { sizeName: { contains: q, mode: 'insensitive' } },
        { performedBy: { contains: q, mode: 'insensitive' } },
        { inventory: { product: { name: { contains: q, mode: 'insensitive' } } } },
        { inventory: { product: { sku: { contains: q, mode: 'insensitive' } } } },
      ];
    }

    const [data, total, inAgg, outAgg] = await Promise.all([
      prisma.inventoryTransaction.findMany({
        where,
        include: {
          inventory: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  sku: true,
                  unitType: true,
                  unitLabel: true,
                },
              },
              branch: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.inventoryTransaction.count({ where }),
      prisma.inventoryTransaction.aggregate({
        where: { ...where, quantity: { gt: 0 } },
        _sum: { quantity: true },
      }),
      prisma.inventoryTransaction.aggregate({
        where: { ...where, quantity: { lt: 0 } },
        _sum: { quantity: true },
      }),
    ]);

    const totalIn = inAgg._sum.quantity || 0;
    const totalOut = Math.abs(outAgg._sum.quantity || 0);
    const netChange = totalIn - totalOut;

    const emailsToResolve = Array.from(
      new Set(
        data
          .map((tx) => tx.performedBy)
          .filter((val): val is string => Boolean(val && val.includes('@')))
      )
    );

    const userMap = new Map<string, string>();
    if (emailsToResolve.length > 0) {
      const users = await prisma.user.findMany({
        where: { email: { in: emailsToResolve } },
        select: { email: true, firstName: true, lastName: true },
      });
      for (const u of users) {
        const fullName = `${u.firstName || ''} ${u.lastName || ''}`.trim();
        if (fullName) {
          userMap.set(u.email.toLowerCase(), fullName);
        }
      }
    }

    const posSaleReferences = data
      .filter((tx) => tx.type === 'POS_SALE' && tx.reference)
      .map((tx) => tx.reference!);

    const manualSales = posSaleReferences.length > 0
      ? await prisma.manualSale.findMany({
          where: { saleNumber: { in: posSaleReferences } },
          select: { saleNumber: true, soldBy: true },
        })
      : [];

    const saleSoldByMap = new Map(manualSales.map((s) => [s.saleNumber, s.soldBy]));

    const resolvePerformedBy = (tx: (typeof data)[0]) => {
      if (tx.type === 'POS_SALE' && tx.reference && saleSoldByMap.has(tx.reference)) {
        const soldBy = saleSoldByMap.get(tx.reference);
        if (soldBy && soldBy !== 'System Admin' && soldBy !== 'Staff') {
          return soldBy;
        }
      }

      if (!tx.performedBy || tx.performedBy === 'System Admin') {
        return 'Mahadi Hasan';
      }
      const lower = tx.performedBy.toLowerCase();
      if (userMap.has(lower)) {
        return userMap.get(lower)!;
      }
      return tx.performedBy;
    };

    return {
      data: data.map((tx) => ({
        id: tx.id,
        inventoryId: tx.inventoryId,
        productId: tx.inventory.product.id,
        productName: tx.inventory.product.name,
        productSku: tx.inventory.product.sku,
        unitLabel: tx.inventory.product.unitLabel,
        branchId: tx.inventory.branch?.id || null,
        branchName: tx.inventory.branch?.name || 'N/A',
        type: tx.type,
        quantity: tx.quantity,
        balanceBefore: tx.balanceBefore,
        balanceAfter: tx.balanceAfter,
        reference: tx.reference,
        notes: tx.notes,
        batchName: tx.batchName,
        manufactureDate: tx.manufactureDate,
        expiryDate: tx.expiryDate,
        sizeName: tx.sizeName,
        performedBy: resolvePerformedBy(tx),
        createdAt: tx.createdAt,
      })),
      summary: {
        totalIn,
        totalOut,
        netChange,
        totalTransactions: total,
      },
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}

export default new InventoryService();

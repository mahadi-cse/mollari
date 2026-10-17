import { Prisma } from '@prisma/client';
import { prisma } from '../../config/database';
import { AnalyticsFilterInput } from './analytics.schema';
import { cacheGet, cacheSet, TTL } from '../../shared/utils/cache';

const analyticsKey = (method: string, params: object) =>
  `analytics:${method}:${JSON.stringify(params)}`;

type OverviewPeriod = 'today' | 'week' | 'month';

const toNumber = (value: Prisma.Decimal | number | string | null | undefined) => Number(value || 0);

const getPeriodRanges = (period: OverviewPeriod) => {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (period === 'today') {
    const currentStart = todayStart;
    const currentEnd = now;
    const previousStart = new Date(todayStart);
    previousStart.setDate(previousStart.getDate() - 1);
    const previousEnd = new Date(todayStart.getTime() - 1);

    return {
      currentStart,
      currentEnd,
      previousStart,
      previousEnd,
      comparisonLabel: 'yesterday',
    };
  }

  if (period === 'week') {
    const currentStart = new Date(todayStart);
    currentStart.setDate(currentStart.getDate() - 6);
    const currentEnd = now;

    const previousStart = new Date(currentStart);
    previousStart.setDate(previousStart.getDate() - 7);
    const previousEnd = new Date(currentStart.getTime() - 1);

    return {
      currentStart,
      currentEnd,
      previousStart,
      previousEnd,
      comparisonLabel: 'last week',
    };
  }

  const currentStart = new Date(todayStart);
  currentStart.setDate(currentStart.getDate() - 29);
  const currentEnd = now;

  const previousStart = new Date(currentStart);
  previousStart.setDate(previousStart.getDate() - 30);
  const previousEnd = new Date(currentStart.getTime() - 1);

  return {
    currentStart,
    currentEnd,
    previousStart,
    previousEnd,
    comparisonLabel: 'last month',
  };
};

export class AnalyticsService {
  async getRevenueAnalytics(filters: AnalyticsFilterInput) {
    const key = analyticsKey('revenue', filters);
    const cached = await cacheGet<any>(key);
    if (cached) return cached;

    const where: any = { status: { in: ['DELIVERED', 'SHIPPED'] } };

    if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      if (filters.startDate) where.createdAt.gte = new Date(filters.startDate);
      if (filters.endDate) where.createdAt.lte = new Date(filters.endDate);
    }

    const aggregate = await prisma.order.aggregate({
      where,
      _sum: { total: true },
      _count: { id: true },
    });

    const totalRevenue = Number(aggregate._sum.total || 0);
    const totalOrders = aggregate._count.id;

    const itemsAggregate = await prisma.orderItem.aggregate({
      where: { order: where },
      _sum: { quantity: true },
    });
    const totalItems = Number(itemsAggregate._sum.quantity || 0);
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    const result = { period: filters, totalRevenue, totalOrders, totalItems, avgOrderValue, currency: 'BDT' };
    await cacheSet(key, result, TTL.LONG);
    return result;
  }

  async getSalesByCategory(filters: AnalyticsFilterInput) {
    const key = analyticsKey('salesByCategory', filters);
    const cached = await cacheGet<any[]>(key);
    if (cached) return cached;

    const where: any = { order: { status: { in: ['DELIVERED', 'SHIPPED'] } } };

    if (filters.startDate || filters.endDate) {
      where.order = { ...where.order, createdAt: {} };
      if (filters.startDate) where.order.createdAt.gte = new Date(filters.startDate);
      if (filters.endDate) where.order.createdAt.lte = new Date(filters.endDate);
    }

    const items = await prisma.orderItem.findMany({
      where,
      select: {
        quantity: true,
        totalPrice: true,
        product: {
          select: {
            categoryId: true,
            category: { select: { name: true } },
          },
        },
      },
    });

    const categoryMap = new Map<number, any>();
    for (const item of items) {
      const categoryId = item.product.categoryId;
      const categoryName = item.product.category.name;
      if (!categoryMap.has(categoryId)) {
        categoryMap.set(categoryId, { categoryId, categoryName, totalSales: 0, totalItems: 0, totalRevenue: 0 });
      }
      const cat = categoryMap.get(categoryId);
      cat.totalSales += 1;
      cat.totalItems += item.quantity;
      cat.totalRevenue += Number(item.totalPrice);
    }

    const result = Array.from(categoryMap.values());
    await cacheSet(key, result, TTL.LONG);
    return result;
  }

  async getTopProducts(filters: AnalyticsFilterInput & { limit?: number }) {
    const key = analyticsKey('topProducts', filters);
    const cached = await cacheGet<any[]>(key);
    if (cached) return cached;

    const { limit = 10, startDate, endDate } = filters;
    const where: any = { order: { status: { in: ['DELIVERED', 'SHIPPED'] } } };

    if (startDate || endDate) {
      where.order = { ...where.order, createdAt: {} };
      if (startDate) where.order.createdAt.gte = new Date(startDate);
      if (endDate) where.order.createdAt.lte = new Date(endDate);
    }

    const groupedItems = await prisma.orderItem.groupBy({
      by: ['productId', 'productName', 'productSku'],
      where,
      _sum: { quantity: true, totalPrice: true },
      orderBy: { _sum: { totalPrice: 'desc' } },
      take: limit,
    });

    const result = groupedItems.map(item => ({
      productId: item.productId,
      productName: item.productName,
      sku: item.productSku,
      unitsSold: item._sum.quantity || 0,
      revenue: Number(item._sum.totalPrice || 0),
    }));

    await cacheSet(key, result, TTL.LONG);
    return result;
  }

  async getOverviewMetrics(filters: { period?: OverviewPeriod; warehouseId?: number; startDate?: string; endDate?: string }) {
    const key = analyticsKey('overview', filters);
    const cached = await cacheGet<any>(key);
    if (cached) return cached;

    let currentStart: Date;
    let currentEnd: Date;
    let previousStart: Date;
    let previousEnd: Date;
    let comparisonLabel: string;
    let effectivePeriod: string;

    if (filters.startDate && filters.endDate) {
      // Custom date range
      currentStart = new Date(filters.startDate);
      currentEnd = new Date(filters.endDate);
      // Set end to end of day
      currentEnd.setHours(23, 59, 59, 999);
      const durationMs = currentEnd.getTime() - currentStart.getTime();
      previousStart = new Date(currentStart.getTime() - durationMs);
      previousEnd = new Date(currentStart.getTime() - 1);
      comparisonLabel = 'previous period';
      effectivePeriod = 'custom';
    } else {
      const period = filters.period || 'today';
      const ranges = getPeriodRanges(period);
      currentStart = ranges.currentStart;
      currentEnd = ranges.currentEnd;
      previousStart = ranges.previousStart;
      previousEnd = ranges.previousEnd;
      comparisonLabel = ranges.comparisonLabel;
      effectivePeriod = period;
    }

    const manualSaleWhereCurrent: Prisma.ManualSaleWhereInput = {
      createdAt: { gte: currentStart, lte: currentEnd },
      ...(filters.warehouseId ? { branchId: filters.warehouseId } : {}),
    };

    const manualSaleWherePrevious: Prisma.ManualSaleWhereInput = {
      createdAt: { gte: previousStart, lte: previousEnd },
      ...(filters.warehouseId ? { branchId: filters.warehouseId } : {}),
    };

    const [
      currentManualSaleAggregate,
      previousManualSaleAggregate,
      manualSalesInRange,
      manualSaleItems,
      totalProducts,
      inventoryRows,
    ] = await Promise.all([
      prisma.manualSale.aggregate({
        where: manualSaleWhereCurrent,
        _sum: { totalAmount: true, totalQty: true },
        _count: { _all: true },
      }),
      prisma.manualSale.aggregate({
        where: manualSaleWherePrevious,
        _sum: { totalAmount: true, totalQty: true },
        _count: { _all: true },
      }),
      prisma.manualSale.findMany({
        where: manualSaleWhereCurrent,
        select: {
          createdAt: true,
          totalAmount: true,
        },
      }),
      prisma.manualSaleItem.findMany({
        where: {
          manualSale: manualSaleWhereCurrent,
        },
        select: {
          productId: true,
          productNameSnapshot: true,
          productSkuSnapshot: true,
          quantity: true,
          lineTotal: true,
          costPrice: true,
          product: {
            select: {
              costPrice: true,
              category: {
                select: {
                  name: true,
                },
              },
            },
          },
          manualSale: {
            select: {
              createdAt: true,
            },
          },
        },
      }),
      prisma.product.count({
        where: {
          isActive: true,
          ...(filters.warehouseId
            ? {
                inventories: {
                  some: {
                    warehouseId: filters.warehouseId,
                  },
                },
              }
            : {}),
        },
      }),
      prisma.inventory.findMany({
        where: {
          ...(filters.warehouseId ? { warehouseId: filters.warehouseId } : {}),
          product: { isActive: true },
        },
        select: {
          quantity: true,
          lowStockThreshold: true,
          product: {
            select: {
              id: true,
              name: true,
              sku: true,
              category: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      }),
    ]);

    const currentRevenue = toNumber(currentManualSaleAggregate._sum.totalAmount);
    const previousRevenue = toNumber(previousManualSaleAggregate._sum.totalAmount);
    const currentTransactions = currentManualSaleAggregate._count._all;
    const previousTransactions = previousManualSaleAggregate._count._all;

    const salesDeltaPercent =
      previousRevenue > 0
        ? ((currentRevenue - previousRevenue) / previousRevenue) * 100
        : currentRevenue > 0
          ? 100
          : 0;

    const transactionDelta = currentTransactions - previousTransactions;
    const currentAvgTicket = currentTransactions > 0 ? currentRevenue / currentTransactions : 0;
    const previousAvgTicket = previousTransactions > 0 ? previousRevenue / previousTransactions : 0;
    const avgTicketDelta = currentAvgTicket - previousAvgTicket;

    const trendBucketCount = 6;
    const trendDurationMs = Math.max(1, currentEnd.getTime() - currentStart.getTime());
    const bucketSizeMs = trendDurationMs / trendBucketCount;
    const trendBuckets = Array.from({ length: trendBucketCount }, (_, i) => ({
      revenue: 0,
      cost: 0,
      transactions: 0,
      startDate: new Date(currentStart.getTime() + i * bucketSizeMs).toISOString(),
    }));

    for (const sale of manualSalesInRange) {
      const elapsed = sale.createdAt.getTime() - currentStart.getTime();
      const idx = Math.min(trendBucketCount - 1, Math.max(0, Math.floor(elapsed / bucketSizeMs)));
      trendBuckets[idx].revenue += toNumber(sale.totalAmount);
      trendBuckets[idx].transactions += 1;
    }

    for (const item of manualSaleItems) {
      const elapsed = item.manualSale.createdAt.getTime() - currentStart.getTime();
      const idx = Math.min(trendBucketCount - 1, Math.max(0, Math.floor(elapsed / bucketSizeMs)));
      const costPerUnit = item.costPrice !== null ? toNumber(item.costPrice) : toNumber(item.product.costPrice);
      trendBuckets[idx].cost += costPerUnit * item.quantity;
    }

    const categorySalesMap = new Map<string, { categoryName: string; totalRevenue: number; totalItems: number }>();
    const topProductsMap = new Map<number, {
      productId: number;
      productName: string;
      sku: string;
      unitsSold: number;
      revenue: number;
    }>();

    for (const item of manualSaleItems) {
      const categoryName = item.product.category?.name || 'Uncategorized';
      const categoryBucket = categorySalesMap.get(categoryName) || {
        categoryName,
        totalRevenue: 0,
        totalItems: 0,
      };
      categoryBucket.totalRevenue += toNumber(item.lineTotal);
      categoryBucket.totalItems += item.quantity;
      categorySalesMap.set(categoryName, categoryBucket);

      const productBucket = topProductsMap.get(item.productId) || {
        productId: item.productId,
        productName: item.productNameSnapshot,
        sku: item.productSkuSnapshot,
        unitsSold: 0,
        revenue: 0,
      };
      productBucket.unitsSold += item.quantity;
      productBucket.revenue += toNumber(item.lineTotal);
      topProductsMap.set(item.productId, productBucket);
    }

    const categoryDistributionMap = new Map<string, number>();
    let lowStockCount = 0;
    let outOfStockCount = 0;

    for (const row of inventoryRows) {
      const categoryName = row.product.category?.name || 'Uncategorized';
      categoryDistributionMap.set(categoryName, (categoryDistributionMap.get(categoryName) || 0) + 1);

      if (row.quantity <= 0) {
        outOfStockCount += 1;
      } else if (row.quantity <= row.lowStockThreshold) {
        lowStockCount += 1;
      }
    }

    const alertItems = inventoryRows
      .filter((row) => row.quantity <= row.lowStockThreshold)
      .sort((a, b) => a.quantity - b.quantity)
      .slice(0, 8)
      .map((row) => ({
        productId: row.product.id,
        productName: row.product.name,
        sku: row.product.sku,
        categoryName: row.product.category?.name || 'Uncategorized',
        quantity: row.quantity,
        threshold: row.lowStockThreshold,
        status: row.quantity <= 0 ? 'out' : 'low',
      }));

    const salesByCategory = Array.from(categorySalesMap.values())
      .sort((a, b) => b.totalRevenue - a.totalRevenue)
      .slice(0, 6)
      .map((entry) => ({
        ...entry,
        sharePercent: currentRevenue > 0 ? (entry.totalRevenue / currentRevenue) * 100 : 0,
      }));

    const topProducts = Array.from(topProductsMap.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 6);

    const result = {
      period: effectivePeriod,
      range: {
        startDate: currentStart.toISOString(),
        endDate: currentEnd.toISOString(),
        comparisonLabel,
      },
      manualSales: {
        totalSales: currentRevenue,
        totalQty: toNumber(currentManualSaleAggregate._sum.totalQty),
        transactions: currentTransactions,
        avgTicket: currentAvgTicket,
        salesDeltaPercent,
        transactionDelta,
        avgTicketDelta,
      },
      trend: {
        revenue: trendBuckets.map((bucket) => Math.round(bucket.revenue)),
        cost: trendBuckets.map((bucket) => Math.round(bucket.cost)),
        transactions: trendBuckets.map((bucket) => bucket.transactions),
        avgTicket: trendBuckets.map((bucket) =>
          bucket.transactions > 0 ? Math.round(bucket.revenue / bucket.transactions) : 0
        ),
        labels: trendBuckets.map((bucket) => bucket.startDate),
      },
      inventory: {
        totalProducts,
        lowStockCount,
        outOfStockCount,
        categoryDistribution: Array.from(categoryDistributionMap.entries())
          .map(([categoryName, count]) => ({ categoryName, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 6),
        alertItems,
      },
      salesByCategory,
      topProducts,
    };

    // SHORT TTL (5 min): overview data changes every time a sale is recorded.
    // The cache is also explicitly busted on each new sale via manualSale.service.ts.
    await cacheSet(key, result, TTL.SHORT);
    return result;
  }

  async getCustomerAnalytics(filters: AnalyticsFilterInput) {
    const where: any = {};

    if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      if (filters.startDate) where.createdAt.gte = new Date(filters.startDate);
      if (filters.endDate) where.createdAt.lte = new Date(filters.endDate);
    }

    const totalCustomers = await prisma.customer.count({ where });

    const activeCustomers = await prisma.customer.count({
      where: {
        ...where,
        orders: {
          some: {},
        },
      },
    });

    const totalOrders = await prisma.order.count({
      where: {
        customer: where,
      },
    });

    const avgOrdersPerCustomer = activeCustomers > 0 ? totalOrders / activeCustomers : 0;

    const spentAggregate = await prisma.customer.aggregate({
      where,
      _sum: {
        totalSpent: true,
      },
    });
    const totalSpent = Number(spentAggregate._sum.totalSpent || 0);
    const avgSpentPerCustomer = totalCustomers > 0 ? totalSpent / totalCustomers : 0;

    const segmentGroups = await prisma.customer.groupBy({
      by: ['segment'],
      where,
      _count: {
        id: true,
      },
    });

    const segments = {
      vip: segmentGroups.find(g => g.segment === 'VIP')?._count.id || 0,
      regular: segmentGroups.find(g => g.segment === 'REGULAR')?._count.id || 0,
      new: segmentGroups.find(g => g.segment === 'NEW')?._count.id || 0,
      inactive: segmentGroups.find(g => g.segment === 'INACTIVE')?._count.id || 0,
    };

    return {
      totalCustomers,
      activeCustomers,
      avgOrdersPerCustomer,
      totalSpent,
      avgSpentPerCustomer,
      segments,
    };
  }

  async getInvoiceData(filters: AnalyticsFilterInput) {
    const where: any = {};

    if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      if (filters.startDate) where.createdAt.gte = new Date(filters.startDate);
      if (filters.endDate) where.createdAt.lte = new Date(filters.endDate);
    }

    const orders = await prisma.order.findMany({
      where,
      include: { items: true, payment: true, customer: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return orders.map(order => ({
      orderNumber: order.orderNumber,
      date: order.createdAt,
      customer: order.customer ? `${order.customer.firstName} ${order.customer.lastName}` : 'N/A',
      status: order.status,
      paymentStatus: order.payment?.status,
      total: order.total,
      itemCount: order.items.length,
    }));
  }

  async getCustomReport(query: any) {
    // Flexible reporting based on query parameters
    const { entityType, metric, groupBy, startDate, endDate } = query;

    if (entityType === 'orders' && metric === 'count') {
      const where: any = {};
      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) where.createdAt.gte = new Date(startDate);
        if (endDate) where.createdAt.lte = new Date(endDate);
      }

      const count = await prisma.order.count({ where });
      return { entityType, metric, value: count };
    }

    if (entityType === 'products' && metric === 'total') {
      const count = await prisma.product.count();
      return { entityType, metric, value: count };
    }

    if (entityType === 'inventory' && metric === 'totalQuantity') {
      const inventory = await prisma.inventory.findMany();
      const total = inventory.reduce((sum, inv) => sum + inv.quantity, 0);
      return { entityType, metric, value: total };
    }

    return { error: 'Invalid report query' };
  }

  async getStaffAnalytics(filters: AnalyticsFilterInput) {
    const staffUsers = await prisma.user.findMany({
      where: {
        userType: {
          code: { in: ['1x101', '4x404', '5x505', '6x606', '7x707'] },
        },
        ...(filters.warehouseId
          ? {
              userBranches: {
                some: { branchId: filters.warehouseId },
              },
            }
          : {}),
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        userType: {
          select: {
            name: true,
            code: true,
          },
        },
      },
    });

    const userIdsInBranch = filters.warehouseId
      ? (
          await prisma.userBranch.findMany({
            where: { branchId: filters.warehouseId },
            select: { userId: true },
          })
        ).map((ub) => ub.userId)
      : [];

    const orderWhere: Prisma.OrderWhereInput = {
      status: { in: ['DELIVERED', 'SHIPPED', 'CONFIRMED', 'PROCESSING'] },
      ...(filters.startDate || filters.endDate
        ? {
            createdAt: {
              ...(filters.startDate ? { gte: new Date(filters.startDate) } : {}),
              ...(filters.endDate ? { lte: new Date(filters.endDate) } : {}),
            },
          }
        : {}),
      ...(filters.warehouseId
        ? {
            processedBy: { in: userIdsInBranch },
          }
        : {}),
    };

    const orders = await prisma.order.findMany({
      where: orderWhere,
      select: {
        id: true,
        processedBy: true,
        total: true,
      },
    });

    const manualSaleWhere: Prisma.ManualSaleWhereInput = {
      ...(filters.warehouseId ? { branchId: filters.warehouseId } : {}),
      ...(filters.startDate || filters.endDate
        ? {
            createdAt: {
              ...(filters.startDate ? { gte: new Date(filters.startDate) } : {}),
              ...(filters.endDate ? { lte: new Date(filters.endDate) } : {}),
            },
          }
        : {}),
    };

    const manualSales = await prisma.manualSale.findMany({
      where: manualSaleWhere,
      select: {
        id: true,
        soldBy: true,
        totalAmount: true,
      },
    });

    const staffMetrics = new Map<number | string, {
      staffId: number | null;
      name: string;
      email: string;
      role: string;
      ordersHandled: number;
      manualSalesHandled: number;
      totalTransactions: number;
      orderSalesAmount: number;
      manualSalesAmount: number;
      totalSalesAmount: number;
      revenueContribution: number;
    }>();

    for (const staff of staffUsers) {
      const name = `${staff.firstName || ''} ${staff.lastName || ''}`.trim() || staff.email || `Staff #${staff.id}`;
      staffMetrics.set(staff.id, {
        staffId: staff.id,
        name,
        email: staff.email,
        role: staff.userType?.name || 'Staff',
        ordersHandled: 0,
        manualSalesHandled: 0,
        totalTransactions: 0,
        orderSalesAmount: 0,
        manualSalesAmount: 0,
        totalSalesAmount: 0,
        revenueContribution: 0,
      });
    }

    const otherKey = 'other';
    staffMetrics.set(otherKey, {
      staffId: null,
      name: 'System / Online / Other',
      email: 'system@mollari.com',
      role: 'System',
      ordersHandled: 0,
      manualSalesHandled: 0,
      totalTransactions: 0,
      orderSalesAmount: 0,
      manualSalesAmount: 0,
      totalSalesAmount: 0,
      revenueContribution: 0,
    });

    let grandTotalSales = 0;

    for (const order of orders) {
      const total = Number(order.total || 0);
      grandTotalSales += total;

      if (order.processedBy && staffMetrics.has(order.processedBy)) {
        const metric = staffMetrics.get(order.processedBy)!;
        metric.ordersHandled += 1;
        metric.orderSalesAmount += total;
        metric.totalSalesAmount += total;
        metric.totalTransactions += 1;
      } else {
        const metric = staffMetrics.get(otherKey)!;
        metric.ordersHandled += 1;
        metric.orderSalesAmount += total;
        metric.totalSalesAmount += total;
        metric.totalTransactions += 1;
      }
    }

    for (const sale of manualSales) {
      const total = Number(sale.totalAmount || 0);
      grandTotalSales += total;

      const soldByStr = (sale.soldBy || '').trim().toLowerCase();
      let matchedStaffId: number | null = null;

      for (const staff of staffUsers) {
        const staffName = `${staff.firstName || ''} ${staff.lastName || ''}`.trim().toLowerCase();
        const staffEmail = staff.email.toLowerCase();
        const staffFirstName = (staff.firstName || '').trim().toLowerCase();
        const staffLastName = (staff.lastName || '').trim().toLowerCase();

        if (
          soldByStr === staffEmail ||
          soldByStr === staffName ||
          (staffFirstName && soldByStr === staffFirstName) ||
          (staffLastName && soldByStr === staffLastName)
        ) {
          matchedStaffId = staff.id;
          break;
        }
      }

      if (matchedStaffId !== null) {
        const metric = staffMetrics.get(matchedStaffId)!;
        metric.manualSalesHandled += 1;
        metric.manualSalesAmount += total;
        metric.totalSalesAmount += total;
        metric.totalTransactions += 1;
      } else {
        const metric = staffMetrics.get(otherKey)!;
        metric.manualSalesHandled += 1;
        metric.manualSalesAmount += total;
        metric.totalSalesAmount += total;
        metric.totalTransactions += 1;
      }
    }

    const resultList = Array.from(staffMetrics.values());
    for (const item of resultList) {
      item.revenueContribution = grandTotalSales > 0 ? (item.totalSalesAmount / grandTotalSales) * 100 : 0;
    }

    return resultList
      .filter((item) => item.totalTransactions > 0 || item.staffId !== null)
      .sort((a, b) => b.totalSalesAmount - a.totalSalesAmount);
  }

  async getCustomersDetailed(filters: AnalyticsFilterInput & { page?: number; limit?: number; search?: string; segment?: string }) {
    const page = filters.page ? Number(filters.page) : 1;
    const limit = filters.limit ? Number(filters.limit) : 20;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (filters.search) {
      where.OR = [
        { firstName: { contains: filters.search, mode: 'insensitive' } },
        { lastName: { contains: filters.search, mode: 'insensitive' } },
        { phone: { contains: filters.search, mode: 'insensitive' } },
        { user: { email: { contains: filters.search, mode: 'insensitive' } } },
      ];
    }

    if (filters.segment) {
      where.segment = filters.segment;
    }

    const total = await prisma.customer.count({ where });

    const customers = await prisma.customer.findMany({
      where,
      include: {
        user: {
          select: {
            email: true,
            phone: true,
          },
        },
        orders: {
          where: {
            status: { in: ['DELIVERED', 'SHIPPED', 'CONFIRMED', 'PROCESSING'] },
            ...(filters.startDate || filters.endDate
              ? {
                  createdAt: {
                    ...(filters.startDate ? { gte: new Date(filters.startDate) } : {}),
                    ...(filters.endDate ? { lte: new Date(filters.endDate) } : {}),
                  },
                }
              : {}),
          },
          include: {
            items: {
              include: {
                product: {
                  select: {
                    costPrice: true,
                  },
                },
              },
            },
          },
        },
      },
      skip,
      take: limit,
      orderBy: { totalSpent: 'desc' },
    });

    const data = customers.map((customer) => {
      const orderFrequency = customer.orders.length;
      let totalItemsPurchased = 0;
      let totalPurchaseAmount = 0;
      let totalCost = 0;

      for (const order of customer.orders) {
        totalPurchaseAmount += Number(order.total || 0);
        for (const item of order.items) {
          totalItemsPurchased += item.quantity;
          const itemCost = item.product?.costPrice ? Number(item.product.costPrice) : 0;
          totalCost += itemCost * item.quantity;
        }
      }

      const profit = totalPurchaseAmount - totalCost;

      // Loyalty points estimation
      const loyaltyPointsAccumulated = Math.floor(Number(customer.totalSpent || 0) / 100);
      const loyaltyPointsUsed = Math.max(0, loyaltyPointsAccumulated - customer.loyaltyPoints);

      return {
        customerId: customer.id,
        name: `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || customer.user?.email || `Customer #${customer.id}`,
        email: customer.user?.email || 'N/A',
        phone: customer.phone || customer.user?.phone || 'N/A',
        segment: customer.segment,
        orderFrequency,
        totalItemsPurchased,
        totalPurchaseAmount,
        totalCost,
        profit,
        loyaltyPoints: customer.loyaltyPoints,
        loyaltyPointsAccumulated,
        loyaltyPointsUsed,
      };
    });

    return {
      data,
      total,
      page,
      limit,
    };
  }
}

export default new AnalyticsService();

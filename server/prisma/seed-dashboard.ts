import { prisma } from '../src/config/database';

/**
 * Seed script for Mollari database
 * Run after migrations: npx tsx prisma/seed.ts
 * 
 * This script initializes:
 * 1. Product analytics data
 * 2. Customer segments
 * 3. Inventory reorder points
 */

async function main() {
  console.log('🌱 Starting database seed...\n');

  try {
    // ─────────────────────────────────────────────────────────────
    // 1. INITIALIZE PRODUCT ANALYTICS
    // ─────────────────────────────────────────────────────────────
    console.log('📊 Initializing product analytics...');

    const products = await prisma.product.findMany({
      include: {
        _count: {
          select: { orderItems: true, wishlist: true }
        }
      }
    });

    for (const product of products) {
      // Calculate product metrics from order items
      const orderItems = await prisma.orderItem.findMany({
        where: { productId: product.id },
        include: { order: true }
      });

      const deliveredItems = orderItems.filter(
        item => item.order.status === 'DELIVERED'
      );

      const totalSold = deliveredItems.reduce((sum, item) => sum + item.quantity, 0);
      const totalRevenue = deliveredItems.reduce((sum, item) => sum + Number(item.totalPrice), 0);
      const lastSoldAt = deliveredItems.length > 0 
        ? new Date(Math.max(...deliveredItems.map(item => item.order.createdAt.getTime())))
        : null;

      // Create or update analytics record
      await prisma.productAnalytics.upsert({
        where: { productId: product.id },
        update: {
          totalSold,
          totalRevenue: totalRevenue.toString(),
          totalViews: 0, // Initialize to 0 - update via tracking
          wishlistCount: product._count.wishlist,
          lastSoldAt,
          lastUpdated: new Date()
        },
        create: {
          productId: product.id,
          totalSold,
          totalRevenue: totalRevenue.toString(),
          totalViews: 0,
          wishlistCount: product._count.wishlist,
          reviewCount: 0,
          returnCount: 0,
          lastSoldAt
        }
      });
    }

    console.log(`✅ Initialized analytics for ${products.length} products\n`);

    // ─────────────────────────────────────────────────────────────
    // 2. UPDATE CUSTOMER SEGMENTS AND METRICS
    // ─────────────────────────────────────────────────────────────
    console.log('👥 Updating customer segments and metrics...');

    const customers = await prisma.customer.findMany();

    for (const customer of customers) {
      // Count orders
      const orderCount = await prisma.order.count({
        where: { customerId: customer.id }
      });

      // Get last order date
      const lastOrder = await prisma.order.findFirst({
        where: { customerId: customer.id },
        orderBy: { createdAt: 'desc' }
      });

      // Calculate total spent
      const orders = await prisma.order.findMany({
        where: { customerId: customer.id, status: 'DELIVERED' }
      });

      const totalSpent = orders.reduce((sum, order) => sum + Number(order.total), 0);

      // Determine segment
      let segment: 'VIP' | 'REGULAR' | 'NEW' | 'INACTIVE';

      if (totalSpent > 50000) {
        segment = 'VIP';
      } else if (totalSpent > 10000) {
        segment = 'REGULAR';
      } else if (customer.createdAt > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)) {
        segment = 'NEW';
      } else if (lastOrder && lastOrder.createdAt < new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)) {
        segment = 'INACTIVE';
      } else {
        segment = 'REGULAR';
      }

      // Update customer
      await prisma.customer.update({
        where: { id: customer.id },
        data: {
          totalOrders: orderCount,
          lastOrderAt: lastOrder?.createdAt,
          segment,
          totalSpent: totalSpent.toString()
        }
      });
    }

    console.log(`✅ Updated segments for ${customers.length} customers\n`);

    // ─────────────────────────────────────────────────────────────
    // 3. INITIALIZE INVENTORY REORDER POINTS
    // ─────────────────────────────────────────────────────────────
    console.log('📦 Initializing inventory reorder points...');

    const inventories = await prisma.inventory.findMany({
      include: { product: { include: { analytics: true } } }
    });

    for (const inventory of inventories) {
      const analytics = inventory.product.analytics;
      const monthlySales = analytics?.totalSold || 0;

      let reorderPoint = 20;
      let reorderQuantity = 50;

      // Set reorder point based on sales volume
      if (monthlySales > 100) {
        reorderPoint = 50;
        reorderQuantity = 200;
      } else if (monthlySales > 50) {
        reorderPoint = 30;
        reorderQuantity = 100;
      } else if (monthlySales > 10) {
        reorderPoint = 20;
        reorderQuantity = 50;
      } else {
        reorderPoint = 10;
        reorderQuantity = 20;
      }

      // Update inventory
      await prisma.inventory.update({
        where: { id: inventory.id },
        data: {
          reorderPoint,
          reorderQuantity,
          lastCountedAt: new Date()
        }
      });
    }

    console.log(`✅ Initialized reorder points for ${inventories.length} inventory items\n`);

    // ─────────────────────────────────────────────────────────────
    // 4. VERIFY DATA INTEGRITY
    // ─────────────────────────────────────────────────────────────
    console.log('🔍 Verifying data integrity...');

    const analyticsCount = await prisma.productAnalytics.count();
    const segmentedCustomers = await prisma.customer.count({
      where: { segment: { not: 'NEW' } }
    });

    console.log(`   ✓ ${analyticsCount} analytics records`);
    console.log(`   ✓ ${segmentedCustomers} customers with segments`);
    console.log(`   ✓ ${inventories.length} inventory items with reorder points\n`);

    console.log('✨ Database seed completed successfully!\n');

    // ─────────────────────────────────────────────────────────────
    // 5. SUMMARY STATISTICS
    // ─────────────────────────────────────────────────────────────
    console.log('📈 Database Summary:');
    console.log(`   • Products: ${products.length}`);
    console.log(`   • Customers: ${customers.length}`);
    console.log(`   • Inventory Items: ${inventories.length}`);
    console.log(`   • Analytics Records: ${analyticsCount}`);

    // Customer segment breakdown
    const vipCount = await prisma.customer.count({ where: { segment: 'VIP' } });
    const regularCount = await prisma.customer.count({ where: { segment: 'REGULAR' } });
    const newCount = await prisma.customer.count({ where: { segment: 'NEW' } });
    const inactiveCount = await prisma.customer.count({ where: { segment: 'INACTIVE' } });

    console.log(`\n👥 Customer Segments:`);
    console.log(`   • VIP: ${vipCount}`);
    console.log(`   • Regular: ${regularCount}`);
    console.log(`   • New: ${newCount}`);
    console.log(`   • Inactive: ${inactiveCount}`);

  } catch (error) {
    console.error('❌ Seed failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main();

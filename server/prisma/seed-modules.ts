import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const MODULES = [
  { code: 'overview', name: 'Overview', icon: '◈', sortOrder: 1 },
  { code: 'products', name: 'Products', icon: '📦', sortOrder: 2 },
  { code: 'categories', name: 'Categories', icon: '🗂️', sortOrder: 3 },
  { code: 'sales', name: 'Sales', icon: '💰', sortOrder: 4 },
  { code: 'returns', name: 'Returns', icon: '↩', sortOrder: 5 },
  { code: 'inventory', name: 'Inventory', icon: '📦', sortOrder: 6 },
  { code: 'suppliers', name: 'Suppliers', icon: '🏭', sortOrder: 7 },
  { code: 'branches', name: 'Branches', icon: '🏪', sortOrder: 8 },
  { code: 'analytics', name: 'Analytics', icon: '📊', sortOrder: 9 },
  { code: 'orders', name: 'Orders', icon: '🛒', sortOrder: 10 },
  { code: 'pos', name: 'POS', icon: '🖥️', badge: 'Soon', sortOrder: 11 },
  { code: 'settings', name: 'Settings', icon: '⚙️', sortOrder: 12 },
  // Settings sub-modules
  { code: 'settings:general', name: 'Settings › General', icon: '🏷️', sortOrder: 13 },
  { code: 'settings:payment', name: 'Settings › Payment', icon: '💳', sortOrder: 14 },
  { code: 'settings:shipping', name: 'Settings › Shipping', icon: '🚚', sortOrder: 15 },
  { code: 'settings:inventory', name: 'Settings › Inventory', icon: '📦', sortOrder: 16 },
  { code: 'settings:notifications', name: 'Settings › Notifications', icon: '🔔', sortOrder: 17 },
  { code: 'settings:staff', name: 'Settings › Staff & Roles', icon: '👤', sortOrder: 18 },
  { code: 'settings:trending', name: 'Settings › Trending Products', icon: '🔥', sortOrder: 19 },
  { code: 'settings:discounts', name: 'Settings › Discount & Sales', icon: '🏷️', sortOrder: 19 },
];

async function main() {
  for (const m of MODULES) {
    await prisma.appModule.upsert({
      where: { code: m.code },
      update: m,
      create: m,
    });
  }
  console.log("Seeded modules.");
  
  const admin = await prisma.user.findUnique({ where: { email: 'admin@mollari.local' } });
  if (admin) {
    const modules = await prisma.appModule.findMany();
    for (const m of modules) {
      await prisma.userModule.upsert({
        where: { userId_moduleId: { userId: admin.id, moduleId: m.id } },
        update: { isActive: true },
        create: { userId: admin.id, moduleId: m.id, isActive: true },
      });
    }
    console.log("Assigned all modules to admin.");
  }
}

main().finally(() => prisma.$disconnect());

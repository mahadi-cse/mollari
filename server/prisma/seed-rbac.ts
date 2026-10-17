/**
 * Database Seed Script: RBAC System
 * Purpose: Initialize and manage Role-Based Access Control (RBAC) system
 *
 * Usage:
 *   npx ts-node prisma/seed-rbac.ts
 *   or
 *   npx tsx prisma/seed-rbac.ts
 *
 * This script:
 * 1. Verifies all default roles and permissions are created
 * 2. Sets up default role permissions
 * 3. Helper functions for role/permission management
 * 4. SKU generation system initialization
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

interface PermissionDef {
  name: string;
  description: string;
  resource: string;
  action: string;
  module?: string;
}

interface RoleDef {
  name: string;
  description: string;
  isSystem: boolean;
  canBeDeleted: boolean;
}

// ─────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────

const DEFAULT_ROLES: RoleDef[] = [
  {
    name: 'ADMIN',
    description: 'System administrator with full access',
    isSystem: true,
    canBeDeleted: false,
  },
  {
    name: 'MANAGER',
    description: 'Branch manager with operational control',
    isSystem: true,
    canBeDeleted: false,
  },
  {
    name: 'SUPERVISOR',
    description: 'Team supervisor with team management',
    isSystem: true,
    canBeDeleted: true,
  },
  {
    name: 'CASHIER',
    description: 'Point of sale cashier',
    isSystem: true,
    canBeDeleted: true,
  },
  {
    name: 'WAREHOUSE_STAFF',
    description: 'Warehouse and inventory staff',
    isSystem: true,
    canBeDeleted: true,
  },
  {
    name: 'CUSTOMER',
    description: 'Customer account',
    isSystem: true,
    canBeDeleted: false,
  },
];

const PERMISSIONS: PermissionDef[] = [
  // Products
  { name: 'products.read', description: 'View products', resource: 'products', action: 'read', module: 'products' },
  { name: 'products.create', description: 'Create new product', resource: 'products', action: 'create', module: 'products' },
  { name: 'products.update', description: 'Edit product', resource: 'products', action: 'update', module: 'products' },
  { name: 'products.delete', description: 'Delete product', resource: 'products', action: 'delete', module: 'products' },

  // Orders
  { name: 'orders.read', description: 'View orders', resource: 'orders', action: 'read', module: 'orders' },
  { name: 'orders.create', description: 'Create order', resource: 'orders', action: 'create', module: 'orders' },
  { name: 'orders.confirm', description: 'Confirm order', resource: 'orders', action: 'confirm', module: 'orders' },
  { name: 'orders.cancel', description: 'Cancel order', resource: 'orders', action: 'cancel', module: 'orders' },
  { name: 'orders.refund', description: 'Refund order', resource: 'orders', action: 'refund', module: 'orders' },

  // Customers
  { name: 'customers.read', description: 'View customers', resource: 'customers', action: 'read', module: 'customers' },
  { name: 'customers.create', description: 'Create customer', resource: 'customers', action: 'create', module: 'customers' },
  { name: 'customers.update', description: 'Edit customer', resource: 'customers', action: 'update', module: 'customers' },
  { name: 'customers.delete', description: 'Delete customer', resource: 'customers', action: 'delete', module: 'customers' },

  // Inventory
  { name: 'inventory.read', description: 'View inventory', resource: 'inventory', action: 'read', module: 'inventory' },
  { name: 'inventory.adjust', description: 'Adjust stock quantity', resource: 'inventory', action: 'adjust', module: 'inventory' },
  { name: 'inventory.transfer', description: 'Transfer stock between warehouses', resource: 'inventory', action: 'transfer', module: 'inventory' },

  // Reports
  { name: 'reports.read', description: 'View reports', resource: 'reports', action: 'read', module: 'reports' },
  { name: 'reports.export', description: 'Export reports', resource: 'reports', action: 'export', module: 'reports' },

  // Admin
  { name: 'users.manage', description: 'Manage users and assignments', resource: 'users', action: 'manage', module: 'admin' },
  { name: 'roles.manage', description: 'Manage roles and permissions', resource: 'roles', action: 'manage', module: 'admin' },
  { name: 'branches.manage', description: 'Manage branches and warehouses', resource: 'branches', action: 'manage', module: 'admin' },

  // Dashboard & Analytics
  { name: 'dashboard.access', description: 'Access admin dashboard', resource: 'dashboard', action: 'access', module: 'dashboard' },
  { name: 'analytics.read', description: 'View analytics and metrics', resource: 'analytics', action: 'read', module: 'analytics' },
];

// ─────────────────────────────────────────────────────────────
// UTILITY FUNCTIONS
// ─────────────────────────────────────────────────────────────

/**
 * Assign a role to a user
 */
async function assignRoleToUser(
  userId: number,
  roleName: string,
  branchId?: number,
  assignedBy?: number
) {
  const role = await prisma.role.findUnique({ where: { name: roleName } });
  if (!role) throw new Error(`Role "${roleName}" not found`);

  try {
    const userRole = await (prisma as any).userRole.create({
      data: {
        userId,
        roleId: role.id,
        branchId,
        assignedBy,
        assignedAt: new Date(),
      },
    });

    // Log to role_assignments for audit trail
    await prisma.roleAssignment.create({
      data: {
        userId,
        roleId: role.id,
        actionType: 'ASSIGNED',
        changedBy: assignedBy,
        reason: `Assigned ${roleName} role${branchId ? ` for branch ${branchId}` : ''}`,
      },
    });

    console.log(`✓ Assigned role "${roleName}" to user ${userId}${branchId ? ` for branch ${branchId}` : ''}`);
    return userRole;
  } catch (error: any) {
    if (error.code === 'P2002') {
      console.warn(`⚠ User ${userId} already has role "${roleName}"`);
      return null;
    }
    throw error;
  }
}

/**
 * Assign a branch to a user
 */
async function assignBranchToUser(userId: number, branchId: number, isPrimary = false) {
  try {
    const userBranch = await prisma.userBranch.create({
      data: {
        userId,
        branchId,
        isPrimary,
      },
    });
    console.log(`✓ Assigned branch ${branchId} to user ${userId}${isPrimary ? ' (primary)' : ''}`);
    return userBranch;
  } catch (error: any) {
    if (error.code === 'P2002') {
      console.warn(`⚠ User ${userId} already assigned to branch ${branchId}`);
      return null;
    }
    throw error;
  }
}

/**
 * Create or update SKU settings for a category
 */
async function setupSKUSettings(categoryId: number, prefix: string) {
  try {
    const setting = await prisma.sKUSetting.upsert({
      where: { categoryId },
      update: { prefix, enableAutoGeneration: true },
      create: {
        categoryId,
        prefix,
        currentCounter: 0,
        enableAutoGeneration: true,
      },
    });
    console.log(`✓ SKU settings configured for category ${categoryId} with prefix "${prefix}"`);
    return setting;
  } catch (error) {
    console.warn(`⚠ Could not setup SKU for category ${categoryId}: ${error}`);
    return null;
  }
}

/**
 * Generate next SKU for a category
 */
async function generateSKU(categoryId: number): Promise<string | null> {
  try {
    const setting = await prisma.sKUSetting.findUnique({
      where: { categoryId },
    });

    if (!setting || !setting.enableAutoGeneration) {
      console.warn(`⚠ SKU auto-generation not enabled for category ${categoryId}`);
      return null;
    }

    const newCounter = setting.currentCounter + 1;
    const sku = `${setting.prefix}-${String(newCounter).padStart(3, '0')}`;

    // Update counter
    await prisma.sKUSetting.update({
      where: { id: setting.id },
      data: { currentCounter: newCounter },
    });

    return sku;
  } catch (error) {
    console.error(`✗ Error generating SKU for category ${categoryId}:`, error);
    return null;
  }
}

/**
 * Get all permissions for a user
 */
async function getUserPermissions(userId: number) {
  const permissions = await prisma.$queryRaw<
    Array<{ permission_name: string; resource: string; action: string }>
  >`
    SELECT DISTINCT p.name as permission_name, p.resource, p.action
    FROM "user_roles" ur
    JOIN "roles" r ON ur."roleId" = r.id
    JOIN "role_permissions" rp ON r.id = rp."roleId"
    JOIN "permissions" p ON rp."permissionId" = p.id
    WHERE ur."userId" = ${userId} AND ur."isActive" = true AND p."isActive" = true
    ORDER BY p.resource, p.action
  `;

  return permissions;
}

/**
 * Check if user has specific permission
 */
async function userHasPermission(userId: number, resource: string, action: string): Promise<boolean> {
  const result = await prisma.$queryRaw<
    Array<{ has_permission: boolean }>
  >`SELECT has_permission(${userId}, ${resource}, ${action}) as has_permission`;

  return result[0]?.has_permission || false;
}

// ─────────────────────────────────────────────────────────────
// SEEDING FUNCTIONS
// ─────────────────────────────────────────────────────────────

/**
 * Verify and create all default roles
 */
async function seedRoles() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Seeding Default Roles...');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  for (const roleDef of DEFAULT_ROLES) {
    const existing = await prisma.role.findUnique({
      where: { name: roleDef.name },
    });

    if (existing) {
      console.log(`✓ Role "${roleDef.name}" already exists`);
    } else {
      const role = await prisma.role.create({
        data: {
          name: roleDef.name,
          description: roleDef.description,
          isSystem: roleDef.isSystem,
          canBeDeleted: roleDef.canBeDeleted,
        },
      });
      console.log(`✓ Created role "${role.name}"`);
    }
  }
}

/**
 * Verify and create all permissions
 */
async function seedPermissions() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Seeding Permissions...');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  for (const permDef of PERMISSIONS) {
    const existing = await prisma.permission.findUnique({
      where: { name: permDef.name },
    });

    if (existing) {
      console.log(`✓ Permission "${permDef.name}" already exists`);
    } else {
      const perm = await prisma.permission.create({
        data: {
          name: permDef.name,
          description: permDef.description,
          resource: permDef.resource,
          action: permDef.action,
          module: permDef.module,
        },
      });
      console.log(`✓ Created permission "${perm.name}"`);
    }
  }
}

/**
 * Setup default role permissions
 */
async function seedRolePermissions() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Seeding Role Permissions...');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const adminRole = await prisma.role.findUnique({ where: { name: 'ADMIN' } });
  const cashierRole = await prisma.role.findUnique({ where: { name: 'CASHIER' } });
  const warehouseRole = await prisma.role.findUnique({
    where: { name: 'WAREHOUSE_STAFF' },
  });
  const customerRole = await prisma.role.findUnique({
    where: { name: 'CUSTOMER' },
  });

  if (!adminRole || !cashierRole || !warehouseRole || !customerRole) {
    throw new Error('Required roles not found');
  }

  // ADMIN: All permissions
  const allPerms = await prisma.permission.findMany();
  let assignedCount = 0;
  for (const perm of allPerms) {
    const existing = await prisma.rolePermission.findUnique({
      where: { roleId_permissionId: { roleId: adminRole.id, permissionId: perm.id } },
    });
    if (!existing) {
      await prisma.rolePermission.create({
        data: { roleId: adminRole.id, permissionId: perm.id },
      });
      assignedCount++;
    }
  }
  console.log(`✓ ADMIN role: ${assignedCount} new permissions assigned`);

  // CASHIER: Orders & Products read, Orders create
  const cashierPerms = await prisma.permission.findMany({
    where: {
      name: {
        in: ['orders.create', 'orders.read', 'products.read', 'customers.read', 'customers.create', 'analytics.read'],
      },
    },
  });
  assignedCount = 0;
  for (const perm of cashierPerms) {
    const existing = await prisma.rolePermission.findUnique({
      where: { roleId_permissionId: { roleId: cashierRole.id, permissionId: perm.id } },
    });
    if (!existing) {
      await prisma.rolePermission.create({
        data: { roleId: cashierRole.id, permissionId: perm.id },
      });
      assignedCount++;
    }
  }
  console.log(`✓ CASHIER role: ${assignedCount} new permissions assigned`);

  // WAREHOUSE_STAFF: Inventory management
  const warehousePerms = await prisma.permission.findMany({
    where: {
      name: {
        in: ['inventory.read', 'inventory.adjust', 'inventory.transfer', 'products.read', 'orders.read', 'analytics.read'],
      },
    },
  });
  assignedCount = 0;
  for (const perm of warehousePerms) {
    const existing = await prisma.rolePermission.findUnique({
      where: {
        roleId_permissionId: { roleId: warehouseRole.id, permissionId: perm.id },
      },
    });
    if (!existing) {
      await prisma.rolePermission.create({
        data: { roleId: warehouseRole.id, permissionId: perm.id },
      });
      assignedCount++;
    }
  }
  console.log(`✓ WAREHOUSE_STAFF role: ${assignedCount} new permissions assigned`);

  // CUSTOMER: Limited permissions
  const customerPerms = await prisma.permission.findMany({
    where: { name: { in: ['orders.read', 'products.read', 'customers.read'] } },
  });
  assignedCount = 0;
  for (const perm of customerPerms) {
    const existing = await prisma.rolePermission.findUnique({
      where: { roleId_permissionId: { roleId: customerRole.id, permissionId: perm.id } },
    });
    if (!existing) {
      await prisma.rolePermission.create({
        data: { roleId: customerRole.id, permissionId: perm.id },
      });
      assignedCount++;
    }
  }
  console.log(`✓ CUSTOMER role: ${assignedCount} new permissions assigned`);
}

/**
 * Verify default branches
 */
async function seedBranches() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Verifying Branches...');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const branches = await prisma.branch.findMany();
  if (branches.length === 0) {
    console.warn('⚠ No branches found. Please create branches manually.');
    return;
  }

  console.log(`✓ Found ${branches.length} branches:`);
  for (const branch of branches) {
    console.log(`  - ${branch.name} (${branch.branchCode}) [${branch.branchType}]`);
  }
}

/**
 * Display RBAC statistics
 */
async function displayStats() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('RBAC System Statistics');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const roles = await prisma.role.count();
  const perms = await prisma.permission.count();
  const rolePerms = await prisma.rolePermission.count();
  const branches = await prisma.branch.count();
  const userRoles = await (prisma as any).userRole.count();

  console.log(`Roles:              ${roles}`);
  console.log(`Permissions:        ${perms}`);
  console.log(`Role Permissions:   ${rolePerms}`);
  console.log(`Branches:           ${branches}`);
  console.log(`User-Role Assignments: ${userRoles}`);
}

// ─────────────────────────────────────────────────────────────
// MAIN EXECUTION
// ─────────────────────────────────────────────────────────────

async function main() {
  console.log('\n');
  console.log('╔════════════════════════════════════════╗');
  console.log('║   RBAC System Seed Script (v1.0)       ║');
  console.log('║   Mollari Dashboard                    ║');
  console.log('╚════════════════════════════════════════╝');

  try {
    await seedRoles();
    await seedPermissions();
    await seedRolePermissions();
    await seedBranches();
    await displayStats();

    console.log('\n✓ RBAC system initialization complete!\n');
    console.log('Available utility functions:');
    console.log('  - assignRoleToUser(userId, roleName, branchId?)');
    console.log('  - assignBranchToUser(userId, branchId, isPrimary?)');
    console.log('  - generateSKU(categoryId)');
    console.log('  - setupSKUSettings(categoryId, prefix)');
    console.log('  - getUserPermissions(userId)');
    console.log('  - userHasPermission(userId, resource, action)');
    console.log('');
  } catch (error) {
    console.error('\n✗ Error during seeding:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Export utility functions for use in other scripts
export {
  assignRoleToUser,
  assignBranchToUser,
  setupSKUSettings,
  generateSKU,
  getUserPermissions,
  userHasPermission,
};

main();

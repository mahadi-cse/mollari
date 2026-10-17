import { PrismaClient } from '@prisma/client';
import { assignRoleToUser, assignBranchToUser } from './seed-rbac';

const prisma = new PrismaClient();

async function main() {
  const admin = await prisma.user.findUnique({
    where: { email: 'admin@mollari.local' }
  });

  if (!admin) {
    console.log("Admin not found");
    return;
  }

  let branch = await prisma.branch.findFirst({
    where: { name: 'Dhaka Main' }
  });
  
  if (!branch) {
    branch = await prisma.branch.create({
      data: {
        name: 'Dhaka Main',
        branchCode: 'DHK-01',
        branchType: 'WAREHOUSE'
      }
    });
  }

  try {
    await assignRoleToUser(admin.id, 'ADMIN', branch.id);
  } catch (e) {
    console.log("Role assignment error or already assigned", e);
  }

  try {
    await assignBranchToUser(admin.id, branch.id, true);
  } catch (e) {
    console.log("Branch assignment error or already assigned", e);
  }

  console.log("Updated admin with roles and branches");
}

main().finally(() => prisma.$disconnect());

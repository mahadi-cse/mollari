import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DEFAULT_ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL || 'admin@mollari.local';
const DEFAULT_ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || 'Admin@12345';

async function main() {
  const systemAdminType = await prisma.userType.upsert({
    where: { code: '1x101' },
    update: { name: 'SYSTEM_ADMIN' },
    create: {
      code: '1x101',
      name: 'SYSTEM_ADMIN',
    },
  });

  const hashedPassword = await bcrypt.hash(DEFAULT_ADMIN_PASSWORD, Number(process.env.BCRYPT_ROUNDS || 12));

  const adminUser = await prisma.user.upsert({
    where: { email: DEFAULT_ADMIN_EMAIL.toLowerCase() },
    update: {
      password: hashedPassword,
      isActive: true,
      userTypeId: systemAdminType.id,
      firstName: 'System',
      lastName: 'Admin',
    },
    create: {
      email: DEFAULT_ADMIN_EMAIL.toLowerCase(),
      password: hashedPassword,
      userTypeId: systemAdminType.id,
      firstName: 'System',
      lastName: 'Admin',
      isActive: true,
    },
  });

  console.log('Admin auth seed complete.');
  console.log(`Email: ${adminUser.email}`);
  console.log(`Password: ${DEFAULT_ADMIN_PASSWORD}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

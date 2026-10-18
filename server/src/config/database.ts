import { PrismaClient } from '@prisma/client';

const globalForPrisma = global as unknown as { prisma: PrismaClient };

function buildDatabaseUrl(): string {
  const url = process.env.DATABASE_URL || '';
  const params = 'connection_limit=10&pool_timeout=10';
  return url.includes('?') ? `${url}&${params}` : `${url}?${params}`;
}

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    datasources: {
      db: { url: buildDatabaseUrl() },
    },
  });

if (process.env.NODE_ENV !== 'production' || process.env.VERCEL) {
  globalForPrisma.prisma = prisma;
}

export default prisma;

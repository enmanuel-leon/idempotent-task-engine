import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { env } from '../config/env.js';

const globalForPrisma = globalThis as typeof globalThis & {
  prisma?: PrismaClient;
};

const adapter = new PrismaPg(
  {
    connectionString: env.DATABASE_URL,
  },
  {
    schema: 'task_engine',
  },
);

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
  });

if (env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

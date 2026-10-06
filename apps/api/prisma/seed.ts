import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { env } from '../src/config/env.js';

const adapter = new PrismaPg(
  {
    connectionString: env.DATABASE_URL,
  },
  {
    schema: 'task_engine',
  },
);

const prisma = new PrismaClient({ adapter });

export const TEST_MERCHANT = {
  id: '00000000-0000-0000-0000-000000000001',
  apiKey: 'test_merchant_sec_key_12345',
  name: 'Acme Payments Corp',
  balanceCents: 1000000n, // $10,000.00
  currency: 'USD',
} as const;

async function main() {
  console.log('Seeding test merchant in task_engine schema...');
  const merchant = await prisma.merchantAccount.upsert({
    where: { apiKey: TEST_MERCHANT.apiKey },
    update: {
      name: TEST_MERCHANT.name,
      currency: TEST_MERCHANT.currency,
    },
    create: {
      id: TEST_MERCHANT.id,
      apiKey: TEST_MERCHANT.apiKey,
      name: TEST_MERCHANT.name,
      balanceCents: TEST_MERCHANT.balanceCents,
      currency: TEST_MERCHANT.currency,
    },
  });

  console.log('Seeded merchant successfully:', merchant.id, merchant.name);
}

try {
  await main();
} catch (e) {
  console.error('Failed to seed database:', e);
  process.exit(1);
} finally {
  await prisma.$disconnect();
}

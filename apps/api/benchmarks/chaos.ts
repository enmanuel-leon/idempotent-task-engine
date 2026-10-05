import autocannon from 'autocannon';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const TARGET_URL = process.env.BENCH_URL || 'http://localhost:3100/api/v1/webhooks/epayco';
const API_KEY = process.env.API_KEY || 'test_merchant_sec_key_12345';
const DB_URL =
  process.env.DATABASE_URL ||
  'postgresql://root:root@192.168.1.136:5434/app_template_db?schema=task_engine';

const KEY_POOL_SIZE = 100;
const DURATION_SECONDS = 10;
const keyPool: string[] = [];
for (let i = 0; i < KEY_POOL_SIZE; i++) {
  keyPool.push('chaos_key_' + i);
}

console.log('==========================================================');
console.log('SUITE B: CHAOS CONCURRENCY COLLISION BENCHMARK');
console.log(`Target: ${TARGET_URL}`);
console.log(`Rotating Idempotency Keys: ${KEY_POOL_SIZE} constrained keys`);
console.log(`Duration: ${DURATION_SECONDS}s | High Contention`);
console.log('==========================================================\n');

const instance = autocannon(
  {
    url: TARGET_URL,
    connections: 50,
    duration: DURATION_SECONDS,
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': API_KEY,
    },
    setupClient: (client) => {
      client.on('body', () => {
        const randomIndex = Math.floor(Math.random() * KEY_POOL_SIZE);
        const selectedKey = keyPool[randomIndex];
        client.setHeaders({
          'content-type': 'application/json',
          'x-api-key': API_KEY,
          'idempotency-key': selectedKey,
        });
        client.setBody(
          JSON.stringify({
            eventType: 'PAYMENT_SUCCEEDED',
            amountCents: 1000,
            reference: 'ref_' + selectedKey,
          }),
        );
      });
    },
  },
  async (err, result) => {
    if (err) {
      console.error('Collision benchmark error:', err);
      process.exit(1);
    }

    console.log(autocannon.printResult(result));

    console.log('--- Verifying Database Integrity in task_engine schema ---');
    const adapter = new PrismaPg({ connectionString: DB_URL }, { schema: 'task_engine' });
    const prisma = new PrismaClient({ adapter });

    try {
      const createdEvents = await prisma.webhookEvent.findMany({
        where: {
          idempotencyKey: {
            in: keyPool,
          },
        },
        include: {
          transaction: true,
        },
      });

      console.log(`Total Unique Webhook Events in Database: ${createdEvents.length}`);

      let duplicateTransactionCount = 0;
      const seenReferences = new Set<string>();

      for (const event of createdEvents) {
        if (event.transaction) {
          if (seenReferences.has(event.transaction.reference)) {
            duplicateTransactionCount += 1;
          }
          seenReferences.add(event.transaction.reference);
        }
      }

      console.log(`Unique Settled Transactions: ${seenReferences.size}`);
      console.log(`Duplicate Transactions Intercepted: ${duplicateTransactionCount}`);

      if (duplicateTransactionCount > 0) {
        console.error('CRITICAL FAILURE: Duplicate transaction records detected in database!');
        process.exit(1);
      }

      console.log(
        '\n>>> [SUCCESS] ZERO DUPLICATE TRANSACTIONS CREATED! IDEMPOTENCY 100% VERIFIED <<<',
      );
    } catch (dbErr) {
      console.error('Database verification failed:', dbErr);
    } finally {
      await prisma.$disconnect();
    }
  },
);

autocannon.track(instance, { renderProgressBar: true });

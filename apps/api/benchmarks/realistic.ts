import { randomUUID } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const TARGET_URL = process.env.BENCH_URL || 'http://localhost:3100/api/v1/webhooks/epayco';
const API_KEY = process.env.API_KEY || 'test_merchant_sec_key_12345';
const DB_URL =
  process.env.DATABASE_URL ||
  'postgresql://root:root@192.168.1.136:5434/app_template_db?schema=task_engine';

console.log('==========================================================');
console.log('SUITE C: REALISTIC HETEROGENEOUS MULTI-TENANT WORKLOAD');
console.log(`Target: ${TARGET_URL}`);
console.log('Dispatching heterogeneous transactions with intermittent duplicates');
console.log('==========================================================\n');

interface WorkloadItem {
  idempotencyKey: string;
  eventType: 'PAYMENT_SUCCEEDED' | 'CHARGE_REFUNDED';
  amountCents: number;
  reference: string;
  source: string;
  isDuplicate: boolean;
}

const SOURCES = ['ONLINE_CHECKOUT', 'POS_TERMINAL', 'RECURRING_BILLING', 'MOBILE_APP'];
const AMOUNTS = [1250, 2499, 4999, 8500, 12000, 25000, 45000];

async function runRealisticWorkload() {
  const workload: WorkloadItem[] = [];
  const baseCount = 20;

  for (let i = 0; i < baseCount; i++) {
    const key = 'real_' + randomUUID();
    const source = SOURCES[i % SOURCES.length];
    const amount = AMOUNTS[i % AMOUNTS.length];

    let eventType: 'PAYMENT_SUCCEEDED' | 'CHARGE_REFUNDED' = 'PAYMENT_SUCCEEDED';
    if (i % 7 === 0) {
      eventType = 'CHARGE_REFUNDED';
    }

    let calculatedAmount = amount;
    if (eventType === 'CHARGE_REFUNDED') {
      calculatedAmount = -amount;
    }

    const ref =
      'ord_' + source.toLowerCase() + '_' + i + '_' + Math.random().toString(36).substring(2, 7);

    workload.push({
      idempotencyKey: key,
      eventType,
      amountCents: calculatedAmount,
      reference: ref,
      source,
      isDuplicate: false,
    });
  }

  for (let j = 0; j < 10; j++) {
    const original = workload[j * 2];
    workload.push({
      idempotencyKey: original.idempotencyKey,
      eventType: original.eventType,
      amountCents: original.amountCents,
      reference: original.reference,
      source: original.source,
      isDuplicate: true,
    });
  }

  workload.sort(() => Math.random() - 0.5);

  console.log(
    `Dispatching ${workload.length} concurrent requests (20 unique + 10 intentional duplicates)...\n`,
  );

  const tStart = Date.now();
  const promises = workload.map(async (item) => {
    const reqStart = Date.now();
    try {
      const res = await fetch(TARGET_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'idempotency-key': item.idempotencyKey,
          'x-api-key': API_KEY,
        },
        body: JSON.stringify({
          eventType: item.eventType,
          amountCents: item.amountCents,
          reference: item.reference,
          metadata: {
            source: item.source,
            simulatedDuplicate: item.isDuplicate,
          },
        }),
      });

      return {
        status: res.status,
        cacheHeader: res.headers.get('x-cache'),
        durationMs: Date.now() - reqStart,
        isDuplicate: item.isDuplicate,
        reference: item.reference,
      };
    } catch {
      return {
        status: 500,
        cacheHeader: 'ERROR',
        durationMs: Date.now() - reqStart,
        isDuplicate: item.isDuplicate,
        reference: item.reference,
      };
    }
  });

  const results = await Promise.all(promises);
  const totalDuration = Date.now() - tStart;

  let cacheHits = 0;
  let leaderQueued = 0;
  let timeouts = 0;

  for (const r of results) {
    if (r.cacheHeader === 'HIT' || r.cacheHeader === 'HIT_CONCURRENT') {
      cacheHits += 1;
    } else if (r.status === 202) {
      leaderQueued += 1;
    } else if (r.status === 504) {
      timeouts += 1;
    }
  }

  console.log('--- Realistic Workload Results ---');
  console.log(`Total Time Elapsed: ${totalDuration}ms`);
  console.log(`Leaders Queued (HTTP 202): ${leaderQueued} (Expected: 20)`);
  console.log(`Duplicates Intercepted: ${cacheHits} (Expected: 10)`);
  if (timeouts > 0) {
    console.log(`Timeouts (HTTP 504): ${timeouts}`);
  }

  console.log('\nAwaiting 1500ms for worker transactional settlement in PostgreSQL...');
  await new Promise((resolve) => setTimeout(resolve, 1500));

  console.log('--- Verifying PostgreSQL Ledger in task_engine schema ---');
  const adapter = new PrismaPg({ connectionString: DB_URL }, { schema: 'task_engine' });
  const prisma = new PrismaClient({ adapter });

  try {
    const transactions = await prisma.transaction.findMany({
      where: {
        reference: {
          startsWith: 'ord_',
        },
      },
    });

    console.log(`Total Transaction Rows Created: ${transactions.length}`);

    const seenRefs = new Set<string>();
    let duplicates = 0;
    for (const tx of transactions) {
      if (seenRefs.has(tx.reference)) {
        duplicates += 1;
      }
      seenRefs.add(tx.reference);
    }

    console.log(`Unique Transactions Settled: ${seenRefs.size}`);
    console.log(`Duplicate Transactions Intercepted: ${duplicates}`);

    if (duplicates === 0) {
      console.log(
        '\n>>> [SUCCESS] ZERO DUPLICATE TRANSACTIONS! REALISTIC DEDUPLICATION VERIFIED <<<',
      );
    } else {
      console.error('\n>>> [FAILURE] DUPLICATE TRANSACTIONS DETECTED IN LEDGER <<<');
      process.exit(1);
    }
  } finally {
    await prisma.$disconnect();
  }
}

runRealisticWorkload().catch(console.error);

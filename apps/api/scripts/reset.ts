import { resetTaskEngineData } from '../src/services/admin.service.js';
import { prisma } from '../src/lib/prisma.js';

async function main() {
  console.log('========================================================');
  console.log('IDEMPOTENT TASK ENGINE — RESET CLI');
  console.log('Safe purge strictly within PostgreSQL task_engine schema');
  console.log('========================================================\n');

  try {
    const result = await resetTaskEngineData();
    console.log(`[OK] Deleted ${result.transactionsDeleted} transactions in task_engine schema.`);
    console.log(`[OK] Deleted ${result.eventsDeleted} webhook events.`);
    console.log(`[OK] Merchant settlement balance reset to $10,000.00.`);
    console.log(`[OK] Flushed ${result.redisKeysRemoved} Redis lock and response cache keys.`);
    console.log(`[OK] BullMQ primary and DLQ queues drained.`);
    console.log('\n>>> Database and cache clean! (public schema was 100% untouched) <<<');
  } catch (err) {
    console.error('[FAIL] Reset failed:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
}

await main();

import { prisma } from '../lib/prisma.js';
import { getRedisClient } from '../lib/redis.js';
import { webhooksIncomingQueue, webhooksDlqQueue } from '../lib/queue.js';
import { metricsService } from './metrics.service.js';
import { REDIS_PREFIXES } from '../constants/engine.constants.js';
import { logger } from '../config/logger.js';

const DEFAULT_RESET_BALANCE_CENTS = 1000000n; // $10,000.00
const TEST_MERCHANT_KEY = 'test_merchant_sec_key_12345';

export interface ResetResult {
  transactionsDeleted: number;
  eventsDeleted: number;
  merchantBalanceCents: string;
  redisKeysRemoved: number;
}

export async function resetTaskEngineData(): Promise<ResetResult> {
  logger.info('Executing safe purge within task_engine schema and Redis cache...');

  // 1. Safe PostgreSQL purge in task_engine schema
  const deletedTx = await prisma.transaction.deleteMany();
  const deletedEvents = await prisma.webhookEvent.deleteMany();

  await prisma.merchantAccount.upsert({
    where: { apiKey: TEST_MERCHANT_KEY },
    update: {
      balanceCents: DEFAULT_RESET_BALANCE_CENTS,
    },
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      apiKey: TEST_MERCHANT_KEY,
      name: 'Acme Payments Corp',
      balanceCents: DEFAULT_RESET_BALANCE_CENTS,
      currency: 'USD',
    },
  });

  // 2. Drain BullMQ queues
  try {
    await webhooksIncomingQueue.obliterate({ force: true });
  } catch {
    await webhooksIncomingQueue.drain(true);
    await webhooksIncomingQueue.clean(0, 5000, 'completed');
    await webhooksIncomingQueue.clean(0, 5000, 'failed');
  }

  try {
    await webhooksDlqQueue.obliterate({ force: true });
  } catch {
    await webhooksDlqQueue.drain(true);
    await webhooksDlqQueue.clean(0, 5000, 'completed');
    await webhooksDlqQueue.clean(0, 5000, 'failed');
  }

  // 3. Purge Redis locks and response cache
  let redisKeysRemoved = 0;
  const redis = getRedisClient();
  const patterns = [REDIS_PREFIXES.LOCK + '*', REDIS_PREFIXES.RESPONSE + '*'];

  for (const pattern of patterns) {
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      const deleted = await redis.del(...keys);
      redisKeysRemoved += deleted;
    }
  }

  // 4. Reset in-memory telemetry
  metricsService.reset();

  return {
    transactionsDeleted: deletedTx.count,
    eventsDeleted: deletedEvents.count,
    merchantBalanceCents: DEFAULT_RESET_BALANCE_CENTS.toString(),
    redisKeysRemoved,
  };
}

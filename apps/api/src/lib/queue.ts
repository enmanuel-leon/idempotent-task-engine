import { randomInt } from 'node:crypto';
import { Queue, type QueueOptions } from 'bullmq';
import { QUEUE_NAMES, ENGINE_LIMITS } from '../constants/engine.constants.js';
import { createRedisConnection } from './redis.js';

export function calculateFullJitterDelay(attemptsMade: number): number {
  const baseDelay = ENGINE_LIMITS.BASE_BACKOFF_DELAY_MS;
  const maxAttempts = ENGINE_LIMITS.MAX_RETRY_ATTEMPTS;
  let exponent = attemptsMade;
  if (exponent >= maxAttempts) {
    exponent = maxAttempts - 1;
  }
  if (exponent < 0) {
    exponent = 0;
  }
  const ceiling = Math.floor(baseDelay * Math.pow(2, exponent));
  return randomInt(0, Math.max(1, ceiling));
}

export interface WebhookJobData {
  merchantId: string;
  idempotencyKey: string;
  normalizedKey: string;
  eventType: string;
  amountCents: number;
  reference: string;
  payload: Record<string, unknown>;
  enqueuedAt: number;
}

const queueOptions: QueueOptions = {
  connection: createRedisConnection(),
  defaultJobOptions: {
    attempts: ENGINE_LIMITS.MAX_RETRY_ATTEMPTS,
    backoff: {
      type: 'custom',
    },
    removeOnComplete: {
      age: 86400, // keep 24h
      count: 5000,
    },
    removeOnFail: false,
  },
};

export const webhooksIncomingQueue = new Queue<WebhookJobData>(
  QUEUE_NAMES.WEBHOOKS_INCOMING,
  queueOptions,
);

export const webhooksDlqQueue = new Queue<WebhookJobData>(QUEUE_NAMES.WEBHOOKS_DLQ, queueOptions);

export const QUEUE_NAMES = {
  WEBHOOKS_INCOMING: 'webhooks-incoming',
  WEBHOOKS_DLQ: 'webhooks-dlq',
} as const;

export const REDIS_PREFIXES = {
  LOCK: 'lock:',
  RESPONSE: 'response:',
  CHANNEL: 'complete:',
} as const;

export const ENGINE_LIMITS = {
  LOCK_TTL_SECONDS: 45,
  CACHE_TTL_SECONDS: 86400, // 24 hours
  SUBSCRIBER_TIMEOUT_MS: 3000,
  MAX_RETRY_ATTEMPTS: 5,
  BASE_BACKOFF_DELAY_MS: 1000,
  WORKER_CONCURRENCY: 20,
} as const;

export const WEBHOOK_STATUS = {
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  COMPLETED: 'COMPLETED',
  DEAD_LETTER: 'DEAD_LETTER',
} as const;

export type WebhookStatus = (typeof WEBHOOK_STATUS)[keyof typeof WEBHOOK_STATUS];

export const EVENT_TYPES = {
  PAYMENT_SUCCEEDED: 'PAYMENT_SUCCEEDED',
  PAYMENT_FAILED: 'PAYMENT_FAILED',
  CHARGE_REFUNDED: 'CHARGE_REFUNDED',
} as const;

export type EventType = (typeof EVENT_TYPES)[keyof typeof EVENT_TYPES];

export const CACHE_STATUS = {
  HIT: 'HIT',
  MISS: 'MISS',
  HIT_CONCURRENT: 'HIT_CONCURRENT',
} as const;

export type CacheStatus = (typeof CACHE_STATUS)[keyof typeof CACHE_STATUS];

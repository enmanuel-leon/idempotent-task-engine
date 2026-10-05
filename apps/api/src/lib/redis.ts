import { Redis, type RedisOptions } from 'ioredis';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

const redisOptions: RedisOptions = {
  maxRetriesPerRequest: null,
  lazyConnect: true,
  enableReadyCheck: false,
};

let primaryClient: Redis | null = null;
let subscriberClient: Redis | null = null;

if (env.REDIS_URL) {
  primaryClient = new Redis(env.REDIS_URL, redisOptions);
  subscriberClient = new Redis(env.REDIS_URL, redisOptions);

  primaryClient.on('error', (err) => {
    logger.error({ err }, 'Primary Redis connection error');
  });

  subscriberClient.on('error', (err) => {
    logger.error({ err }, 'Subscriber Redis connection error');
  });
}

export function getRedisClient(): Redis {
  if (!primaryClient) {
    throw new Error('Redis primary client is not initialized');
  }
  return primaryClient;
}

export function getRedisSubscriberClient(): Redis {
  if (!subscriberClient) {
    throw new Error('Redis subscriber client is not initialized');
  }
  return subscriberClient;
}

export function createRedisConnection(): Redis {
  return new Redis(env.REDIS_URL, redisOptions);
}

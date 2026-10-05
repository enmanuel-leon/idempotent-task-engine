import { createHash } from 'node:crypto';
import { getRedisClient, getRedisSubscriberClient } from '../lib/redis.js';
import { REDIS_PREFIXES, ENGINE_LIMITS } from '../constants/engine.constants.js';
import { logger } from '../config/logger.js';

const RELEASE_LOCK_LUA = `
  if redis.call("get", KEYS[1]) == ARGV[1] then
    return redis.call("del", KEYS[1])
  else
    return 0
  end
`;

class IdempotencyService {
  public normalizeKey(merchantId: string, idempotencyKey: string): string {
    const raw = merchantId + ':' + idempotencyKey;
    return createHash('sha256').update(raw).digest('hex');
  }

  public async getCachedResponse(normalizedKey: string): Promise<Record<string, unknown> | null> {
    const redis = getRedisClient();
    const cacheKey = REDIS_PREFIXES.RESPONSE + normalizedKey;
    const cached = await redis.get(cacheKey);
    if (!cached) {
      return null;
    }

    try {
      return JSON.parse(cached) as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  public async saveCachedResponse(
    normalizedKey: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const redis = getRedisClient();
    const cacheKey = REDIS_PREFIXES.RESPONSE + normalizedKey;
    await redis.set(cacheKey, JSON.stringify(payload), 'EX', ENGINE_LIMITS.CACHE_TTL_SECONDS);
  }

  public async acquireLock(normalizedKey: string, lockToken: string): Promise<boolean> {
    const redis = getRedisClient();
    const lockKey = REDIS_PREFIXES.LOCK + normalizedKey;
    const result = await redis.set(lockKey, lockToken, 'EX', ENGINE_LIMITS.LOCK_TTL_SECONDS, 'NX');
    return result === 'OK';
  }

  public async releaseLock(normalizedKey: string, lockToken: string): Promise<void> {
    const redis = getRedisClient();
    const lockKey = REDIS_PREFIXES.LOCK + normalizedKey;
    try {
      await redis.eval(RELEASE_LOCK_LUA, 1, lockKey, lockToken);
    } catch (err) {
      logger.error({ err, lockKey }, 'Failed to release redis lock via Lua');
    }
  }

  public async publishCompletion(
    normalizedKey: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const redis = getRedisClient();
    const channel = REDIS_PREFIXES.CHANNEL + normalizedKey;
    await redis.publish(channel, JSON.stringify(payload));
  }

  public async waitForCompletion(
    normalizedKey: string,
    timeoutMs: number,
  ): Promise<Record<string, unknown> | null> {
    const subscriber = getRedisSubscriberClient();
    const channel = REDIS_PREFIXES.CHANNEL + normalizedKey;

    await subscriber.subscribe(channel);

    // Double check cache in case worker completed during subscription registration
    const fastCheck = await this.getCachedResponse(normalizedKey);
    if (fastCheck) {
      await subscriber.unsubscribe(channel);
      return fastCheck;
    }

    return new Promise<Record<string, unknown> | null>((resolve) => {
      let isResolved = false;

      const timer = setTimeout(async () => {
        if (!isResolved) {
          isResolved = true;
          subscriber.off('message', onMessage);
          try {
            await subscriber.unsubscribe(channel);
          } catch {
            // Unsubscribe cleanup error ignored
          }
          resolve(null);
        }
      }, timeoutMs);

      const onMessage = async (incomingChannel: string, message: string) => {
        if (incomingChannel === channel && !isResolved) {
          isResolved = true;
          clearTimeout(timer);
          subscriber.off('message', onMessage);
          try {
            await subscriber.unsubscribe(channel);
          } catch {
            // Unsubscribe cleanup error ignored
          }
          try {
            resolve(JSON.parse(message) as Record<string, unknown>);
          } catch {
            resolve(null);
          }
        }
      };

      subscriber.on('message', onMessage);
    });
  }
}

export const idempotencyService = new IdempotencyService();

import { describe, expect, it, afterEach } from 'vitest';
import { randomUUID } from 'node:crypto';
import { idempotencyService } from '../../src/services/idempotency.service.js';
import { getRedisClient, getRedisSubscriberClient } from '../../src/lib/redis.js';
import { REDIS_PREFIXES, ENGINE_LIMITS } from '../../src/constants/engine.constants.js';

describe('IdempotencyService', () => {
  const testKeysToCleanup: string[] = [];

  afterEach(async () => {
    const redis = getRedisClient();
    while (testKeysToCleanup.length > 0) {
      const key = testKeysToCleanup.pop();
      if (key) {
        await redis.del(key);
      }
    }
  });

  describe('Payload Normalization & Deduplication Determinism', () => {
    it('should normalize merchant ID and idempotency key deterministically', () => {
      const key1 = idempotencyService.normalizeKey('merchant_1', 'key_abc');
      const key2 = idempotencyService.normalizeKey('merchant_1', 'key_abc');
      const key3 = idempotencyService.normalizeKey('merchant_2', 'key_abc');

      expect(key1).toBe(key2);
      expect(key1).toHaveLength(64);
      expect(key1).not.toBe(key3);
    });
  });

  describe('Response Caching & Safe Deserialization', () => {
    it('should save and retrieve cached response with roundtrip integrity', async () => {
      const normalizedKey = 'test-cache-' + randomUUID();
      const redis = getRedisClient();
      testKeysToCleanup.push(REDIS_PREFIXES.RESPONSE + normalizedKey);

      const payload = {
        success: true,
        reference: 'REF-12345',
        amountCents: 5000,
      };

      await idempotencyService.saveCachedResponse(normalizedKey, payload);
      const retrieved = await idempotencyService.getCachedResponse(normalizedKey);

      expect(retrieved).toEqual(payload);
    });

    it('should return null for non-existent cache keys', async () => {
      const missingKey = 'non-existent-' + randomUUID();
      const result = await idempotencyService.getCachedResponse(missingKey);
      expect(result).toBeNull();
    });

    it('should gracefully return null if cached value is corrupted JSON', async () => {
      const normalizedKey = 'corrupt-cache-' + randomUUID();
      const redis = getRedisClient();
      const fullKey = REDIS_PREFIXES.RESPONSE + normalizedKey;
      testKeysToCleanup.push(fullKey);

      await redis.set(fullKey, 'NOT_VALID_JSON{:::');
      const result = await idempotencyService.getCachedResponse(normalizedKey);
      expect(result).toBeNull();
    });
  });

  describe('Distributed Lock TTL & Mutex Isolation', () => {
    it('should acquire lock for leader and reject concurrent acquisition', async () => {
      const normalizedKey = 'lock-mutex-' + randomUUID();
      const token1 = randomUUID();
      const token2 = randomUUID();
      testKeysToCleanup.push(REDIS_PREFIXES.LOCK + normalizedKey);

      const firstAcquisition = await idempotencyService.acquireLock(normalizedKey, token1);
      const secondAcquisition = await idempotencyService.acquireLock(normalizedKey, token2);

      expect(firstAcquisition).toBe(true);
      expect(secondAcquisition).toBe(false);
    });

    it('should enforce Redis TTL on acquired locks to prevent permanent deadlocks', async () => {
      const normalizedKey = 'lock-ttl-' + randomUUID();
      const token = randomUUID();
      const fullLockKey = REDIS_PREFIXES.LOCK + normalizedKey;
      testKeysToCleanup.push(fullLockKey);

      await idempotencyService.acquireLock(normalizedKey, token);
      const redis = getRedisClient();
      const ttl = await redis.ttl(fullLockKey);

      expect(ttl).toBeGreaterThan(0);
      expect(ttl).toBeLessThanOrEqual(ENGINE_LIMITS.LOCK_TTL_SECONDS);
    });

    it('should only release lock when provided with matching token (Lua atomicity)', async () => {
      const normalizedKey = 'lock-release-' + randomUUID();
      const validToken = randomUUID();
      const wrongToken = randomUUID();
      const fullLockKey = REDIS_PREFIXES.LOCK + normalizedKey;
      testKeysToCleanup.push(fullLockKey);

      await idempotencyService.acquireLock(normalizedKey, validToken);

      // Attempt release with wrong token
      await idempotencyService.releaseLock(normalizedKey, wrongToken);
      const redis = getRedisClient();
      const lockValAfterWrong = await redis.get(fullLockKey);
      expect(lockValAfterWrong).toBe(validToken);

      // Release with correct token
      await idempotencyService.releaseLock(normalizedKey, validToken);
      const lockValAfterValid = await redis.get(fullLockKey);
      expect(lockValAfterValid).toBeNull();
    });
  });

  describe('Race Condition Timeouts & Subscriber Cleanup', () => {
    it('should timeout cleanly and return null when leader does not publish completion', async () => {
      const normalizedKey = 'timeout-test-' + randomUUID();
      const timeoutMs = 80;

      const startTime = Date.now();
      const result = await idempotencyService.waitForCompletion(normalizedKey, timeoutMs);
      const duration = Date.now() - startTime;

      expect(result).toBeNull();
      expect(duration).toBeGreaterThanOrEqual(70);
    });

    it('should unregister message listener and avoid listener leaks on completion', async () => {
      const subscriber = getRedisSubscriberClient();
      const initialListeners = subscriber.listenerCount('message');

      const normalizedKey = 'cleanup-leak-' + randomUUID();
      const payload = { cleaned: true };

      const waitPromise = idempotencyService.waitForCompletion(normalizedKey, 1000);

      // Give event loop tick to register
      await new Promise((r) => setTimeout(r, 20));
      await idempotencyService.publishCompletion(normalizedKey, payload);
      await waitPromise;

      const finalListeners = subscriber.listenerCount('message');
      expect(finalListeners).toBe(initialListeners);
    });

    it('should unregister message listener and avoid listener leaks on timeout', async () => {
      const subscriber = getRedisSubscriberClient();
      const initialListeners = subscriber.listenerCount('message');

      const normalizedKey = 'cleanup-leak-timeout-' + randomUUID();
      await idempotencyService.waitForCompletion(normalizedKey, 40);

      const finalListeners = subscriber.listenerCount('message');
      expect(finalListeners).toBe(initialListeners);
    });

    it('should immediately return cached response via double-check path without waiting', async () => {
      const normalizedKey = 'fast-doublecheck-' + randomUUID();
      const cachedPayload = { instant: true, source: 'cache' };
      testKeysToCleanup.push(REDIS_PREFIXES.RESPONSE + normalizedKey);

      await idempotencyService.saveCachedResponse(normalizedKey, cachedPayload);

      const startTime = Date.now();
      const result = await idempotencyService.waitForCompletion(normalizedKey, 2000);
      const elapsed = Date.now() - startTime;

      expect(result).toEqual(cachedPayload);
      expect(elapsed).toBeLessThan(100);
    });
  });
});

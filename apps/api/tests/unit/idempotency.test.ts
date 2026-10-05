import { describe, expect, it } from 'vitest';
import { idempotencyService } from '../../src/services/idempotency.service.js';

describe('IdempotencyService', () => {
  it('should normalize merchant ID and idempotency key deterministically', () => {
    const key1 = idempotencyService.normalizeKey('merchant_1', 'key_abc');
    const key2 = idempotencyService.normalizeKey('merchant_1', 'key_abc');
    const key3 = idempotencyService.normalizeKey('merchant_2', 'key_abc');

    expect(key1).toBe(key2);
    expect(key1).toHaveLength(64); // sha256 hex
    expect(key1).not.toBe(key3);
  });
});

import { describe, expect, it } from 'vitest';
import { calculateFullJitterDelay } from '../../src/lib/queue.js';

describe('calculateFullJitterDelay', () => {
  it('should return a number between 0 and 1000 for attempt 0', () => {
    for (let i = 0; i < 50; i++) {
      const delay = calculateFullJitterDelay(0);
      expect(delay).toBeGreaterThanOrEqual(0);
      expect(delay).toBeLessThanOrEqual(1000);
    }
  });

  it('should return a number between 0 and 2000 for attempt 1', () => {
    for (let i = 0; i < 50; i++) {
      const delay = calculateFullJitterDelay(1);
      expect(delay).toBeGreaterThanOrEqual(0);
      expect(delay).toBeLessThanOrEqual(2000);
    }
  });

  it('should cap exponent at max retry attempts (16000ms ceiling for attempt 10)', () => {
    for (let i = 0; i < 50; i++) {
      const delay = calculateFullJitterDelay(10);
      expect(delay).toBeGreaterThanOrEqual(0);
      expect(delay).toBeLessThanOrEqual(16000);
    }
  });

  it('should handle negative attempts safely', () => {
    const delay = calculateFullJitterDelay(-2);
    expect(delay).toBeGreaterThanOrEqual(0);
    expect(delay).toBeLessThanOrEqual(1000);
  });
});

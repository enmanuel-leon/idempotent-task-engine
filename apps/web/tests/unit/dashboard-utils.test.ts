import { describe, it, expect } from 'vitest';
import {
  generateRandomId,
  cryptoShuffle,
  calculatePercentile,
  generateRealisticDataset,
  calculateExecutionStats,
} from '../../src/pages/dashboard/dashboard.utils';
import type { ExecutionResultItem } from '../../src/pages/dashboard/dashboard.utils';

describe('dashboard.utils', () => {
  describe('generateRandomId', () => {
    it('generates random ID with prefix and default length', () => {
      const id = generateRandomId('prefix_');
      expect(id.startsWith('prefix_')).toBe(true);
      expect(id).toHaveLength(7 + 8);
    });

    it('generates random ID with custom length', () => {
      const id = generateRandomId('test_', 12);
      expect(id.startsWith('test_')).toBe(true);
      expect(id).toHaveLength(5 + 12);
    });

    it('generates distinct IDs on consecutive calls', () => {
      const id1 = generateRandomId('id_');
      const id2 = generateRandomId('id_');
      expect(id1).not.toBe(id2);
    });
  });

  describe('cryptoShuffle', () => {
    it('preserves array length and all items', () => {
      const original = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const shuffled = cryptoShuffle(original);
      expect(shuffled).toHaveLength(original.length);
      expect(shuffled.slice().sort((a, b) => a - b)).toEqual(original);
    });

    it('does not mutate the source array in place', () => {
      const original = [10, 20, 30, 40];
      const copy = [...original];
      cryptoShuffle(original);
      expect(original).toEqual(copy);
    });

    it('handles empty and single-element arrays', () => {
      const empty: number[] = [];
      expect(cryptoShuffle(empty)).toHaveLength(0);

      const single = [42];
      const shuffledSingle = cryptoShuffle(single);
      expect(shuffledSingle).toHaveLength(1);
      expect(shuffledSingle[0]).toBe(42);
    });
  });

  describe('calculatePercentile', () => {
    it('returns 0 for empty array', () => {
      expect(calculatePercentile([], 95)).toBe(0);
    });

    it('returns the item value for single item array', () => {
      expect(calculatePercentile([42], 50)).toBe(42);
      expect(calculatePercentile([42], 99)).toBe(42);
    });

    it('calculates expected percentiles for multiple values', () => {
      const values = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
      expect(calculatePercentile(values, 50)).toBe(50);
      expect(calculatePercentile(values, 95)).toBe(100);
      expect(calculatePercentile(values, 10)).toBe(10);
    });
  });

  describe('generateRealisticDataset', () => {
    it('generates requested total volume', () => {
      const volume = 20;
      const dupRatio = 20;
      const dataset = generateRealisticDataset(volume, dupRatio);
      expect(dataset).toHaveLength(volume);
    });

    it('contains unique items and duplicates according to dupRatio', () => {
      const volume = 30;
      const dupRatio = 30;
      const dataset = generateRealisticDataset(volume, dupRatio);
      const keys = dataset.map((item) => item.key);
      const uniqueKeys = new Set(keys);
      expect(uniqueKeys.size).toBeLessThan(volume);
      expect(uniqueKeys.size).toBeGreaterThan(0);
    });

    it('generates negative amounts for charge refunds', () => {
      const dataset = generateRealisticDataset(25, 10);
      const refunds = dataset.filter((item) => item.type === 'CHARGE_REFUNDED');
      expect(refunds).not.toHaveLength(0);
      for (const refund of refunds) {
        expect(refund.amount).toBeLessThan(0);
      }
    });

    it('assigns positive amounts for payment succeeded events', () => {
      const dataset = generateRealisticDataset(25, 10);
      const payments = dataset.filter((item) => item.type === 'PAYMENT_SUCCEEDED');
      expect(payments).not.toHaveLength(0);
      for (const payment of payments) {
        expect(payment.amount).toBeGreaterThan(0);
      }
    });
  });

  describe('calculateExecutionStats', () => {
    it('calculates execution stats with hits, concurrent hits, timeouts, and leaders', () => {
      const results: ExecutionResultItem[] = [
        { status: 202, cacheHeader: null, duration: 120 },
        { status: 200, cacheHeader: 'HIT', duration: 15 },
        { status: 202, cacheHeader: 'HIT_CONCURRENT', duration: 45 },
        { status: 504, cacheHeader: null, duration: 3000 },
        { status: 202, cacheHeader: null, duration: 110 },
      ];

      const summary = calculateExecutionStats({
        scenarioName: 'Test Scenario',
        totalRequests: 5,
        results,
        totalDurationMs: 1000,
      });

      expect(summary.scenarioName).toBe('Test Scenario');
      expect(summary.totalRequests).toBe(5);
      expect(summary.leadersQueued).toBe(2);
      expect(summary.duplicatesIntercepted).toBe(3);
      expect(summary.dedupEfficiency).toBe(60.0);
      expect(summary.effectiveRps).toBe(5.0);
      expect(summary.p95LatencyMs).toBe(3000);
      expect(summary.p99LatencyMs).toBe(3000);
      expect(summary.timestamp).toBeDefined();
    });

    it('handles zero totalDurationMs and zero totalRequests safely', () => {
      const summary = calculateExecutionStats({
        scenarioName: 'Empty Scenario',
        totalRequests: 0,
        results: [],
        totalDurationMs: 0,
      });

      expect(summary.totalRequests).toBe(0);
      expect(summary.leadersQueued).toBe(0);
      expect(summary.duplicatesIntercepted).toBe(0);
      expect(summary.effectiveRps).toBe(0);
      expect(summary.dedupEfficiency).toBe(0);
      expect(summary.p95LatencyMs).toBe(0);
    });
  });
});

import { describe, expect, it } from 'vitest';
import { formatCentsToCurrency, formatSignedCents, cn } from '../../src/lib/utils';

describe('formatCentsToCurrency', () => {
  it('divides integer cents by 100 at presentation boundary', () => {
    expect(formatCentsToCurrency(1000)).toBe('$10.00');
    expect(formatCentsToCurrency(5000)).toBe('$50.00');
    expect(formatCentsToCurrency(0)).toBe('$0.00');
    expect(formatCentsToCurrency(123456)).toBe('$1,234.56');
  });

  it('handles string cents input safely', () => {
    expect(formatCentsToCurrency('2500')).toBe('$25.00');
  });

  it('handles bigint cents input safely', () => {
    expect(formatCentsToCurrency(1000000n)).toBe('$10,000.00');
  });
});

describe('cn', () => {
  it('merges class names correctly', () => {
    expect(cn('px-2', 'py-1')).toBe('px-2 py-1');
    expect(cn('px-2', false && 'hidden', 'py-1')).toBe('px-2 py-1');
  });
});

describe('formatSignedCents', () => {
  it('formats positive cents with a plus sign', () => {
    const res = formatSignedCents(5000);
    expect(res.formatted).toBe('+$50.00');
    expect(res.isNegative).toBe(false);
  });

  it('formats negative cents cleanly with minus sign without double plus', () => {
    const res = formatSignedCents(-25000);
    expect(res.formatted).toBe('-$250.00');
    expect(res.isNegative).toBe(true);
  });

  it('formats zero cents without plus sign', () => {
    const res = formatSignedCents(0);
    expect(res.formatted).toBe('$0.00');
    expect(res.isNegative).toBe(false);
  });
});

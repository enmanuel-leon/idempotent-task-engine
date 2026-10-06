export interface RealisticItem {
  key: string;
  ref: string;
  amount: number;
  type: 'PAYMENT_SUCCEEDED' | 'CHARGE_REFUNDED';
  source: string;
}

export interface ExecutionResultItem {
  status: number;
  cacheHeader: string | null;
  duration: number;
}

export interface ComputeStatsParams {
  scenarioName: string;
  totalRequests: number;
  results: ExecutionResultItem[];
  totalDurationMs: number;
}

export interface ExecutionSummary {
  scenarioName: string;
  totalRequests: number;
  leadersQueued: number;
  duplicatesIntercepted: number;
  dedupEfficiency: number;
  totalDurationMs: number;
  effectiveRps: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  timestamp: string;
}

const SOURCES = ['ONLINE_CHECKOUT', 'POS_TERMINAL', 'RECURRING_BILLING', 'MOBILE_APP'];
const AMOUNTS = [1250, 2499, 4999, 8500, 12000, 25000, 45000];

export function generateRandomId(prefix: string, length = 8): string {
  const uuid = crypto.randomUUID().replaceAll('-', '');
  return prefix + uuid.slice(0, length);
}

export function cryptoShuffle<T>(array: T[]): T[] {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i--) {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    const j = buf[0] % (i + 1);
    const temp = copy[i];
    copy[i] = copy[j];
    copy[j] = temp;
  }
  return copy;
}

export function calculatePercentile(numbers: number[], p: number): number {
  if (numbers.length === 0) {
    return 0;
  }
  const sorted = [...numbers].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  const safeIdx = Math.max(0, Math.min(index, sorted.length - 1));
  return sorted[safeIdx];
}

export function generateRealisticDataset(volume: number, dupRatio: number): RealisticItem[] {
  const duplicateCount = Math.max(1, Math.round(volume * (dupRatio / 100)));
  const uniqueCount = Math.max(1, volume - duplicateCount);

  const items: RealisticItem[] = [];
  for (let i = 0; i < uniqueCount; i++) {
    const source = SOURCES[i % SOURCES.length];
    const amount = AMOUNTS[i % AMOUNTS.length];
    let type: 'PAYMENT_SUCCEEDED' | 'CHARGE_REFUNDED' = 'PAYMENT_SUCCEEDED';
    let finalAmount = amount;
    if (i % 5 === 0) {
      type = 'CHARGE_REFUNDED';
      finalAmount = -amount;
    }

    items.push({
      key: generateRandomId('real_'),
      ref: 'ord_' + source.toLowerCase() + '_' + i + '_' + generateRandomId('', 5),
      amount: finalAmount,
      type,
      source,
    });
  }

  for (let j = 0; j < duplicateCount; j++) {
    const targetIdx = j % items.length;
    const orig = items[targetIdx];
    items.push({
      key: orig.key,
      ref: orig.ref,
      amount: orig.amount,
      type: orig.type,
      source: orig.source,
    });
  }

  return cryptoShuffle(items);
}

export function calculateExecutionStats(params: Readonly<ComputeStatsParams>): ExecutionSummary {
  const { scenarioName, totalRequests, results, totalDurationMs } = params;
  const durations = results.map((r) => r.duration);

  let duplicatesIntercepted = 0;
  let leadersQueued = 0;

  for (const r of results) {
    if (r.cacheHeader === 'HIT' || r.cacheHeader === 'HIT_CONCURRENT' || r.status === 504) {
      duplicatesIntercepted += 1;
    } else {
      leadersQueued += 1;
    }
  }

  let effectiveRps = 0;
  if (totalDurationMs > 0) {
    effectiveRps = Math.round((totalRequests / (totalDurationMs / 1000)) * 10) / 10;
  }

  let dedupEfficiency = 0;
  if (totalRequests > 0) {
    dedupEfficiency = Math.round((duplicatesIntercepted / totalRequests) * 1000) / 10;
  }

  return {
    scenarioName,
    totalRequests,
    leadersQueued,
    duplicatesIntercepted,
    dedupEfficiency,
    totalDurationMs,
    effectiveRps,
    p95LatencyMs: calculatePercentile(durations, 95),
    p99LatencyMs: calculatePercentile(durations, 99),
    timestamp: new Date().toLocaleTimeString(),
  };
}

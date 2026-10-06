import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useSseMetrics } from '../../hooks/use-sse-metrics';
import { apiFetch } from '../../lib/api-client';

interface MerchantInfo {
  id: string;
  name: string;
  apiKey: string;
  balanceCents: string;
  currency: string;
}

interface TransactionItem {
  id: string;
  reference: string;
  amountCents: string;
  createdAt: string;
  eventType: string;
  idempotencyKey: string;
  status: string;
}

interface TransactionsResponse {
  data: TransactionItem[];
  pagination: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
}

interface WebhookEventItem {
  id: string;
  merchantId: string;
  idempotencyKey: string;
  eventType: string;
  status: string;
  attempts: number;
  lastError: string | null;
  processedAt: string | null;
  createdAt: string;
  amountCents: string;
  reference: string;
}

interface EventsResponse {
  data: WebhookEventItem[];
  pagination: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
}

interface ResetResponse {
  success: boolean;
  transactionsDeleted: number;
  eventsDeleted: number;
  merchantBalanceCents: string;
  redisKeysRemoved: number;
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

function generateRandomId(prefix: string, length = 8): string {
  const uuid = crypto.randomUUID().replaceAll('-', '');
  return prefix + uuid.slice(0, length);
}

function cryptoShuffle<T>(array: T[]): T[] {
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

function calculatePercentile(numbers: number[], p: number): number {
  if (numbers.length === 0) {
    return 0;
  }
  const sorted = [...numbers].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  const safeIdx = Math.max(0, Math.min(index, sorted.length - 1));
  return sorted[safeIdx];
}

interface RealisticItem {
  key: string;
  ref: string;
  amount: number;
  type: 'PAYMENT_SUCCEEDED' | 'CHARGE_REFUNDED';
  source: string;
}

const SOURCES = ['ONLINE_CHECKOUT', 'POS_TERMINAL', 'RECURRING_BILLING', 'MOBILE_APP'];
const AMOUNTS = [1250, 2499, 4999, 8500, 12000, 25000, 45000];

function generateRealisticDataset(volume: number, dupRatio: number): RealisticItem[] {
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

interface ExecutionResultItem {
  status: number;
  cacheHeader: string | null;
  duration: number;
}

interface ComputeStatsParams {
  scenarioName: string;
  totalRequests: number;
  results: ExecutionResultItem[];
  totalDurationMs: number;
}

function calculateExecutionStats(params: Readonly<ComputeStatsParams>): ExecutionSummary {
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

export function useDashboardPage() {
  const [page, setPage] = useState(1);
  const [eventsPage, setEventsPage] = useState(1);
  const [activeTab, setActiveTab] = useState<'live' | 'historical'>('live');

  // Scenario B Concurrency
  const [burstConcurrency, setBurstConcurrency] = useState(10);

  // Scenario C Parametric Controls
  const [realisticVolume, setRealisticVolume] = useState(30);
  const [realisticDupRatio, setRealisticDupRatio] = useState(25); // percentage: 10, 25, 50

  const [isSimulatingBurst, setIsSimulatingBurst] = useState(false);
  const [isSimulatingScenarioA, setIsSimulatingScenarioA] = useState(false);
  const [isSimulatingRealistic, setIsSimulatingRealistic] = useState(false);

  // Last Execution Summary State
  const [lastExecutionSummary, setLastExecutionSummary] = useState<ExecutionSummary | null>(null);

  // Confirmation Modals State
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  const [isReplayDlqConfirmOpen, setIsReplayDlqConfirmOpen] = useState(false);
  const [isBurstConfirmOpen, setIsBurstConfirmOpen] = useState(false);

  const pageSize = 8;
  const queryClient = useQueryClient();
  const { metrics, isConnected } = useSseMetrics();

  const merchantQuery = useQuery({
    queryKey: ['merchant'],
    queryFn: () => apiFetch<MerchantInfo>('/api/v1/merchant'),
    staleTime: 60000,
  });

  const transactionsQuery = useQuery({
    queryKey: ['transactions', page],
    queryFn: () =>
      apiFetch<TransactionsResponse>(`/api/v1/transactions?page=${page}&pageSize=${pageSize}`),
    staleTime: 30000,
  });

  const eventsQuery = useQuery({
    queryKey: ['events', eventsPage],
    queryFn: () =>
      apiFetch<EventsResponse>(`/api/v1/events?page=${eventsPage}&pageSize=${pageSize}`),
    staleTime: 30000,
  });

  const toggleFlakyGatewayMutation = useMutation({
    mutationFn: (enabled: boolean) =>
      apiFetch('/api/v1/chaos/flaky-gateway', {
        method: 'POST',
        body: JSON.stringify({ enabled }),
      }),
    onSuccess: () => {
      toast.success('Downstream Gateway Chaos status updated');
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const toggleDbLatencyMutation = useMutation({
    mutationFn: (enabled: boolean) =>
      apiFetch('/api/v1/chaos/db-latency', {
        method: 'POST',
        body: JSON.stringify({ enabled }),
      }),
    onSuccess: () => {
      toast.success('Database Latency Spike Chaos status updated');
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const replayDlqMutation = useMutation({
    mutationFn: () =>
      apiFetch<{ success: boolean; replayedCount: number }>('/api/v1/admin/dlq/replay', {
        method: 'POST',
      }),
    onSuccess: (data) => {
      toast.success(`Replayed ${data.replayedCount} DLQ jobs back into incoming queue`);
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['merchant'] });
      setIsReplayDlqConfirmOpen(false);
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const resetDataMutation = useMutation({
    mutationFn: () =>
      apiFetch<ResetResponse>('/api/v1/admin/reset', {
        method: 'POST',
      }),
    onSuccess: (data) => {
      toast.success(
        `Test data purged: ${data.transactionsDeleted} transactions removed, balance reset to $10,000.00`,
      );
      setLastExecutionSummary(null);
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['merchant'] });
      setIsResetConfirmOpen(false);
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const handleRunScenarioA = async () => {
    if (!merchantQuery.data) {
      toast.error('Merchant credentials not loaded');
      return;
    }

    setIsSimulatingScenarioA(true);
    const key = generateRandomId('seq_');
    const ref = generateRandomId('ref_seq_');
    const apiKey = merchantQuery.data.apiKey;

    const tGlobalStart = Date.now();
    const durations: number[] = [];

    try {
      const t1 = Date.now();
      const res1 = await fetch('/api/v1/webhooks/epayco', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'idempotency-key': key,
          'x-api-key': apiKey,
        },
        body: JSON.stringify({
          eventType: 'PAYMENT_SUCCEEDED',
          amountCents: 2500,
          reference: ref,
          metadata: { scenario: 'A' },
        }),
      });
      durations.push(Date.now() - t1);

      const cacheHeader1 = res1.headers.get('x-cache');
      await new Promise((resolve) => setTimeout(resolve, 350));

      const t2 = Date.now();
      const res2 = await fetch('/api/v1/webhooks/epayco', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'idempotency-key': key,
          'x-api-key': apiKey,
        },
        body: JSON.stringify({
          eventType: 'PAYMENT_SUCCEEDED',
          amountCents: 2500,
          reference: ref,
          metadata: { scenario: 'A' },
        }),
      });
      const tDuration2 = Date.now() - t2;
      durations.push(tDuration2);
      const cacheHeader2 = res2.headers.get('x-cache');

      const totalDuration = Date.now() - tGlobalStart;
      let effectiveRps = 2 / (totalDuration / 1000);
      effectiveRps = Math.round(effectiveRps * 10) / 10;

      setLastExecutionSummary({
        scenarioName: 'Scenario A (Sequential Cache Hit)',
        totalRequests: 2,
        leadersQueued: 1,
        duplicatesIntercepted: 1,
        dedupEfficiency: 50.0,
        totalDurationMs: totalDuration,
        effectiveRps,
        p95LatencyMs: calculatePercentile(durations, 95),
        p99LatencyMs: calculatePercentile(durations, 99),
        timestamp: new Date().toLocaleTimeString(),
      });

      if (res2.status === 200 && cacheHeader2 === 'HIT') {
        toast.success(
          `Scenario A Verified: Req 1 queued (${cacheHeader1}), Req 2 instant 200 Cache HIT (${tDuration2}ms)!`,
        );
      } else {
        toast.info(
          `Req 1 (${res1.status}, ${cacheHeader1}) • Req 2 (${res2.status}, ${cacheHeader2}, ${tDuration2}ms)`,
        );
      }

      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['merchant'] });
    } catch (err) {
      let msg = 'Failed to run Scenario A';
      if (err instanceof Error) {
        msg = err.message;
      }
      toast.error(msg);
    } finally {
      setIsSimulatingScenarioA(false);
    }
  };

  const executeBurstRequests = async () => {
    if (!merchantQuery.data) {
      toast.error('Merchant credentials not loaded');
      return;
    }

    setIsSimulatingBurst(true);
    setIsBurstConfirmOpen(false);

    const sharedKey = generateRandomId('burst_');
    const reference = generateRandomId('ref_');
    const apiKey = merchantQuery.data.apiKey;

    const tGlobalStart = Date.now();

    try {
      const requests = Array.from({ length: burstConcurrency }).map(async () => {
        const tStart = Date.now();
        const res = await fetch('/api/v1/webhooks/epayco', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'idempotency-key': sharedKey,
            'x-api-key': apiKey,
          },
          body: JSON.stringify({
            eventType: 'PAYMENT_SUCCEEDED',
            amountCents: 5000,
            reference,
            metadata: { simulation: true, burstSize: burstConcurrency },
          }),
        });
        const duration = Date.now() - tStart;
        return {
          status: res.status,
          cacheHeader: res.headers.get('x-cache'),
          duration,
        };
      });

      const results = await Promise.all(requests);
      const totalDuration = Date.now() - tGlobalStart;

      const summary = calculateExecutionStats({
        scenarioName: `Scenario B (${burstConcurrency}x Concurrent Burst)`,
        totalRequests: burstConcurrency,
        results,
        totalDurationMs: totalDuration,
      });

      setLastExecutionSummary(summary);

      toast.success(
        `Burst ${burstConcurrency}x sent: ${summary.leadersQueued} leader queued, ${summary.duplicatesIntercepted} duplicate runners intercepted`,
      );
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['merchant'] });
    } catch (err) {
      let msg = 'Failed to execute burst';
      if (err instanceof Error) {
        msg = err.message;
      }
      toast.error(msg);
    } finally {
      setIsSimulatingBurst(false);
    }
  };

  const handleRunBurst = () => {
    if (burstConcurrency >= 25) {
      setIsBurstConfirmOpen(true);
    } else {
      executeBurstRequests();
    }
  };

  const handleRunRealisticWorkload = async () => {
    if (!merchantQuery.data) {
      toast.error('Merchant credentials not loaded');
      return;
    }

    setIsSimulatingRealistic(true);
    const apiKey = merchantQuery.data.apiKey;
    const items = generateRealisticDataset(realisticVolume, realisticDupRatio);
    const tGlobalStart = Date.now();

    try {
      const promises = items.map(async (item) => {
        const tStart = Date.now();
        const res = await fetch('/api/v1/webhooks/epayco', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'idempotency-key': item.key,
            'x-api-key': apiKey,
          },
          body: JSON.stringify({
            eventType: item.type,
            amountCents: item.amount,
            reference: item.ref,
            metadata: { source: item.source },
          }),
        });
        const duration = Date.now() - tStart;
        return {
          status: res.status,
          cacheHeader: res.headers.get('x-cache'),
          duration,
        };
      });

      const results = await Promise.all(promises);
      const totalDuration = Date.now() - tGlobalStart;

      const summary = calculateExecutionStats({
        scenarioName: `Scenario C (${realisticVolume} items, ${realisticDupRatio}% duplicates)`,
        totalRequests: items.length,
        results,
        totalDurationMs: totalDuration,
      });

      setLastExecutionSummary(summary);

      toast.success(
        `Realistic Workload: ${summary.leadersQueued} transactions queued, ${summary.duplicatesIntercepted} intentional duplicates intercepted!`,
      );
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['merchant'] });
    } catch (err) {
      let msg = 'Failed to run realistic workload';
      if (err instanceof Error) {
        msg = err.message;
      }
      toast.error(msg);
    } finally {
      setIsSimulatingRealistic(false);
    }
  };

  const handleRefreshTransactions = () => {
    queryClient.invalidateQueries({ queryKey: ['transactions'] });
    queryClient.invalidateQueries({ queryKey: ['events'] });
    queryClient.invalidateQueries({ queryKey: ['merchant'] });
    toast.success('Telemetry and ledger refreshed');
  };

  const handleToggleFlaky = () => {
    const currentState = metrics.chaosStatus.flakyGateway;
    toggleFlakyGatewayMutation.mutate(!currentState);
  };

  const handleToggleDbLatency = () => {
    const currentState = metrics.chaosStatus.dbLatency;
    toggleDbLatencyMutation.mutate(!currentState);
  };

  const handleConfirmReplayDlq = () => {
    replayDlqMutation.mutate();
  };

  const handleConfirmResetData = () => {
    resetDataMutation.mutate();
  };

  const handleNextPage = () => {
    const totalPages = transactionsQuery.data?.pagination.totalPages ?? 1;
    if (page < totalPages) {
      setPage(page + 1);
    }
  };

  const handlePrevPage = () => {
    if (page > 1) {
      setPage(page - 1);
    }
  };

  const handleNextEventsPage = () => {
    const totalPages = eventsQuery.data?.pagination.totalPages ?? 1;
    if (eventsPage < totalPages) {
      setEventsPage(eventsPage + 1);
    }
  };

  const handlePrevEventsPage = () => {
    if (eventsPage > 1) {
      setEventsPage(eventsPage - 1);
    }
  };

  return {
    metrics,
    isConnected,
    merchant: merchantQuery.data,
    transactions: transactionsQuery.data?.data ?? [],
    pagination: transactionsQuery.data?.pagination,
    isTransactionsLoading: transactionsQuery.isFetching,
    events: eventsQuery.data?.data ?? [],
    eventsPagination: eventsQuery.data?.pagination,
    isEventsLoading: eventsQuery.isFetching,
    activeTab,
    setActiveTab,
    burstConcurrency,
    setBurstConcurrency,
    realisticVolume,
    setRealisticVolume,
    realisticDupRatio,
    setRealisticDupRatio,
    lastExecutionSummary,
    isSimulatingBurst,
    isSimulatingScenarioA,
    isSimulatingRealistic,
    isResettingData: resetDataMutation.isPending,
    isReplayingDlq: replayDlqMutation.isPending,
    isResetConfirmOpen,
    setIsResetConfirmOpen,
    isReplayDlqConfirmOpen,
    setIsReplayDlqConfirmOpen,
    isBurstConfirmOpen,
    setIsBurstConfirmOpen,
    handleRunScenarioA,
    handleRunBurst,
    executeBurstRequests,
    handleRunRealisticWorkload,
    handleConfirmResetData,
    handleConfirmReplayDlq,
    handleRefreshTransactions,
    handleToggleFlaky,
    handleToggleDbLatency,
    page,
    handleNextPage,
    handlePrevPage,
    eventsPage,
    handleNextEventsPage,
    handlePrevEventsPage,
  };
}

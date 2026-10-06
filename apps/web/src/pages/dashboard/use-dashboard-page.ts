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

function calculatePercentile(numbers: number[], p: number): number {
  if (numbers.length === 0) {
    return 0;
  }
  const sorted = [...numbers].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  const safeIdx = Math.max(0, Math.min(index, sorted.length - 1));
  return sorted[safeIdx];
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
    const key = 'seq_' + Math.random().toString(36).substring(2, 9);
    const ref = 'ref_seq_' + Math.random().toString(36).substring(2, 9);
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

    const sharedKey = 'burst_' + Math.random().toString(36).substring(2, 9);
    const reference = 'ref_' + Math.random().toString(36).substring(2, 9);
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
      const durations = results.map((r) => r.duration);

      let interceptedCount = 0;
      let leaderCount = 0;

      for (const r of results) {
        if (r.cacheHeader === 'HIT' || r.cacheHeader === 'HIT_CONCURRENT' || r.status === 504) {
          interceptedCount += 1;
        } else {
          leaderCount += 1;
        }
      }

      let effectiveRps = 0;
      if (totalDuration > 0) {
        effectiveRps = Math.round((burstConcurrency / (totalDuration / 1000)) * 10) / 10;
      }

      let dedupEff = 0;
      if (burstConcurrency > 0) {
        dedupEff = Math.round((interceptedCount / burstConcurrency) * 1000) / 10;
      }

      setLastExecutionSummary({
        scenarioName: `Scenario B (${burstConcurrency}x Concurrent Burst)`,
        totalRequests: burstConcurrency,
        leadersQueued: leaderCount,
        duplicatesIntercepted: interceptedCount,
        dedupEfficiency: dedupEff,
        totalDurationMs: totalDuration,
        effectiveRps,
        p95LatencyMs: calculatePercentile(durations, 95),
        p99LatencyMs: calculatePercentile(durations, 99),
        timestamp: new Date().toLocaleTimeString(),
      });

      toast.success(
        `Burst ${burstConcurrency}x sent: ${leaderCount} leader queued, ${interceptedCount} duplicate runners intercepted`,
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
    const sources = ['ONLINE_CHECKOUT', 'POS_TERMINAL', 'RECURRING_BILLING', 'MOBILE_APP'];
    const amounts = [1250, 2499, 4999, 8500, 12000, 25000, 45000];

    interface Item {
      key: string;
      ref: string;
      amount: number;
      type: 'PAYMENT_SUCCEEDED' | 'CHARGE_REFUNDED';
      source: string;
    }

    const totalVolume = realisticVolume;
    const duplicateCount = Math.max(1, Math.round(totalVolume * (realisticDupRatio / 100)));
    const uniqueCount = Math.max(1, totalVolume - duplicateCount);

    const items: Item[] = [];
    for (let i = 0; i < uniqueCount; i++) {
      const source = sources[i % sources.length];
      const amount = amounts[i % amounts.length];
      let type: 'PAYMENT_SUCCEEDED' | 'CHARGE_REFUNDED' = 'PAYMENT_SUCCEEDED';
      if (i % 5 === 0) {
        type = 'CHARGE_REFUNDED';
      }

      let finalAmount = amount;
      if (type === 'CHARGE_REFUNDED') {
        finalAmount = -amount;
      }

      items.push({
        key: 'real_' + Math.random().toString(36).substring(2, 9),
        ref:
          'ord_' +
          source.toLowerCase() +
          '_' +
          i +
          '_' +
          Math.random().toString(36).substring(2, 6),
        amount: finalAmount,
        type,
        source,
      });
    }

    // Interleave intentional duplicates
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

    items.sort(() => Math.random() - 0.5);

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
      const durations = results.map((r) => r.duration);

      let hits = 0;
      let queued = 0;
      for (const r of results) {
        if (r.cacheHeader === 'HIT' || r.cacheHeader === 'HIT_CONCURRENT' || r.status === 504) {
          hits += 1;
        } else {
          queued += 1;
        }
      }

      let effectiveRps = 0;
      if (totalDuration > 0) {
        effectiveRps = Math.round((items.length / (totalDuration / 1000)) * 10) / 10;
      }

      let dedupEff = 0;
      if (items.length > 0) {
        dedupEff = Math.round((hits / items.length) * 1000) / 10;
      }

      setLastExecutionSummary({
        scenarioName: `Scenario C (${totalVolume} items, ${realisticDupRatio}% duplicates)`,
        totalRequests: items.length,
        leadersQueued: queued,
        duplicatesIntercepted: hits,
        dedupEfficiency: dedupEff,
        totalDurationMs: totalDuration,
        effectiveRps,
        p95LatencyMs: calculatePercentile(durations, 95),
        p99LatencyMs: calculatePercentile(durations, 99),
        timestamp: new Date().toLocaleTimeString(),
      });

      toast.success(
        `Realistic Workload: ${queued} transactions queued, ${hits} intentional duplicates intercepted!`,
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

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useSseMetrics } from '../../hooks/use-sse-metrics';
import { apiClient } from '../../lib/api-client';
import {
  generateRandomId,
  calculatePercentile,
  generateRealisticDataset,
  calculateExecutionStats,
} from './dashboard.utils.js';
import type { ExecutionSummary } from './dashboard.utils.js';

export type { ExecutionSummary };

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
    queryFn: () => apiClient<MerchantInfo>('/api/v1/merchant'),
    staleTime: 60000,
  });

  const transactionsQuery = useQuery({
    queryKey: ['transactions', page],
    queryFn: () =>
      apiClient<TransactionsResponse>(`/api/v1/transactions?page=${page}&pageSize=${pageSize}`),
    staleTime: 30000,
  });

  const eventsQuery = useQuery({
    queryKey: ['events', eventsPage],
    queryFn: () =>
      apiClient<EventsResponse>(`/api/v1/events?page=${eventsPage}&pageSize=${pageSize}`),
    staleTime: 30000,
  });

  const toggleFlakyGatewayMutation = useMutation({
    mutationFn: (enabled: boolean) =>
      apiClient('/api/v1/chaos/flaky-gateway', {
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
      apiClient('/api/v1/chaos/db-latency', {
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
      apiClient<{ success: boolean; replayedCount: number }>('/api/v1/admin/dlq/replay', {
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
      apiClient<ResetResponse>('/api/v1/admin/reset', {
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
    handlePurgeAll: handleConfirmResetData,
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

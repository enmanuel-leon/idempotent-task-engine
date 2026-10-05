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

interface ResetResponse {
  success: boolean;
  transactionsDeleted: number;
  eventsDeleted: number;
  merchantBalanceCents: string;
  redisKeysRemoved: number;
}

export function useDashboardPage() {
  const [page, setPage] = useState(1);
  const [burstConcurrency, setBurstConcurrency] = useState(10);
  const [isSimulatingBurst, setIsSimulatingBurst] = useState(false);
  const [isSimulatingScenarioA, setIsSimulatingScenarioA] = useState(false);

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
      queryClient.invalidateQueries({ queryKey: ['merchant'] });
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
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['merchant'] });
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

    try {
      // 1. Initial Request (Leader)
      const res1 = await fetch('/api/v1/webhooks/epayco', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'idempotency-key': key,
          'x-api-key': apiKey,
        },
        body: JSON.stringify({
          eventType: 'PAYMENT_SUCCEEDED',
          amountCents: 2500, // $25.00
          reference: ref,
          metadata: { scenario: 'A' },
        }),
      });

      const cacheHeader1 = res1.headers.get('x-cache');

      // Brief delay to allow worker settlement
      await new Promise((resolve) => setTimeout(resolve, 350));

      // 2. Duplicate Request with exact same Idempotency-Key
      const tStart2 = Date.now();
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
      const tDuration2 = Date.now() - tStart2;
      const cacheHeader2 = res2.headers.get('x-cache');

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

  const handleRunBurst = async () => {
    if (!merchantQuery.data) {
      toast.error('Merchant credentials not loaded');
      return;
    }

    setIsSimulatingBurst(true);
    const sharedKey = 'burst_' + Math.random().toString(36).substring(2, 9);
    const reference = 'ref_' + Math.random().toString(36).substring(2, 9);
    const apiKey = merchantQuery.data.apiKey;

    try {
      const requests = Array.from({ length: burstConcurrency }).map(() =>
        fetch('/api/v1/webhooks/epayco', {
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
        }).then((res) => ({
          status: res.status,
          cacheHeader: res.headers.get('x-cache'),
        })),
      );

      const results = await Promise.all(requests);
      let interceptedCount = 0;
      let leaderCount = 0;

      for (const r of results) {
        if (r.cacheHeader === 'HIT' || r.cacheHeader === 'HIT_CONCURRENT' || r.status === 504) {
          interceptedCount += 1;
        } else {
          leaderCount += 1;
        }
      }

      toast.success(
        `Burst ${burstConcurrency}x sent: ${leaderCount} leader queued, ${interceptedCount} duplicate runners intercepted`,
      );
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
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

  const handleRefreshTransactions = () => {
    queryClient.invalidateQueries({ queryKey: ['transactions'] });
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

  const handleReplayDlq = () => {
    replayDlqMutation.mutate();
  };

  const handleResetTestData = () => {
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

  return {
    metrics,
    isConnected,
    merchant: merchantQuery.data,
    transactions: transactionsQuery.data?.data ?? [],
    pagination: transactionsQuery.data?.pagination,
    isTransactionsLoading: transactionsQuery.isFetching,
    isSimulatingBurst,
    isSimulatingScenarioA,
    isResettingData: resetDataMutation.isPending,
    isReplayingDlq: replayDlqMutation.isPending,
    burstConcurrency,
    setBurstConcurrency,
    handleRunScenarioA,
    handleRunBurst,
    handleResetTestData,
    handleRefreshTransactions,
    handleToggleFlaky,
    handleToggleDbLatency,
    handleReplayDlq,
    page,
    handleNextPage,
    handlePrevPage,
  };
}

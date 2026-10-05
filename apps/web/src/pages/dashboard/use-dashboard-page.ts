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

export function useDashboardPage() {
  const [page, setPage] = useState(1);
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

  const [isSimulating, setIsSimulating] = useState(false);

  const handleSimulateBurst = async () => {
    if (!merchantQuery.data) {
      toast.error('Merchant credentials not loaded');
      return;
    }

    setIsSimulating(true);
    const sharedKey = 'burst_' + Math.random().toString(36).substring(2, 9);
    const reference = 'ref_' + Math.random().toString(36).substring(2, 9);
    const apiKey = merchantQuery.data.apiKey;

    try {
      const requests = Array.from({ length: 6 }).map(() =>
        fetch('/api/v1/webhooks/epayco', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'idempotency-key': sharedKey,
            'x-api-key': apiKey,
          },
          body: JSON.stringify({
            eventType: 'PAYMENT_SUCCEEDED',
            amountCents: 5000, // $50.00
            reference,
            metadata: { simulation: true },
          }),
        }).then((res) => ({
          status: res.status,
          cacheHeader: res.headers.get('x-cache'),
        })),
      );

      const results = await Promise.all(requests);
      let cacheHits = 0;
      let queued = 0;

      for (const r of results) {
        if (r.cacheHeader === 'HIT' || r.cacheHeader === 'HIT_CONCURRENT') {
          cacheHits += 1;
        } else {
          queued += 1;
        }
      }

      toast.success(
        `Burst sent: ${queued} leader queued, ${cacheHits} duplicate runners intercepted`,
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
      setIsSimulating(false);
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
    isSimulating,
    isReplayingDlq: replayDlqMutation.isPending,
    handleSimulateBurst,
    handleRefreshTransactions,
    handleToggleFlaky,
    handleToggleDbLatency,
    handleReplayDlq,
    page,
    handleNextPage,
    handlePrevPage,
  };
}

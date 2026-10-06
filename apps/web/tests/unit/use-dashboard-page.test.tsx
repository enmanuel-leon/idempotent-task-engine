import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useDashboardPage } from '../../src/pages/dashboard/use-dashboard-page';
import { toast } from 'sonner';

const mockMerchantData = {
  id: 'merchant_123',
  name: 'Test Merchant',
  apiKey: 'test_key_123',
  balanceCents: '1000000',
  currency: 'USD',
};

const mockTransactionsData = {
  data: [
    {
      id: 'tx_1',
      reference: 'ref_1',
      amountCents: '2500',
      createdAt: '2026-10-06T12:00:00Z',
      eventType: 'PAYMENT_SUCCEEDED',
      idempotencyKey: 'key_1',
      status: 'COMPLETED',
    },
  ],
  pagination: {
    total: 20,
    page: 1,
    pageSize: 8,
    totalPages: 3,
  },
};

const mockEventsData = {
  data: [
    {
      id: 'evt_1',
      merchantId: 'merchant_123',
      idempotencyKey: 'key_1',
      eventType: 'PAYMENT_SUCCEEDED',
      status: 'COMPLETED',
      attempts: 1,
      lastError: null,
      processedAt: '2026-10-06T12:00:00Z',
      createdAt: '2026-10-06T12:00:00Z',
      amountCents: '2500',
      reference: 'ref_1',
    },
  ],
  pagination: {
    total: 15,
    page: 1,
    pageSize: 8,
    totalPages: 2,
  },
};

const mockResetData = {
  success: true,
  transactionsDeleted: 5,
  eventsDeleted: 5,
  merchantBalanceCents: '1000000',
  redisKeysRemoved: 10,
};

const mockReplayData = {
  success: true,
  replayedCount: 2,
};

const mockApiClient = vi.fn();
(mockApiClient as any).get = vi.fn();
(mockApiClient as any).post = vi.fn();
(mockApiClient as any).delete = vi.fn();

vi.mock('../../src/lib/api-client', () => ({
  apiClient: (...args: unknown[]) => (mockApiClient as any)(...args),
  getApiUrl: (path: string) => path,
}));

const mockSseState = {
  metrics: {
    rps: 12.5,
    dedupEfficiency: 98.2,
    latencyP95: 15,
    latencyP99: 25,
    activeDlqCount: 0,
    queueWaitingCount: 1,
    queueActiveCount: 2,
    totalIngested: 100,
    totalDuplicates: 50,
    chaosStatus: {
      flakyGateway: false,
      dbLatency: false,
    },
    recentFeed: [],
  },
  isConnected: true,
};

vi.mock('../../src/hooks/use-sse-metrics', () => ({
  useSseMetrics: () => mockSseState,
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

function setupDefaultApiMock(): void {
  mockApiClient.mockImplementation(async (path: string) => {
    if (path.includes('/api/v1/merchant')) {
      return mockMerchantData;
    }
    if (path.includes('/api/v1/transactions')) {
      return mockTransactionsData;
    }
    if (path.includes('/api/v1/events')) {
      return mockEventsData;
    }
    if (path.includes('/api/v1/admin/reset')) {
      return mockResetData;
    }
    if (path.includes('/api/v1/admin/dlq/replay')) {
      return mockReplayData;
    }
    return { success: true };
  });

  (mockApiClient as any).get.mockImplementation(mockApiClient);
  (mockApiClient as any).post.mockImplementation(mockApiClient);
  (mockApiClient as any).delete.mockImplementation(mockApiClient);
}

function renderCustomHook<T>(hookFn: () => T) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });

  const result: { current: T } = {} as { current: T };
  const container = document.createElement('div');
  const root = createRoot(container);

  function Wrapper() {
    result.current = hookFn();
    return null;
  }

  act(() => {
    root.render(
      React.createElement(
        QueryClientProvider,
        { client: queryClient },
        React.createElement(Wrapper),
      ),
    );
  });

  return {
    result,
    queryClient,
    unmount: () => {
      act(() => {
        root.unmount();
      });
      queryClient.clear();
    },
  };
}

async function flushAsyncUpdates(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
}

describe('useDashboardPage', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaultApiMock();

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'x-cache': 'HIT' }),
      json: () => Promise.resolve({ success: true }),
    });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('exposes expected initial states and sse metrics', async () => {
    const { result, unmount } = renderCustomHook(() => useDashboardPage());

    expect(result.current.page).toBe(1);
    expect(result.current.eventsPage).toBe(1);
    expect(result.current.activeTab).toBe('live');
    expect(result.current.burstConcurrency).toBe(10);
    expect(result.current.realisticVolume).toBe(30);
    expect(result.current.realisticDupRatio).toBe(25);
    expect(result.current.isSimulatingBurst).toBe(false);
    expect(result.current.isSimulatingScenarioA).toBe(false);
    expect(result.current.isSimulatingRealistic).toBe(false);
    expect(result.current.lastExecutionSummary).toBeNull();
    expect(result.current.isResetConfirmOpen).toBe(false);
    expect(result.current.isReplayDlqConfirmOpen).toBe(false);
    expect(result.current.isBurstConfirmOpen).toBe(false);
    expect(result.current.isConnected).toBe(true);
    expect(result.current.metrics.rps).toBe(12.5);

    await flushAsyncUpdates();

    expect(result.current.merchant?.id).toBe('merchant_123');
    expect(result.current.transactions).toHaveLength(1);
    expect(result.current.events).toHaveLength(1);

    unmount();
  });

  it('handles pagination triggers for transactions and events', async () => {
    const { result, unmount } = renderCustomHook(() => useDashboardPage());
    await flushAsyncUpdates();

    act(() => {
      result.current.handleNextPage();
    });
    expect(result.current.page).toBe(2);

    await flushAsyncUpdates();

    act(() => {
      result.current.handleNextPage();
    });
    expect(result.current.page).toBe(3);

    await flushAsyncUpdates();

    act(() => {
      result.current.handleNextPage();
    });
    expect(result.current.page).toBe(3);

    act(() => {
      result.current.handlePrevPage();
    });
    expect(result.current.page).toBe(2);

    await flushAsyncUpdates();

    act(() => {
      result.current.handlePrevPage();
    });
    expect(result.current.page).toBe(1);

    await flushAsyncUpdates();

    act(() => {
      result.current.handlePrevPage();
    });
    expect(result.current.page).toBe(1);

    act(() => {
      result.current.handleNextEventsPage();
    });
    expect(result.current.eventsPage).toBe(2);

    await flushAsyncUpdates();

    act(() => {
      result.current.handleNextEventsPage();
    });
    expect(result.current.eventsPage).toBe(2);

    act(() => {
      result.current.handlePrevEventsPage();
    });
    expect(result.current.eventsPage).toBe(1);

    await flushAsyncUpdates();

    act(() => {
      result.current.handlePrevEventsPage();
    });
    expect(result.current.eventsPage).toBe(1);

    unmount();
  });

  it('updates slider states and active tab correctly', () => {
    const { result, unmount } = renderCustomHook(() => useDashboardPage());

    act(() => {
      result.current.setBurstConcurrency(20);
    });
    expect(result.current.burstConcurrency).toBe(20);

    act(() => {
      result.current.setRealisticVolume(60);
    });
    expect(result.current.realisticVolume).toBe(60);

    act(() => {
      result.current.setRealisticDupRatio(50);
    });
    expect(result.current.realisticDupRatio).toBe(50);

    act(() => {
      result.current.setActiveTab('historical');
    });
    expect(result.current.activeTab).toBe('historical');

    unmount();
  });

  it('controls confirmation modal states', () => {
    const { result, unmount } = renderCustomHook(() => useDashboardPage());

    act(() => {
      result.current.setIsResetConfirmOpen(true);
    });
    expect(result.current.isResetConfirmOpen).toBe(true);

    act(() => {
      result.current.setIsResetConfirmOpen(false);
    });
    expect(result.current.isResetConfirmOpen).toBe(false);

    act(() => {
      result.current.setIsBurstConfirmOpen(true);
    });
    expect(result.current.isBurstConfirmOpen).toBe(true);

    act(() => {
      result.current.setIsBurstConfirmOpen(false);
    });
    expect(result.current.isBurstConfirmOpen).toBe(false);

    act(() => {
      result.current.setIsReplayDlqConfirmOpen(true);
    });
    expect(result.current.isReplayDlqConfirmOpen).toBe(true);

    act(() => {
      result.current.setIsReplayDlqConfirmOpen(false);
    });
    expect(result.current.isReplayDlqConfirmOpen).toBe(false);

    unmount();
  });

  it('executes Scenario A and sets execution summary', async () => {
    const { result, unmount } = renderCustomHook(() => useDashboardPage());
    await flushAsyncUpdates();

    await act(async () => {
      await result.current.handleRunScenarioA();
    });

    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
    expect(result.current.lastExecutionSummary).not.toBeNull();
    expect(result.current.lastExecutionSummary?.scenarioName).toBe(
      'Scenario A (Sequential Cache Hit)',
    );
    expect(toast.success).toHaveBeenCalled();

    unmount();
  });

  it('handles Scenario A when merchant data is absent', async () => {
    mockApiClient.mockResolvedValueOnce(null);
    const { result, unmount } = renderCustomHook(() => useDashboardPage());

    await act(async () => {
      await result.current.handleRunScenarioA();
    });

    expect(toast.error).toHaveBeenCalledWith('Merchant credentials not loaded');

    unmount();
  });

  it('triggers Burst Scenario B directly when burstConcurrency is low', async () => {
    const { result, unmount } = renderCustomHook(() => useDashboardPage());
    await flushAsyncUpdates();

    act(() => {
      result.current.setBurstConcurrency(5);
    });

    await act(async () => {
      result.current.handleRunBurst();
      await flushAsyncUpdates();
    });

    expect(globalThis.fetch).toHaveBeenCalledTimes(5);
    expect(result.current.lastExecutionSummary?.totalRequests).toBe(5);
    expect(toast.success).toHaveBeenCalled();

    unmount();
  });

  it('opens confirmation modal on handleRunBurst when burstConcurrency >= 25', () => {
    const { result, unmount } = renderCustomHook(() => useDashboardPage());

    act(() => {
      result.current.setBurstConcurrency(30);
    });

    act(() => {
      result.current.handleRunBurst();
    });

    expect(result.current.isBurstConfirmOpen).toBe(true);

    unmount();
  });

  it('executes burst requests when executeBurstRequests is directly invoked', async () => {
    const { result, unmount } = renderCustomHook(() => useDashboardPage());
    await flushAsyncUpdates();

    act(() => {
      result.current.setBurstConcurrency(4);
    });

    await act(async () => {
      await result.current.executeBurstRequests();
    });

    expect(globalThis.fetch).toHaveBeenCalledTimes(4);
    expect(toast.success).toHaveBeenCalled();

    unmount();
  });

  it('executes Scenario C realistic workload and generates execution stats', async () => {
    const { result, unmount } = renderCustomHook(() => useDashboardPage());
    await flushAsyncUpdates();

    act(() => {
      result.current.setRealisticVolume(10);
      result.current.setRealisticDupRatio(20);
    });

    await act(async () => {
      await result.current.handleRunRealisticWorkload();
    });

    expect(globalThis.fetch).toHaveBeenCalledTimes(10);
    expect(result.current.lastExecutionSummary?.totalRequests).toBe(10);
    expect(toast.success).toHaveBeenCalled();

    unmount();
  });

  it('refreshes telemetry and ledger queries on handleRefreshTransactions', () => {
    const { result, queryClient, unmount } = renderCustomHook(() => useDashboardPage());
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    act(() => {
      result.current.handleRefreshTransactions();
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['transactions'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['events'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['merchant'] });
    expect(toast.success).toHaveBeenCalledWith('Telemetry and ledger refreshed');

    unmount();
  });

  it('toggles flaky gateway chaos mutation', async () => {
    const { result, unmount } = renderCustomHook(() => useDashboardPage());

    act(() => {
      result.current.handleToggleFlaky();
    });

    await flushAsyncUpdates();

    expect(mockApiClient).toHaveBeenCalledWith('/api/v1/chaos/flaky-gateway', {
      method: 'POST',
      body: JSON.stringify({ enabled: true }),
    });
    expect(toast.success).toHaveBeenCalledWith('Downstream Gateway Chaos status updated');

    unmount();
  });

  it('toggles db latency chaos mutation', async () => {
    const { result, unmount } = renderCustomHook(() => useDashboardPage());

    act(() => {
      result.current.handleToggleDbLatency();
    });

    await flushAsyncUpdates();

    expect(mockApiClient).toHaveBeenCalledWith('/api/v1/chaos/db-latency', {
      method: 'POST',
      body: JSON.stringify({ enabled: true }),
    });
    expect(toast.success).toHaveBeenCalledWith('Database Latency Spike Chaos status updated');

    unmount();
  });

  it('purges and resets all test data via handlePurgeAll and handleConfirmResetData', async () => {
    const { result, unmount } = renderCustomHook(() => useDashboardPage());

    act(() => {
      result.current.setIsResetConfirmOpen(true);
      result.current.handlePurgeAll();
    });

    await flushAsyncUpdates();

    expect(mockApiClient).toHaveBeenCalledWith('/api/v1/admin/reset', {
      method: 'POST',
    });
    expect(toast.success).toHaveBeenCalledWith(
      'Test data purged: 5 transactions removed, balance reset to $10,000.00',
    );
    expect(result.current.isResetConfirmOpen).toBe(false);

    unmount();
  });

  it('replays dlq jobs via handleConfirmReplayDlq', async () => {
    const { result, unmount } = renderCustomHook(() => useDashboardPage());

    act(() => {
      result.current.setIsReplayDlqConfirmOpen(true);
      result.current.handleConfirmReplayDlq();
    });

    await flushAsyncUpdates();

    expect(mockApiClient).toHaveBeenCalledWith('/api/v1/admin/dlq/replay', {
      method: 'POST',
    });
    expect(toast.success).toHaveBeenCalledWith('Replayed 2 DLQ jobs back into incoming queue');
    expect(result.current.isReplayDlqConfirmOpen).toBe(false);

    unmount();
  });

  it('handles Scenario A when fetch throws network error', async () => {
    const { result, unmount } = renderCustomHook(() => useDashboardPage());
    await flushAsyncUpdates();

    globalThis.fetch = vi.fn().mockRejectedValueOnce(new Error('Network error on request 1'));

    await act(async () => {
      await result.current.handleRunScenarioA();
    });

    expect(toast.error).toHaveBeenCalledWith('Network error on request 1');

    unmount();
  });

  it('handles Scenario A when second response is not a cache hit', async () => {
    const { result, unmount } = renderCustomHook(() => useDashboardPage());
    await flushAsyncUpdates();

    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        status: 200,
        headers: new Headers({ 'x-cache': 'MISS' }),
      })
      .mockResolvedValueOnce({
        status: 200,
        headers: new Headers({ 'x-cache': 'MISS' }),
      });

    await act(async () => {
      await result.current.handleRunScenarioA();
    });

    expect(toast.info).toHaveBeenCalled();

    unmount();
  });

  it('handles burst execution when merchant data is absent', async () => {
    mockApiClient.mockResolvedValueOnce(null);
    const { result, unmount } = renderCustomHook(() => useDashboardPage());

    await act(async () => {
      await result.current.executeBurstRequests();
    });

    expect(toast.error).toHaveBeenCalledWith('Merchant credentials not loaded');

    unmount();
  });

  it('handles burst execution when fetch throws network error', async () => {
    const { result, unmount } = renderCustomHook(() => useDashboardPage());
    await flushAsyncUpdates();

    act(() => {
      result.current.setBurstConcurrency(2);
    });

    globalThis.fetch = vi.fn().mockRejectedValueOnce(new Error('Burst failed'));

    await act(async () => {
      await result.current.executeBurstRequests();
    });

    expect(toast.error).toHaveBeenCalledWith('Burst failed');

    unmount();
  });

  it('handles Scenario C when merchant data is absent', async () => {
    mockApiClient.mockResolvedValueOnce(null);
    const { result, unmount } = renderCustomHook(() => useDashboardPage());

    await act(async () => {
      await result.current.handleRunRealisticWorkload();
    });

    expect(toast.error).toHaveBeenCalledWith('Merchant credentials not loaded');

    unmount();
  });

  it('handles Scenario C when fetch throws network error', async () => {
    const { result, unmount } = renderCustomHook(() => useDashboardPage());
    await flushAsyncUpdates();

    globalThis.fetch = vi.fn().mockRejectedValueOnce(new Error('Scenario C network error'));

    await act(async () => {
      await result.current.handleRunRealisticWorkload();
    });

    expect(toast.error).toHaveBeenCalledWith('Scenario C network error');

    unmount();
  });

  it('handles mutation errors gracefully across chaos and admin mutations', async () => {
    const { result, unmount } = renderCustomHook(() => useDashboardPage());

    mockApiClient.mockRejectedValueOnce(new Error('Flaky failure'));
    act(() => {
      result.current.handleToggleFlaky();
    });
    await flushAsyncUpdates();
    expect(toast.error).toHaveBeenCalledWith('Flaky failure');

    mockApiClient.mockRejectedValueOnce(new Error('Latency failure'));
    act(() => {
      result.current.handleToggleDbLatency();
    });
    await flushAsyncUpdates();
    expect(toast.error).toHaveBeenCalledWith('Latency failure');

    mockApiClient.mockRejectedValueOnce(new Error('Reset failure'));
    act(() => {
      result.current.handleConfirmResetData();
    });
    await flushAsyncUpdates();
    expect(toast.error).toHaveBeenCalledWith('Reset failure');

    mockApiClient.mockRejectedValueOnce(new Error('Replay failure'));
    act(() => {
      result.current.handleConfirmReplayDlq();
    });
    await flushAsyncUpdates();
    expect(toast.error).toHaveBeenCalledWith('Replay failure');

    unmount();
  });
});

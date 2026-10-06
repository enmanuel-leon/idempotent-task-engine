import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { useSseMetrics } from '../../src/hooks/use-sse-metrics';
import type { MetricsSnapshot } from '../../src/hooks/use-sse-metrics';

class MockEventSource {
  static instances: MockEventSource[] = [];
  url: string;
  onopen: ((ev: Event) => void) | null = null;
  onmessage: ((ev: MessageEvent) => void) | null = null;
  onerror: ((ev: Event) => void) | null = null;
  closed = false;

  constructor(url: string) {
    this.url = url;
    MockEventSource.instances.push(this);
  }

  close(): void {
    this.closed = true;
  }

  emitOpen(): void {
    if (this.onopen) {
      this.onopen(new Event('open'));
    }
  }

  emitMessage(data: unknown): void {
    if (this.onmessage) {
      let serialized = '';
      if (typeof data === 'string') {
        serialized = data;
      } else {
        serialized = JSON.stringify(data);
      }
      this.onmessage(new MessageEvent('message', { data: serialized }));
    }
  }

  emitError(): void {
    if (this.onerror) {
      this.onerror(new Event('error'));
    }
  }
}

function renderHook<T>(hookFn: () => T) {
  const result: { current: T } = {} as { current: T };
  const container = document.createElement('div');
  const root = createRoot(container);

  function TestComponent() {
    result.current = hookFn();
    return null;
  }

  act(() => {
    root.render(React.createElement(TestComponent));
  });

  return {
    result,
    unmount: () => {
      act(() => {
        root.unmount();
      });
    },
  };
}

describe('useSseMetrics', () => {
  const originalEventSource = globalThis.EventSource;

  beforeEach(() => {
    MockEventSource.instances = [];
    globalThis.EventSource = MockEventSource as unknown as typeof EventSource;
  });

  afterEach(() => {
    globalThis.EventSource = originalEventSource;
  });

  it('connects to event source and updates isConnected state on open', () => {
    const { result, unmount } = renderHook(() => useSseMetrics());

    expect(MockEventSource.instances).toHaveLength(1);
    const es = MockEventSource.instances[0];
    expect(es.url.endsWith('/api/v1/metrics/stream')).toBe(true);
    expect(result.current.isConnected).toBe(false);

    act(() => {
      es.emitOpen();
    });

    expect(result.current.isConnected).toBe(true);
    unmount();
    expect(es.closed).toBe(true);
  });

  it('parses valid SSE JSON message into metrics state', () => {
    const { result, unmount } = renderHook(() => useSseMetrics());
    const es = MockEventSource.instances[0];

    const snapshotUpdate: MetricsSnapshot = {
      rps: 42.5,
      dedupEfficiency: 98.2,
      latencyP95: 12,
      latencyP99: 25,
      activeDlqCount: 0,
      queueWaitingCount: 5,
      queueActiveCount: 2,
      totalIngested: 100,
      totalDuplicates: 95,
      chaosStatus: {
        flakyGateway: false,
        dbLatency: false,
      },
      recentFeed: [],
    };

    act(() => {
      es.emitMessage(snapshotUpdate);
    });

    expect(result.current.metrics.rps).toBe(42.5);
    expect(result.current.metrics.dedupEfficiency).toBe(98.2);
    expect(result.current.metrics.totalIngested).toBe(100);

    unmount();
  });

  it('safely ignores invalid JSON in SSE message', () => {
    const { result, unmount } = renderHook(() => useSseMetrics());
    const es = MockEventSource.instances[0];

    act(() => {
      es.emitMessage('invalid raw non-json text');
    });

    expect(result.current.metrics.rps).toBe(0);
    expect(result.current.metrics.totalIngested).toBe(0);

    unmount();
  });

  it('sets isConnected to false on connection error', () => {
    const { result, unmount } = renderHook(() => useSseMetrics());
    const es = MockEventSource.instances[0];

    act(() => {
      es.emitOpen();
    });
    expect(result.current.isConnected).toBe(true);

    act(() => {
      es.emitError();
    });
    expect(result.current.isConnected).toBe(false);

    unmount();
  });
});

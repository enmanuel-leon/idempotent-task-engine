import { useState, useEffect } from 'react';
import { getApiUrl } from '../lib/api-client';

interface DedupFeedItem {
  id: string;
  idempotencyKey: string;
  normalizedKey: string;
  cacheStatus: 'HIT' | 'MISS' | 'HIT_CONCURRENT' | 'TIMEOUT_CONCURRENT';
  eventType: string;
  amountCents: number;
  durationMs: number;
  timestamp: string;
}

export interface MetricsSnapshot {
  rps: number;
  dedupEfficiency: number;
  latencyP95: number;
  latencyP99: number;
  activeDlqCount: number;
  queueWaitingCount: number;
  queueActiveCount: number;
  totalIngested: number;
  totalDuplicates: number;
  chaosStatus: {
    flakyGateway: boolean;
    dbLatency: boolean;
  };
  recentFeed: DedupFeedItem[];
}

const initialSnapshot: MetricsSnapshot = {
  rps: 0,
  dedupEfficiency: 0,
  latencyP95: 0,
  latencyP99: 0,
  activeDlqCount: 0,
  queueWaitingCount: 0,
  queueActiveCount: 0,
  totalIngested: 0,
  totalDuplicates: 0,
  chaosStatus: {
    flakyGateway: false,
    dbLatency: false,
  },
  recentFeed: [],
};

export function useSseMetrics() {
  const [metrics, setMetrics] = useState<MetricsSnapshot>(initialSnapshot);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const url = getApiUrl('/api/v1/metrics/stream');
    const es = new EventSource(url);

    es.onopen = () => {
      setIsConnected(true);
    };

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as MetricsSnapshot;
        setMetrics(data);
      } catch {
        // Ignore parse error
      }
    };

    es.onerror = () => {
      setIsConnected(false);
    };

    return () => {
      es.close();
    };
  }, []);

  return { metrics, isConnected };
}

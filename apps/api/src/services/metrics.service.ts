import type { FastifyReply } from 'fastify';
import { chaosService } from './chaos.service.js';
import { webhooksDlqQueue, webhooksIncomingQueue } from '../lib/queue.js';

interface DedupFeedItem {
  id: string;
  idempotencyKey: string;
  normalizedKey: string;
  cacheStatus: 'HIT' | 'MISS' | 'HIT_CONCURRENT';
  eventType: string;
  amountCents: number;
  durationMs: number;
  timestamp: string;
}

interface MetricsSnapshot {
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

class MetricsService {
  private totalIngested = 0;
  private totalDuplicates = 0;
  private ingestionTimestamps: number[] = [];
  private latenciesMs: number[] = [];
  private recentFeed: DedupFeedItem[] = [];
  private sseClients: Set<FastifyReply> = new Set();
  private broadcastInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.startBroadcasting();
  }

  public reset(): void {
    this.totalIngested = 0;
    this.totalDuplicates = 0;
    this.ingestionTimestamps = [];
    this.latenciesMs = [];
    this.recentFeed = [];
  }

  public recordIngestion(item: DedupFeedItem): void {
    const now = Date.now();
    this.totalIngested += 1;
    if (item.cacheStatus === 'HIT' || item.cacheStatus === 'HIT_CONCURRENT') {
      this.totalDuplicates += 1;
    }

    this.ingestionTimestamps.push(now);
    this.latenciesMs.push(item.durationMs);
    if (this.latenciesMs.length > 500) {
      this.latenciesMs.shift();
    }

    this.recentFeed.unshift(item);
    if (this.recentFeed.length > 30) {
      this.recentFeed.pop();
    }
  }

  private calculateRps(now: number): number {
    const windowStart = now - 10000; // 10s window
    let validCount = 0;
    const remainingTimestamps: number[] = [];

    for (const ts of this.ingestionTimestamps) {
      if (ts >= windowStart) {
        validCount += 1;
        remainingTimestamps.push(ts);
      }
    }
    this.ingestionTimestamps = remainingTimestamps;

    const rps = validCount / 10;
    return Math.round(rps * 10) / 10;
  }

  private calculatePercentile(percentile: number): number {
    if (this.latenciesMs.length === 0) {
      return 0;
    }
    const sorted = [...this.latenciesMs].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    const safeIndex = Math.max(0, Math.min(index, sorted.length - 1));
    return sorted[safeIndex];
  }

  public async getSnapshot(): Promise<MetricsSnapshot> {
    const now = Date.now();
    const rps = this.calculateRps(now);
    const latencyP95 = this.calculatePercentile(95);
    const latencyP99 = this.calculatePercentile(99);

    let dedupEfficiency = 0;
    if (this.totalIngested > 0) {
      dedupEfficiency = Math.round((this.totalDuplicates / this.totalIngested) * 1000) / 10;
    }

    let activeDlqCount = 0;
    let queueWaitingCount = 0;
    let queueActiveCount = 0;

    try {
      activeDlqCount = await webhooksDlqQueue.count();
      const waiting = await webhooksIncomingQueue.getWaitingCount();
      const delayed = await webhooksIncomingQueue.getDelayedCount();
      queueWaitingCount = waiting + delayed;
      queueActiveCount = await webhooksIncomingQueue.getActiveCount();
    } catch {
      // Degrade gracefully if redis queue metrics are temporarily unavailable
    }

    return {
      rps,
      dedupEfficiency,
      latencyP95,
      latencyP99,
      activeDlqCount,
      queueWaitingCount,
      queueActiveCount,
      totalIngested: this.totalIngested,
      totalDuplicates: this.totalDuplicates,
      chaosStatus: chaosService.getChaosStatus(),
      recentFeed: [...this.recentFeed],
    };
  }

  public registerSseClient(reply: FastifyReply): void {
    this.sseClients.add(reply);
    reply.raw.on('close', () => {
      this.sseClients.delete(reply);
    });
  }

  private startBroadcasting(): void {
    if (this.broadcastInterval) {
      return;
    }

    this.broadcastInterval = setInterval(async () => {
      if (this.sseClients.size === 0) {
        return;
      }

      try {
        const snapshot = await this.getSnapshot();
        const data = 'data: ' + JSON.stringify(snapshot) + '\n\n';
        for (const client of this.sseClients) {
          if (!client.raw.destroyed) {
            client.raw.write(data);
          }
        }
      } catch {
        // Suppress broadcast tick errors
      }
    }, 500);
  }
}

export const metricsService = new MetricsService();

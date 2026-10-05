import { describe, expect, it, vi } from 'vitest';
import { processWebhookJob } from '../../src/services/worker.service.js';
import { prisma } from '../../src/lib/prisma.js';
import { idempotencyService } from '../../src/services/idempotency.service.js';
import type { Job } from 'bullmq';
import type { WebhookJobData } from '../../src/lib/queue.js';

describe('Worker Service', () => {
  it('processWebhookJob executes transaction and saves response', async () => {
    const mockTx = {
      webhookEvent: {
        update: vi.fn().mockResolvedValue({ id: 'evt_1' }),
      },
      merchantAccount: {
        update: vi.fn().mockResolvedValue({
          id: 'm_1',
          balanceCents: 15000n,
          currency: 'USD',
        }),
      },
      transaction: {
        create: vi.fn().mockResolvedValue({
          id: 'tx_1',
          reference: 'ref_123',
          createdAt: new Date(),
          webhookEventId: 'evt_1',
        }),
      },
    };

    vi.spyOn(prisma, '$transaction').mockImplementation(async (cb: any) => cb(mockTx));
    vi.spyOn(idempotencyService, 'saveCachedResponse').mockResolvedValue();
    vi.spyOn(idempotencyService, 'publishCompletion').mockResolvedValue();

    const mockJob = {
      data: {
        merchantId: 'm_1',
        idempotencyKey: 'k_123',
        normalizedKey: 'hash_123',
        eventType: 'PAYMENT_SUCCEEDED',
        amountCents: 5000,
        reference: 'ref_123',
        payload: { test: true },
        enqueuedAt: Date.now(),
      },
    } as unknown as Job<WebhookJobData>;

    const result = await processWebhookJob(mockJob);

    expect(result.success).toBe(true);
    expect(result.amountCents).toBe(5000);
    expect(result.currency).toBe('USD');
  });
});

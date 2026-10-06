import { describe, expect, it, vi, afterEach } from 'vitest';
import { Worker, type Job } from 'bullmq';
import { processWebhookJob, startWorker, stopWorker } from '../../src/services/worker.service.js';
import { prisma } from '../../src/lib/prisma.js';
import { idempotencyService } from '../../src/services/idempotency.service.js';
import { chaosService } from '../../src/services/chaos.service.js';
import { webhooksDlqQueue } from '../../src/lib/queue.js';
import { ENGINE_LIMITS, WEBHOOK_STATUS } from '../../src/constants/engine.constants.js';
import type { WebhookJobData } from '../../src/lib/queue.js';

describe('Worker Service', () => {
  afterEach(async () => {
    vi.restoreAllMocks();
    await stopWorker();
  });

  it('throws error when chaos gateway failure is active', async () => {
    vi.spyOn(chaosService, 'shouldInjectGatewayFailure').mockReturnValue(true);
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

    await expect(processWebhookJob(mockJob)).rejects.toThrow(
      'Chaos: 500 Downstream Bank Gateway Failure',
    );
  });

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

  it('startWorker returns a Worker instance and subsequent calls return the cached instance', async () => {
    const worker1 = startWorker();
    await worker1.waitUntilReady();
    expect(worker1).toBeInstanceOf(Worker);

    const worker2 = startWorker();
    expect(worker2).toBe(worker1);
  });

  it('stopWorker gracefully closes the worker and resets the instance', async () => {
    const worker = startWorker();
    await worker.waitUntilReady();
    const closeSpy = vi.spyOn(worker, 'close');

    await stopWorker();

    expect(closeSpy).toHaveBeenCalledTimes(1);

    const newWorker = startWorker();
    await newWorker.waitUntilReady();
    expect(newWorker).not.toBe(worker);
  });

  it('workerInstance failed listener enqueues to DLQ and updates event when retries are exhausted', async () => {
    const worker = startWorker();
    await worker.waitUntilReady();
    const failedListeners = worker.listeners('failed');
    expect(failedListeners.length).toBeGreaterThan(0);
    const failedListener = failedListeners[0];

    const dlqSpy = vi.spyOn(webhooksDlqQueue, 'add').mockResolvedValue({} as any);
    const updateSpy = vi.spyOn(prisma.webhookEvent, 'update').mockResolvedValue({} as any);

    const mockJob = {
      id: 'job_exhausted_1',
      name: 'epayco-webhook',
      attemptsMade: ENGINE_LIMITS.MAX_RETRY_ATTEMPTS,
      data: {
        merchantId: 'm_dlq_1',
        idempotencyKey: 'k_dlq_1',
        normalizedKey: 'norm_dlq_1',
        eventType: 'PAYMENT_SUCCEEDED',
        amountCents: 5000,
        reference: 'ref_dlq_1',
        payload: { test: true },
        enqueuedAt: Date.now(),
      },
    } as unknown as Job<WebhookJobData>;

    const mockError = new Error('Downstream network timeout');
    mockError.stack = 'Error: Downstream network timeout\n    at test';

    await failedListener(mockJob, mockError);

    expect(dlqSpy).toHaveBeenCalledWith('epayco-webhook', mockJob.data, {
      jobId: 'dlq-job_exhausted_1',
    });

    expect(updateSpy).toHaveBeenCalledWith({
      where: {
        merchantId_idempotencyKey: {
          merchantId: 'm_dlq_1',
          idempotencyKey: 'k_dlq_1',
        },
      },
      data: {
        status: WEBHOOK_STATUS.DEAD_LETTER,
        attempts: ENGINE_LIMITS.MAX_RETRY_ATTEMPTS,
        lastError: mockError.stack,
      },
    });
  });
});

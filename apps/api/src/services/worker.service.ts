import { Worker, type Job } from 'bullmq';
import { prisma } from '../lib/prisma.js';
import { type WebhookJobData, calculateFullJitterDelay, webhooksDlqQueue } from '../lib/queue.js';
import { QUEUE_NAMES, WEBHOOK_STATUS, ENGINE_LIMITS } from '../constants/engine.constants.js';
import { idempotencyService } from './idempotency.service.js';
import { chaosService } from './chaos.service.js';
import { logger } from '../config/logger.js';
import { createRedisConnection } from '../lib/redis.js';

let workerInstance: Worker<WebhookJobData> | null = null;

async function executeDatabaseTransaction(data: Readonly<WebhookJobData>) {
  return prisma.$transaction(async (tx) => {
    const updatedEvent = await tx.webhookEvent.update({
      where: {
        merchantId_idempotencyKey: {
          merchantId: data.merchantId,
          idempotencyKey: data.idempotencyKey,
        },
      },
      data: {
        status: WEBHOOK_STATUS.PROCESSING,
      },
    });

    const updatedMerchant = await tx.merchantAccount.update({
      where: { id: data.merchantId },
      data: {
        balanceCents: {
          increment: BigInt(data.amountCents),
        },
      },
      select: {
        id: true,
        balanceCents: true,
        currency: true,
      },
    });

    const transaction = await tx.transaction.create({
      data: {
        merchantId: data.merchantId,
        webhookEventId: updatedEvent.id,
        amountCents: BigInt(data.amountCents),
        reference: data.reference,
      },
    });

    const responsePayload = {
      success: true,
      transactionId: transaction.id,
      reference: transaction.reference,
      amountCents: data.amountCents,
      newBalanceCents: updatedMerchant.balanceCents.toString(),
      currency: updatedMerchant.currency,
      processedAt: transaction.createdAt.toISOString(),
    };

    await tx.webhookEvent.update({
      where: { id: transaction.webhookEventId },
      data: {
        status: WEBHOOK_STATUS.COMPLETED,
        processedAt: transaction.createdAt,
        responseBody: responsePayload,
      },
    });

    return responsePayload;
  });
}

export async function processWebhookJob(
  job: Job<WebhookJobData>,
): Promise<Record<string, unknown>> {
  const { data } = job;

  if (chaosService.shouldInjectGatewayFailure()) {
    throw new Error('Chaos: 500 Downstream Bank Gateway Failure');
  }

  await chaosService.injectDbLatencyIfEnabled();

  const responsePayload = await executeDatabaseTransaction(data);

  await idempotencyService.saveCachedResponse(data.normalizedKey, responsePayload);
  await idempotencyService.publishCompletion(data.normalizedKey, responsePayload);

  return responsePayload;
}

export function startWorker(): Worker<WebhookJobData> {
  if (workerInstance) {
    return workerInstance;
  }

  const workerConnection = createRedisConnection();

  workerInstance = new Worker<WebhookJobData>(
    QUEUE_NAMES.WEBHOOKS_INCOMING,
    async (job) => {
      return processWebhookJob(job);
    },
    {
      connection: workerConnection,
      concurrency: ENGINE_LIMITS.WORKER_CONCURRENCY,
      settings: {
        backoffStrategy: (attemptsMade: number) => {
          return calculateFullJitterDelay(attemptsMade);
        },
      },
    },
  );

  workerInstance.on('failed', async (job, err) => {
    if (!job) {
      return;
    }

    logger.warn(
      { jobId: job.id, attemptsMade: job.attemptsMade, err: err.message },
      'Webhook job failed an attempt',
    );

    if (job.attemptsMade >= ENGINE_LIMITS.MAX_RETRY_ATTEMPTS) {
      logger.error(
        { jobId: job.id, key: job.data.idempotencyKey },
        'Job exhausted all retries -> Routing to DLQ',
      );

      try {
        await webhooksDlqQueue.add(job.name, job.data, {
          jobId: 'dlq-' + job.id,
        });

        await prisma.webhookEvent.update({
          where: {
            merchantId_idempotencyKey: {
              merchantId: job.data.merchantId,
              idempotencyKey: job.data.idempotencyKey,
            },
          },
          data: {
            status: WEBHOOK_STATUS.DEAD_LETTER,
            attempts: job.attemptsMade,
            lastError: err.stack ?? err.message,
          },
        });
      } catch (dlqErr) {
        logger.error({ dlqErr }, 'Failed to persist DLQ event in database');
      }
    }
  });

  return workerInstance;
}

export async function stopWorker(): Promise<void> {
  if (workerInstance) {
    await workerInstance.close();
    workerInstance = null;
  }
}

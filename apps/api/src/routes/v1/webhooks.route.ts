import type { Prisma } from '@prisma/client';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { prisma } from '../../lib/prisma.js';
import { webhooksIncomingQueue } from '../../lib/queue.js';
import { idempotencyService } from '../../services/idempotency.service.js';
import { metricsService } from '../../services/metrics.service.js';
import { WEBHOOK_STATUS, EVENT_TYPES, ENGINE_LIMITS } from '../../constants/engine.constants.js';

const webhookHeadersSchema = z.object({
  'idempotency-key': z.string().min(1),
  'x-api-key': z.string().min(1),
});

const webhookBodySchema = z.object({
  eventType: z.enum([
    EVENT_TYPES.PAYMENT_SUCCEEDED,
    EVENT_TYPES.PAYMENT_FAILED,
    EVENT_TYPES.CHARGE_REFUNDED,
  ]),
  amountCents: z.coerce.number().int(),
  reference: z.string().min(1),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

type WebhookBody = z.infer<typeof webhookBodySchema>;

async function handleConcurrentRunner(
  reply: FastifyReply,
  normalizedKey: string,
  startTime: number,
  logData: { idKey: string; eventType: string; amountCents: number },
) {
  const result = await idempotencyService.waitForCompletion(
    normalizedKey,
    ENGINE_LIMITS.SUBSCRIBER_TIMEOUT_MS,
  );
  const durationMs = Date.now() - startTime;

  if (result) {
    metricsService.recordIngestion({
      id: randomUUID(),
      idempotencyKey: logData.idKey,
      normalizedKey,
      cacheStatus: 'HIT_CONCURRENT',
      eventType: logData.eventType,
      amountCents: logData.amountCents,
      durationMs,
      timestamp: new Date().toISOString(),
    });
    return reply.header('X-Cache', 'HIT_CONCURRENT').code(200).send(result);
  }

  metricsService.recordIngestion({
    id: randomUUID(),
    idempotencyKey: logData.idKey,
    normalizedKey,
    cacheStatus: 'MISS',
    eventType: logData.eventType,
    amountCents: logData.amountCents,
    durationMs,
    timestamp: new Date().toISOString(),
  });
  return reply.code(504).send({
    error: 'GATEWAY_TIMEOUT',
    message: 'In-flight operation timed out waiting for worker. No duplicate job was scheduled.',
  });
}

async function handleLeaderExecution(
  reply: FastifyReply,
  merchantId: string,
  idempotencyKey: string,
  normalizedKey: string,
  body: WebhookBody,
  startTime: number,
) {
  const event = await prisma.webhookEvent.upsert({
    where: {
      merchantId_idempotencyKey: {
        merchantId,
        idempotencyKey,
      },
    },
    update: {},
    create: {
      merchantId,
      idempotencyKey,
      eventType: body.eventType,
      status: WEBHOOK_STATUS.PENDING,
      payload: body as unknown as Prisma.InputJsonValue,
    },
  });

  await webhooksIncomingQueue.add(
    'process-webhook',
    {
      merchantId,
      idempotencyKey,
      normalizedKey,
      eventType: body.eventType,
      amountCents: body.amountCents,
      reference: body.reference,
      payload: body,
      enqueuedAt: Date.now(),
    },
    {
      jobId: normalizedKey,
    },
  );

  const durationMs = Date.now() - startTime;
  metricsService.recordIngestion({
    id: randomUUID(),
    idempotencyKey,
    normalizedKey,
    cacheStatus: 'MISS',
    eventType: body.eventType,
    amountCents: body.amountCents,
    durationMs,
    timestamp: new Date().toISOString(),
  });

  return reply.header('X-Cache', 'MISS').code(202).send({
    status: 'queued',
    eventId: event.id,
    normalizedKey,
    reference: body.reference,
  });
}

export async function webhooksRoutes(fastify: FastifyInstance) {
  fastify.post('/webhooks/epayco', async (req: FastifyRequest, reply: FastifyReply) => {
    const startTime = Date.now();

    const headerResult = webhookHeadersSchema.safeParse(req.headers);
    if (!headerResult.success) {
      return reply.code(400).send({
        error: 'INVALID_HEADERS',
        details: headerResult.error.flatten(),
      });
    }

    const bodyResult = webhookBodySchema.safeParse(req.body);
    if (!bodyResult.success) {
      return reply.code(400).send({
        error: 'INVALID_BODY',
        details: bodyResult.error.flatten(),
      });
    }

    const idempotencyKey = headerResult.data['idempotency-key'];
    const apiKey = headerResult.data['x-api-key'];
    const body = bodyResult.data;

    const merchant = await prisma.merchantAccount.findUnique({
      where: { apiKey },
    });

    if (!merchant) {
      return reply.code(401).send({
        error: 'UNAUTHORIZED',
        message: 'Invalid merchant API key',
      });
    }

    const normalizedKey = idempotencyService.normalizeKey(merchant.id, idempotencyKey);

    // Phase 1: Fast Redis Cache Hit
    const cachedResponse = await idempotencyService.getCachedResponse(normalizedKey);
    if (cachedResponse) {
      const durationMs = Date.now() - startTime;
      metricsService.recordIngestion({
        id: randomUUID(),
        idempotencyKey,
        normalizedKey,
        cacheStatus: 'HIT',
        eventType: body.eventType,
        amountCents: body.amountCents,
        durationMs,
        timestamp: new Date().toISOString(),
      });
      return reply.header('X-Cache', 'HIT').code(200).send(cachedResponse);
    }

    // Phase 2: Distributed Lock Acquisition
    const lockToken = randomUUID();
    const lockAcquired = await idempotencyService.acquireLock(normalizedKey, lockToken);

    if (!lockAcquired) {
      return handleConcurrentRunner(reply, normalizedKey, startTime, {
        idKey: idempotencyKey,
        eventType: body.eventType,
        amountCents: body.amountCents,
      });
    }

    return handleLeaderExecution(
      reply,
      merchant.id,
      idempotencyKey,
      normalizedKey,
      body,
      startTime,
    );
  });
}

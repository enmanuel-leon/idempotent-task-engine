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
    cacheStatus: 'TIMEOUT_CONCURRENT',
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

const eventsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
  status: z
    .enum([
      WEBHOOK_STATUS.PENDING,
      WEBHOOK_STATUS.PROCESSING,
      WEBHOOK_STATUS.COMPLETED,
      WEBHOOK_STATUS.DEAD_LETTER,
    ])
    .optional(),
});

export async function webhooksRoutes(fastify: FastifyInstance) {
  fastify.get('/events', async (req: FastifyRequest, reply: FastifyReply) => {
    const query = eventsQuerySchema.parse(req.query);
    const skip = (query.page - 1) * query.pageSize;
    const take = query.pageSize;

    const whereClause: { status?: string } = {};
    if (query.status) {
      whereClause.status = query.status;
    }

    const [total, events] = await Promise.all([
      prisma.webhookEvent.count({ where: whereClause }),
      prisma.webhookEvent.findMany({
        where: whereClause,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          transaction: {
            select: {
              id: true,
              amountCents: true,
              reference: true,
            },
          },
        },
      }),
    ]);

    const totalPages = Math.ceil(total / query.pageSize);

    const data = events.map((evt) => {
      let amountDisplay = '0';
      let refDisplay = 'none';
      if (evt.transaction) {
        amountDisplay = evt.transaction.amountCents.toString();
        refDisplay = evt.transaction.reference;
      }

      let processedIso: string | null = null;
      if (evt.processedAt) {
        processedIso = evt.processedAt.toISOString();
      }

      return {
        id: evt.id,
        merchantId: evt.merchantId,
        idempotencyKey: evt.idempotencyKey,
        eventType: evt.eventType,
        status: evt.status,
        attempts: evt.attempts,
        lastError: evt.lastError,
        processedAt: processedIso,
        createdAt: evt.createdAt.toISOString(),
        amountCents: amountDisplay,
        reference: refDisplay,
      };
    });

    return reply.send({
      data,
      pagination: {
        total,
        page: query.page,
        pageSize: query.pageSize,
        totalPages,
      },
    });
  });

  fastify.post('/webhooks/epayco', async (req: FastifyRequest, reply: FastifyReply) => {
    const startTime = Date.now();

    const headerResult = webhookHeadersSchema.safeParse(req.headers);
    if (!headerResult.success) {
      return reply.code(400).send({
        error: 'INVALID_HEADERS',
        details: z.flattenError(headerResult.error),
      });
    }

    const bodyResult = webhookBodySchema.safeParse(req.body);
    if (!bodyResult.success) {
      return reply.code(400).send({
        error: 'INVALID_BODY',
        details: z.flattenError(bodyResult.error),
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

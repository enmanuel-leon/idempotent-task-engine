import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { metricsService } from '../../services/metrics.service.js';
import { prisma } from '../../lib/prisma.js';

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
});

export async function metricsRoutes(fastify: FastifyInstance) {
  fastify.get('/metrics/stream', async (req: FastifyRequest, reply: FastifyReply) => {
    reply.raw.setHeader('Content-Type', 'text/event-stream');
    reply.raw.setHeader('Cache-Control', 'no-cache');
    reply.raw.setHeader('Connection', 'keep-alive');
    reply.raw.setHeader('Access-Control-Allow-Origin', '*');
    reply.raw.flushHeaders();

    metricsService.registerSseClient(reply);

    // Send immediate snapshot upon connection
    const snapshot = await metricsService.getSnapshot();
    reply.raw.write('data: ' + JSON.stringify(snapshot) + '\n\n');
  });

  fastify.get('/metrics/summary', async (_req: FastifyRequest, reply: FastifyReply) => {
    const snapshot = await metricsService.getSnapshot();
    return reply.send(snapshot);
  });

  fastify.get('/merchant', async (_req: FastifyRequest, reply: FastifyReply) => {
    const merchant = await prisma.merchantAccount.findFirst({
      orderBy: { createdAt: 'asc' },
    });
    if (!merchant) {
      return reply.code(404).send({ error: 'NOT_FOUND', message: 'Merchant not found' });
    }
    return reply.send({
      id: merchant.id,
      name: merchant.name,
      apiKey: merchant.apiKey,
      balanceCents: merchant.balanceCents.toString(),
      currency: merchant.currency,
    });
  });

  fastify.get('/transactions', async (req: FastifyRequest, reply: FastifyReply) => {
    const query = paginationSchema.parse(req.query);
    const skip = (query.page - 1) * query.pageSize;
    const take = query.pageSize;

    const [total, transactions] = await Promise.all([
      prisma.transaction.count(),
      prisma.transaction.findMany({
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          webhookEvent: {
            select: {
              eventType: true,
              idempotencyKey: true,
              status: true,
            },
          },
        },
      }),
    ]);

    const totalPages = Math.ceil(total / query.pageSize);

    const data = transactions.map((tx) => ({
      id: tx.id,
      merchantId: tx.merchantId,
      reference: tx.reference,
      amountCents: tx.amountCents.toString(),
      createdAt: tx.createdAt.toISOString(),
      eventType: tx.webhookEvent.eventType,
      idempotencyKey: tx.webhookEvent.idempotencyKey,
      status: tx.webhookEvent.status,
    }));

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
}

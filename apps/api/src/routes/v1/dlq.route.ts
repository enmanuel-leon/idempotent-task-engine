import { resetTaskEngineData } from '../../services/admin.service.js';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { webhooksDlqQueue, webhooksIncomingQueue } from '../../lib/queue.js';
import { prisma } from '../../lib/prisma.js';
import { WEBHOOK_STATUS } from '../../constants/engine.constants.js';

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
});

const replaySchema = z.object({
  jobId: z.string().optional(),
});

export async function dlqRoutes(fastify: FastifyInstance) {
  fastify.get('/admin/dlq', async (req: FastifyRequest, reply: FastifyReply) => {
    const query = querySchema.parse(req.query);
    const start = (query.page - 1) * query.pageSize;
    const end = start + query.pageSize - 1;

    const [total, jobs] = await Promise.all([
      webhooksDlqQueue.count(),
      webhooksDlqQueue.getJobs(['failed', 'waiting', 'delayed'], start, end),
    ]);

    const totalPages = Math.ceil(total / query.pageSize);

    const data = jobs.map((job) => ({
      id: job.id,
      name: job.name,
      data: job.data,
      failedReason: job.failedReason,
      attemptsMade: job.attemptsMade,
      timestamp: job.timestamp,
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

  fastify.post('/admin/dlq/replay', async (req: FastifyRequest, reply: FastifyReply) => {
    const parsed = replaySchema.safeParse(req.body ?? {});
    let targetJobId: string | undefined;
    if (parsed.success && parsed.data.jobId) {
      targetJobId = parsed.data.jobId;
    }

    let replayedCount = 0;

    if (targetJobId) {
      const job = await webhooksDlqQueue.getJob(targetJobId);
      if (job) {
        await webhooksIncomingQueue.add(job.name, job.data, {
          jobId: job.data.normalizedKey,
        });
        await job.remove();
        replayedCount = 1;

        await prisma.webhookEvent.updateMany({
          where: {
            merchantId: job.data.merchantId,
            idempotencyKey: job.data.idempotencyKey,
          },
          data: {
            status: WEBHOOK_STATUS.PENDING,
            attempts: 0,
            lastError: null,
          },
        });
      }
    } else {
      const allJobs = await webhooksDlqQueue.getJobs(['failed', 'waiting', 'delayed']);
      for (const job of allJobs) {
        await webhooksIncomingQueue.add(job.name, job.data, {
          jobId: job.data.normalizedKey,
        });
        await job.remove();
        replayedCount += 1;

        await prisma.webhookEvent.updateMany({
          where: {
            merchantId: job.data.merchantId,
            idempotencyKey: job.data.idempotencyKey,
          },
          data: {
            status: WEBHOOK_STATUS.PENDING,
            attempts: 0,
            lastError: null,
          },
        });
      }
    }

    return reply.send({
      success: true,
      replayedCount,
    });
  });

  fastify.post('/admin/reset', async (_req: FastifyRequest, reply: FastifyReply) => {
    const result = await resetTaskEngineData();
    return reply.send({
      success: true,
      ...result,
    });
  });
}

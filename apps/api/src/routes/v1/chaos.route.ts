import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { chaosService } from '../../services/chaos.service.js';

const toggleSchema = z.object({
  enabled: z.boolean().optional(),
});

export async function chaosRoutes(fastify: FastifyInstance) {
  fastify.get('/chaos/status', async (_req: FastifyRequest, reply: FastifyReply) => {
    return reply.send(chaosService.getChaosStatus());
  });

  fastify.post('/chaos/flaky-gateway', async (req: FastifyRequest, reply: FastifyReply) => {
    const parsed = toggleSchema.safeParse(req.body ?? {});
    let nextState = !chaosService.isFlakyGatewayEnabled();
    if (parsed.success && parsed.data.enabled !== undefined) {
      nextState = parsed.data.enabled;
    }
    chaosService.setFlakyGateway(nextState);
    return reply.send(chaosService.getChaosStatus());
  });

  fastify.post('/chaos/db-latency', async (req: FastifyRequest, reply: FastifyReply) => {
    const parsed = toggleSchema.safeParse(req.body ?? {});
    let nextState = !chaosService.isDbLatencySpikeEnabled();
    if (parsed.success && parsed.data.enabled !== undefined) {
      nextState = parsed.data.enabled;
    }
    chaosService.setDbLatencySpike(nextState);
    return reply.send(chaosService.getChaosStatus());
  });
}

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getRedisClient } from '../../lib/redis.js';
import { prisma } from '../../lib/prisma.js';

export async function healthRoutes(fastify: FastifyInstance) {
  fastify.get('/health', async (_req: FastifyRequest, reply: FastifyReply) => {
    let dbOk = false;
    let redisOk = false;

    try {
      await prisma.$queryRaw`SELECT 1`;
      dbOk = true;
    } catch {
      dbOk = false;
    }

    try {
      const pingRes = await getRedisClient().ping();
      if (pingRes === 'PONG') {
        redisOk = true;
      }
    } catch {
      redisOk = false;
    }

    let status = 'ok';
    let statusCode = 200;
    if (!dbOk || !redisOk) {
      status = 'degraded';
      statusCode = 503;
    }

    let databaseStatus = 'unhealthy';
    if (dbOk) {
      databaseStatus = 'healthy';
    }

    let redisStatus = 'unhealthy';
    if (redisOk) {
      redisStatus = 'healthy';
    }

    return reply.code(statusCode).send({
      status,
      database: databaseStatus,
      redis: redisStatus,
      timestamp: new Date().toISOString(),
    });
  });
}

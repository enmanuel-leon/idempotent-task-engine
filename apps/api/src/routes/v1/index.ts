import type { FastifyInstance } from 'fastify';
import { healthRoutes } from './health.route.js';
import { webhooksRoutes } from './webhooks.route.js';
import { metricsRoutes } from './metrics.route.js';
import { chaosRoutes } from './chaos.route.js';
import { dlqRoutes } from './dlq.route.js';

export async function v1Routes(fastify: FastifyInstance) {
  await fastify.register(healthRoutes);
  await fastify.register(webhooksRoutes);
  await fastify.register(metricsRoutes);
  await fastify.register(chaosRoutes);
  await fastify.register(dlqRoutes);
}

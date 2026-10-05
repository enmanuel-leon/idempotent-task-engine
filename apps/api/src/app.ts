import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import { env } from './config/env.js';
import { API_VERSION } from './config/constants.js';
import { swaggerPlugin } from './plugins/swagger.plugin.js';
import { sensiblePlugin } from './plugins/sensible.plugin.js';
import { errorHandlerPlugin } from './plugins/error-handler.plugin.js';
import { bullBoardPlugin } from './plugins/bull-board.plugin.js';
import { v1Routes } from './routes/v1/index.js';
import { healthRoutes } from './routes/v1/health.route.js';
import { webhooksRoutes } from './routes/v1/webhooks.route.js';

export async function buildApp() {
  const isTest = env.NODE_ENV === 'test';
  const app = Fastify({
    logger: !isTest,
  });

  await app.register(cors, {
    origin: env.CORS_ORIGIN,
    credentials: true,
  });

  await app.register(helmet, {
    contentSecurityPolicy: false,
  });

  await app.register(errorHandlerPlugin);
  await app.register(sensiblePlugin);
  await app.register(swaggerPlugin);
  await app.register(bullBoardPlugin);

  // Versioned routes (/api/v1/...)
  await app.register(v1Routes, { prefix: `/api/${API_VERSION}` });

  // Unprefixed convenience aliases (/health, /webhooks/epayco)
  await app.register(healthRoutes);
  await app.register(webhooksRoutes);

  return app;
}

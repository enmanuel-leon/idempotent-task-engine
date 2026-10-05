import { buildApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { startWorker, stopWorker } from './services/worker.service.js';
import { prisma } from './lib/prisma.js';

try {
  const app = await buildApp();

  // Start the BullMQ worker alongside the API in development
  const _worker = startWorker();
  logger.info({ concurrency: 20 }, 'BullMQ Webhook Worker started');

  await app.listen({ port: env.PORT, host: env.HOST });
  logger.info(`Server running at http://${env.HOST}:${env.PORT}`);
  logger.info(`OpenAPI docs available at http://${env.HOST}:${env.PORT}/docs`);
  logger.info(`Bull-Board queue UI available at http://${env.HOST}:${env.PORT}/admin/queues`);

  const signals = ['SIGINT', 'SIGTERM'];
  for (const signal of signals) {
    process.on(signal, async () => {
      logger.info(`Received ${signal}, closing services gracefully...`);
      await stopWorker();
      await app.close();
      await prisma.$disconnect();
      process.exit(0);
    });
  }
} catch (err) {
  logger.error(err);
  process.exitCode = 1;
}

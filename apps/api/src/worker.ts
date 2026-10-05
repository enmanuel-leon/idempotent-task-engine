import { startWorker, stopWorker } from './services/worker.service.js';
import { logger } from './config/logger.js';
import { prisma } from './lib/prisma.js';

logger.info('Starting standalone BullMQ Webhook Worker process...');
const _worker = startWorker();

const signals = ['SIGINT', 'SIGTERM'];
for (const signal of signals) {
  process.on(signal, async () => {
    logger.info(`Received ${signal}, shutting down standalone worker...`);
    await stopWorker();
    await prisma.$disconnect();
    process.exit(0);
  });
}

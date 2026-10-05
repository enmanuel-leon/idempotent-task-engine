import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { FastifyAdapter } from '@bull-board/fastify';
import fp from 'fastify-plugin';
import { webhooksIncomingQueue, webhooksDlqQueue } from '../lib/queue.js';

export const bullBoardPlugin = fp(async (fastify) => {
  const serverAdapter = new FastifyAdapter();

  createBullBoard({
    queues: [new BullMQAdapter(webhooksIncomingQueue), new BullMQAdapter(webhooksDlqQueue)],
    serverAdapter,
  });

  serverAdapter.setBasePath('/admin/queues');
  await fastify.register(serverAdapter.registerPlugin(), { prefix: '/admin/queues' });
});

import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import { buildApp } from '../../src/app.js';
import { webhooksDlqQueue } from '../../src/lib/queue.js';

describe('DLQ Route Integration', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/v1/dlq returns 200 with data array and pagination', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/dlq?page=1&pageSize=10',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body).toHaveProperty('data');
    expect(Array.isArray(body.data)).toBe(true);
    expect(body).toHaveProperty('pagination');
    expect(body.pagination).toHaveProperty('total');
    expect(body.pagination).toHaveProperty('totalPages');
    expect(body.pagination.page).toBe(1);
    expect(body.pagination.pageSize).toBe(10);
  });

  it('POST /api/v1/dlq/non-existent-id/retry returns 404', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/dlq/non-existent-id/retry',
    });

    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.payload);
    expect(body.error).toBe('NOT_FOUND');
  });

  it('POST /api/v1/dlq/:id/retry retries existing DLQ job', async () => {
    const job = await webhooksDlqQueue.add('test-dlq-item', {
      merchantId: randomUUID(),
      idempotencyKey: 'k_test',
      normalizedKey: 'norm_test',
      eventType: 'PAYMENT_SUCCEEDED',
      amountCents: 1000,
      reference: 'ref_dlq_test',
      payload: {},
      enqueuedAt: Date.now(),
    });

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/dlq/${job.id}/retry`,
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
  });

  it('DELETE /api/v1/dlq returns 200 with purgedCount', async () => {
    await webhooksDlqQueue.add('test-purge-item', {
      merchantId: randomUUID(),
      idempotencyKey: 'k_purge',
      normalizedKey: 'norm_purge',
      eventType: 'PAYMENT_SUCCEEDED',
      amountCents: 1000,
      reference: 'ref_purge',
      payload: {},
      enqueuedAt: Date.now(),
    });

    const res = await app.inject({
      method: 'DELETE',
      url: '/api/v1/dlq',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body).toHaveProperty('purgedCount');
    expect(body.purgedCount).toBeGreaterThan(0);
  });

  it('POST /api/v1/admin/dlq/replay replays all DLQ jobs when no jobId specified', async () => {
    await webhooksDlqQueue.add('test-replay-all', {
      merchantId: randomUUID(),
      idempotencyKey: 'k_test_all',
      normalizedKey: 'norm_test_all',
      eventType: 'PAYMENT_SUCCEEDED',
      amountCents: 1000,
      reference: 'ref_dlq_all',
      payload: {},
      enqueuedAt: Date.now(),
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/dlq/replay',
      payload: {},
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.replayedCount).toBeGreaterThan(0);
  });

  it('POST /api/v1/admin/dlq/replay with specific jobId retries job', async () => {
    const job = await webhooksDlqQueue.add('test-replay-single', {
      merchantId: randomUUID(),
      idempotencyKey: 'k_test_single',
      normalizedKey: 'norm_test_single',
      eventType: 'PAYMENT_SUCCEEDED',
      amountCents: 1000,
      reference: 'ref_dlq_single',
      payload: {},
      enqueuedAt: Date.now(),
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/dlq/replay',
      payload: { jobId: job.id },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.replayedCount).toBe(1);
  });
});

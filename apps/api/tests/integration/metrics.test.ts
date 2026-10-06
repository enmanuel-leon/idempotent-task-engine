import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/app.js';

describe('Metrics Route Integration', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/v1/metrics returns 200 with snapshot data', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/metrics',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body).toHaveProperty('totalIngested');
    expect(body).toHaveProperty('totalDuplicates');
    expect(body).toHaveProperty('recentFeed');
    expect(Array.isArray(body.recentFeed)).toBe(true);
    expect(body).toHaveProperty('rps');
    expect(body).toHaveProperty('dedupEfficiency');
  });

  it('POST /api/v1/metrics/reset returns 200 and resets counters', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/metrics/reset',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
  });

  it('GET /api/v1/metrics/stream returns 200 with text/event-stream content-type', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/metrics/stream',
    });

    expect(res.statusCode).toBe(200);
    const contentType = res.headers['content-type'];
    expect(contentType).toContain('text/event-stream');
    expect(res.payload).toContain('data:');
  });

  it('GET /api/v1/metrics/summary returns 200 with snapshot', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/metrics/summary',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body).toHaveProperty('totalIngested');
    expect(body).toHaveProperty('rps');
  });

  it('GET /api/v1/merchant returns 200 with merchant account details', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/merchant',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body).toHaveProperty('id');
    expect(body).toHaveProperty('name');
    expect(body).toHaveProperty('apiKey');
    expect(body).toHaveProperty('balanceCents');
  });

  it('GET /api/v1/transactions returns 200 with paginated envelope', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/transactions?page=1&pageSize=5',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body).toHaveProperty('data');
    expect(Array.isArray(body.data)).toBe(true);
    expect(body).toHaveProperty('pagination');
    expect(body.pagination.page).toBe(1);
    expect(body.pagination.pageSize).toBe(5);
  });
});

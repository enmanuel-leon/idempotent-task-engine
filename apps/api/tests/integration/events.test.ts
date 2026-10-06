import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/app.js';

describe('Events Route Integration', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/v1/events should return paginated envelope', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/events?page=1&pageSize=10',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body).toHaveProperty('data');
    expect(body).toHaveProperty('pagination');
    expect(body.pagination).toHaveProperty('total');
    expect(body.pagination).toHaveProperty('totalPages');
    expect(body.pagination.page).toBe(1);
    expect(body.pagination.pageSize).toBe(10);
  });

  it('GET /api/v1/events with status filter returns filtered results', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/events?page=1&pageSize=5&status=PENDING',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body).toHaveProperty('data');
    expect(Array.isArray(body.data)).toBe(true);
  });
});

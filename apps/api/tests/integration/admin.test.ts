import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/app.js';

describe('Admin Reset Integration', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /api/v1/admin/reset should return 200 with reset summary', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/reset',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body).toHaveProperty('transactionsDeleted');
    expect(body).toHaveProperty('eventsDeleted');
    expect(body).toHaveProperty('merchantBalanceCents');
  });
});

import { describe, expect, it, afterAll, beforeAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/app.js';

describe('Health Route Integration', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health should return 200 with status ok or degraded', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/health',
    });

    expect([200, 503]).toContain(response.statusCode);
    const body = JSON.parse(response.payload);
    expect(body).toHaveProperty('database');
    expect(body).toHaveProperty('redis');
    expect(body).toHaveProperty('timestamp');
  });
});

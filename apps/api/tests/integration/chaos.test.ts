import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/app.js';
import { chaosService } from '../../src/services/chaos.service.js';

describe('Chaos Route Integration', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(async () => {
    chaosService.setFlakyGateway(false);
    chaosService.setDbLatencySpike(false);
    await app.close();
  });

  it('GET /api/v1/chaos returns 200 with flakyGateway and dbLatency status', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/chaos',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body).toHaveProperty('flakyGateway');
    expect(body).toHaveProperty('dbLatency');
  });

  it('POST /api/v1/chaos/flaky-gateway returns 200 with updated status', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/chaos/flaky-gateway',
      payload: { enabled: true },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.flakyGateway).toBe(true);
  });

  it('POST /api/v1/chaos/db-latency returns 200 with updated status', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/chaos/db-latency',
      payload: { enabled: true },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.dbLatency).toBe(true);
  });

  it('POST /api/v1/chaos/flaky-gateway returns 400 with invalid payload', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/chaos/flaky-gateway',
      payload: { enabled: 'invalid-string' },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.payload);
    expect(body.error).toBe('BAD_REQUEST');
  });
});

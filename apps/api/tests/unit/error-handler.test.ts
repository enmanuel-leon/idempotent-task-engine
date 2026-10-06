import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { errorHandlerPlugin } from '../../src/plugins/error-handler.plugin.js';
import { sensiblePlugin } from '../../src/plugins/sensible.plugin.js';

describe('Error Handler Plugin Unit Tests', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify({ logger: false });
    await app.register(errorHandlerPlugin);
    await app.register(sensiblePlugin);

    app.get('/test-zod', async () => {
      const schema = z.object({ count: z.number() });
      schema.parse({ count: 'not-a-number' });
    });

    app.get('/test-not-found', async (_req, reply) => {
      return reply.notFound('Resource not found');
    });

    app.get('/test-custom-status', async () => {
      const err = new Error('Payment Required') as Error & { statusCode: number; code: string };
      err.statusCode = 402;
      err.code = 'PAYMENT_REQUIRED';
      throw err;
    });

    app.get('/test-500', async () => {
      throw new Error('Database connection failed unexpectedly');
    });

    app.get('/test-p2002', async () => {
      const err = new Error('Unique violation') as Error & { code: string };
      err.code = 'P2002';
      throw err;
    });

    app.get('/test-p2025', async () => {
      const err = new Error('Record not found') as Error & { code: string };
      err.code = 'P2025';
      throw err;
    });

    app.get('/test-p2003', async () => {
      const err = new Error('FK violation') as Error & { code: string };
      err.code = 'P2003';
      throw err;
    });

    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('handles Zod validation error with 400 and VALIDATION_ERROR code', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/test-zod',
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.payload);
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.statusCode).toBe(400);
    expect(body.error).toHaveProperty('details');
  });

  it('handles sensible notFound() with 404 status', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/test-not-found',
    });

    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.payload);
    expect(body.error.statusCode).toBe(404);
  });

  it('handles custom error with statusCode and code', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/test-custom-status',
    });

    expect(res.statusCode).toBe(402);
    const body = JSON.parse(res.payload);
    expect(body.error.code).toBe('PAYMENT_REQUIRED');
    expect(body.error.statusCode).toBe(402);
  });

  it('handles unexpected 500 error', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/test-500',
    });

    expect(res.statusCode).toBe(500);
    const body = JSON.parse(res.payload);
    expect(body.error.code).toBe('INTERNAL_SERVER_ERROR');
    expect(body.error.statusCode).toBe(500);
  });

  it.each([
    {
      name: 'unique constraint error with 409',
      url: '/test-p2002',
      expectedStatus: 409,
      expectedCode: 'UNIQUE_CONSTRAINT_VIOLATION',
    },
    {
      name: 'record not found error with 404',
      url: '/test-p2025',
      expectedStatus: 404,
      expectedCode: 'RECORD_NOT_FOUND',
    },
    {
      name: 'foreign key violation error with 400',
      url: '/test-p2003',
      expectedStatus: 400,
      expectedCode: 'FOREIGN_KEY_VIOLATION',
    },
  ])('handles Prisma $name', async ({ url, expectedStatus, expectedCode }) => {
    const res = await app.inject({
      method: 'GET',
      url,
    });
    expect(res.statusCode).toBe(expectedStatus);
    const body = JSON.parse(res.payload);
    expect(body.error.code).toBe(expectedCode);
  });
});

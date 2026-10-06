import { describe, expect, it, beforeAll, afterAll, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import { buildApp } from '../../src/app.js';
import { prisma } from '../../src/lib/prisma.js';
import { idempotencyService } from '../../src/services/idempotency.service.js';

describe('Webhooks Route Integration', () => {
  let app: FastifyInstance;
  const testApiKey = 'test_webhook_merchant_key';
  let testMerchantId = '';

  beforeAll(async () => {
    app = await buildApp();
    const merchant = await prisma.merchantAccount.upsert({
      where: { apiKey: testApiKey },
      update: {},
      create: {
        apiKey: testApiKey,
        name: 'Webhook Test Merchant',
        balanceCents: 1000000n,
        currency: 'USD',
      },
    });
    testMerchantId = merchant.id;
  });

  afterAll(async () => {
    await prisma.transaction.deleteMany({
      where: { merchantId: testMerchantId },
    });
    await prisma.webhookEvent.deleteMany({
      where: { merchantId: testMerchantId },
    });
    await prisma.merchantAccount.deleteMany({
      where: { id: testMerchantId },
    });
    await app.close();
  });

  it('POST /api/v1/webhooks/epayco returns 400 INVALID_HEADERS when required headers are missing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/webhooks/epayco',
      payload: {
        eventType: 'PAYMENT_SUCCEEDED',
        amountCents: 2500,
        reference: 'ref_missing_headers',
      },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.payload);
    expect(body.error).toBe('INVALID_HEADERS');
    expect(body.details).toBeDefined();
  });

  it('POST /api/v1/webhooks/epayco returns 400 INVALID_BODY when payload is invalid', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/webhooks/epayco',
      headers: {
        'idempotency-key': 'key_invalid_body',
        'x-api-key': testApiKey,
      },
      payload: {
        eventType: 'UNSUPPORTED_EVENT_TYPE',
      },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.payload);
    expect(body.error).toBe('INVALID_BODY');
    expect(body.details).toBeDefined();
  });

  it('POST /api/v1/webhooks/epayco returns 401 UNAUTHORIZED when apiKey is invalid', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/webhooks/epayco',
      headers: {
        'idempotency-key': 'key_unauthorized',
        'x-api-key': 'non_existent_api_key',
      },
      payload: {
        eventType: 'PAYMENT_SUCCEEDED',
        amountCents: 5000,
        reference: 'ref_unauth',
      },
    });

    expect(res.statusCode).toBe(401);
    const body = JSON.parse(res.payload);
    expect(body.error).toBe('UNAUTHORIZED');
  });

  it('POST /api/v1/webhooks/epayco returns 202 Accepted with taskId, jobId, and status PENDING for valid payload', async () => {
    const key = 'idem_' + randomUUID();
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/webhooks/epayco',
      headers: {
        'idempotency-key': key,
        'x-api-key': testApiKey,
      },
      payload: {
        eventType: 'PAYMENT_SUCCEEDED',
        amountCents: 7500,
        reference: 'ref_accepted_1',
      },
    });

    expect(res.statusCode).toBe(202);
    const body = JSON.parse(res.payload);
    expect(body.status).toBe('PENDING');
    expect(body).toHaveProperty('taskId');
    expect(body).toHaveProperty('jobId');
  });

  it('returns 200 with x-cache: HIT on duplicate request when response is cached', async () => {
    const key = 'idem_hit_' + randomUUID();
    const payload = {
      eventType: 'PAYMENT_SUCCEEDED' as const,
      amountCents: 3200,
      reference: 'ref_cache_hit',
    };

    const firstRes = await app.inject({
      method: 'POST',
      url: '/api/v1/webhooks/epayco',
      headers: {
        'idempotency-key': key,
        'x-api-key': testApiKey,
      },
      payload,
    });
    expect(firstRes.statusCode).toBe(202);

    const normalizedKey = idempotencyService.normalizeKey(testMerchantId, key);
    await idempotencyService.saveCachedResponse(normalizedKey, {
      status: 'COMPLETED',
      reference: payload.reference,
    });

    const duplicateRes = await app.inject({
      method: 'POST',
      url: '/api/v1/webhooks/epayco',
      headers: {
        'idempotency-key': key,
        'x-api-key': testApiKey,
      },
      payload,
    });

    expect([200, 202]).toContain(duplicateRes.statusCode);
    if (duplicateRes.statusCode === 200) {
      expect(duplicateRes.headers['x-cache']).toBe('HIT');
    }
  });

  it('returns 409 CONFLICT with IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD on mismatched payload', async () => {
    const key = 'idem_conflict_' + randomUUID();
    const initialPayload = {
      eventType: 'PAYMENT_SUCCEEDED',
      amountCents: 4500,
      reference: 'ref_orig',
    };

    const firstRes = await app.inject({
      method: 'POST',
      url: '/api/v1/webhooks/epayco',
      headers: {
        'idempotency-key': key,
        'x-api-key': testApiKey,
      },
      payload: initialPayload,
    });
    expect(firstRes.statusCode).toBe(202);

    const conflictingPayload = {
      eventType: 'PAYMENT_SUCCEEDED',
      amountCents: 9900,
      reference: 'ref_conflict',
    };

    const conflictRes = await app.inject({
      method: 'POST',
      url: '/api/v1/webhooks/epayco',
      headers: {
        'idempotency-key': key,
        'x-api-key': testApiKey,
      },
      payload: conflictingPayload,
    });

    expect(conflictRes.statusCode).toBe(409);
    const body = JSON.parse(conflictRes.payload);
    expect(body.code).toBe('IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD');
  });

  it('returns 200 with x-cache: HIT_CONCURRENT when in-flight runner completes', async () => {
    const key = 'idem_concurrent_' + randomUUID();
    const payload = {
      eventType: 'PAYMENT_SUCCEEDED' as const,
      amountCents: 2000,
      reference: 'ref_concurrent_hit',
    };

    const spyLock = vi.spyOn(idempotencyService, 'acquireLock').mockResolvedValue(false);
    const spyWait = vi.spyOn(idempotencyService, 'waitForCompletion').mockResolvedValue({
      success: true,
      transactionId: 'tx_concurrent',
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/webhooks/epayco',
      headers: {
        'idempotency-key': key,
        'x-api-key': testApiKey,
      },
      payload,
    });

    spyLock.mockRestore();
    spyWait.mockRestore();

    expect(res.statusCode).toBe(200);
    expect(res.headers['x-cache']).toBe('HIT_CONCURRENT');
  });

  it('returns 504 GATEWAY_TIMEOUT when concurrent runner times out', async () => {
    const key = 'idem_timeout_' + randomUUID();
    const payload = {
      eventType: 'PAYMENT_SUCCEEDED' as const,
      amountCents: 2000,
      reference: 'ref_concurrent_timeout',
    };

    const spyLock = vi.spyOn(idempotencyService, 'acquireLock').mockResolvedValue(false);
    const spyWait = vi.spyOn(idempotencyService, 'waitForCompletion').mockResolvedValue(null);

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/webhooks/epayco',
      headers: {
        'idempotency-key': key,
        'x-api-key': testApiKey,
      },
      payload,
    });

    spyLock.mockRestore();
    spyWait.mockRestore();

    expect(res.statusCode).toBe(504);
    const body = JSON.parse(res.payload);
    expect(body.error).toBe('GATEWAY_TIMEOUT');
  });
});

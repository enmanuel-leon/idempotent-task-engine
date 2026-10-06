import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getApiUrl, apiClient } from '../../src/lib/api-client';

describe('api-client', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe('getApiUrl', () => {
    it('returns original path when path starts with http', () => {
      expect(getApiUrl('http://example.com/api')).toBe('http://example.com/api');
      expect(getApiUrl('https://api.example.com/v1')).toBe('https://api.example.com/v1');
    });

    it('returns combined path when path is relative', () => {
      const result = getApiUrl('/api/v1/resource');
      expect(result.endsWith('/api/v1/resource')).toBe(true);
    });
  });

  describe('apiClient / apiFetch', () => {
    it('executes GET request and returns json payload', async () => {
      const mockPayload = { id: '123', name: 'Test Merchant' };
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockPayload,
      } as Response);

      const result = await apiClient<typeof mockPayload>('/api/v1/merchant');

      expect(result).toEqual(mockPayload);
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    });

    it('executes POST request with JSON body and Content-Type header', async () => {
      const mockPayload = { success: true };
      let capturedInit: RequestInit | undefined;

      globalThis.fetch = vi.fn().mockImplementation(async (_url, init) => {
        capturedInit = init;
        return {
          ok: true,
          status: 200,
          json: async () => mockPayload,
        } as Response;
      });

      const bodyData = { enabled: true };
      const result = await apiClient('/api/v1/chaos/flaky-gateway', {
        method: 'POST',
        body: JSON.stringify(bodyData),
      });

      expect(result).toEqual(mockPayload);
      const headers = capturedInit?.headers as Record<string, string>;
      expect(headers['Content-Type']).toBe('application/json');
    });

    it('supports plain object for request headers', async () => {
      let capturedHeaders: Record<string, string> = {};
      globalThis.fetch = vi.fn().mockImplementation(async (_url, init) => {
        capturedHeaders = init?.headers as Record<string, string>;
        return {
          ok: true,
          status: 200,
          json: async () => ({ ok: true }),
        } as Response;
      });

      await apiClient('/api/v1/object-headers', {
        headers: { 'x-trace-id': 'trace-123' },
      });

      expect(capturedHeaders['x-trace-id']).toBe('trace-123');
    });

    it('supports Headers instance for request headers', async () => {
      const customHeaders = new Headers();
      customHeaders.set('x-api-key', 'secret-key');

      let capturedHeaders: Record<string, string> = {};
      globalThis.fetch = vi.fn().mockImplementation(async (_url, init) => {
        capturedHeaders = init?.headers as Record<string, string>;
        return {
          ok: true,
          status: 200,
          json: async () => ({ ok: true }),
        } as Response;
      });

      await apiClient('/api/v1/custom-headers', {
        headers: customHeaders,
      });

      expect(capturedHeaders['x-api-key']).toBe('secret-key');
    });

    it('supports headers array for request headers', async () => {
      let capturedHeaders: Record<string, string> = {};
      globalThis.fetch = vi.fn().mockImplementation(async (_url, init) => {
        capturedHeaders = init?.headers as Record<string, string>;
        return {
          ok: true,
          status: 200,
          json: async () => ({ ok: true }),
        } as Response;
      });

      await apiClient('/api/v1/array-headers', {
        headers: [['x-custom-entry', 'custom-value']],
      });

      expect(capturedHeaders['x-custom-entry']).toBe('custom-value');
    });

    it('throws error with message from response body on failure', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ message: 'Invalid payload submitted' }),
      } as Response);

      await expect(apiClient('/api/v1/error')).rejects.toThrow('Invalid payload submitted');
    });

    it('throws fallback HTTP status error when response body is not json', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 502,
        json: async () => {
          throw new Error('Bad Gateway text');
        },
      } as Response);

      await expect(apiClient('/api/v1/broken')).rejects.toThrow('HTTP error 502');
    });

    it('dispatches auth:forbidden-organization event on FORBIDDEN_ORGANIZATION_ACCESS', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        json: async () => ({ message: 'Error: FORBIDDEN_ORGANIZATION_ACCESS' }),
      } as Response);

      const receivedEvents: CustomEvent[] = [];
      const listener = (event: Event) => {
        receivedEvents.push(event as CustomEvent);
      };

      window.addEventListener('auth:forbidden-organization', listener);

      try {
        await apiClient('/api/v1/protected');
      } catch {
        // Expected throw
      } finally {
        window.removeEventListener('auth:forbidden-organization', listener);
      }

      expect(receivedEvents).toHaveLength(1);
      expect(receivedEvents[0].detail.status).toBe(403);
      expect(receivedEvents[0].detail.message).toBe('Error: FORBIDDEN_ORGANIZATION_ACCESS');
    });
  });
});

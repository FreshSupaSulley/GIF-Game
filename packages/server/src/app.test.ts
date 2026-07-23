import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { createApp } from './app';
import type { Config } from './config';
import http from 'node:http';
import type { AddressInfo } from 'node:net';

const TEST_CONFIG: Config = {
  discordClientId: 'test_client_id',
  discordClientSecret: 'test_client_secret',
  port: 0,
};

/**
 * Helper to make requests to the test server using raw http module
 * to avoid conflicts with global fetch mocking.
 */
function makeRequest(
  baseUrl: string,
  path: string,
  options: { method: string; body?: unknown }
): Promise<{ status: number; body: unknown }> {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const bodyStr = options.body ? JSON.stringify(options.body) : undefined;

    const req = http.request(
      url,
      {
        method: options.method,
        headers: {
          'Content-Type': 'application/json',
          ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr).toString() } : {}),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode ?? 500, body: JSON.parse(data) });
          } catch {
            resolve({ status: res.statusCode ?? 500, body: data });
          }
        });
      }
    );
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

describe('POST /api/token', () => {
  let server: http.Server;
  let baseUrl: string;

  beforeAll(() => {
    const app = createApp(TEST_CONFIG);
    server = app.listen(0);
    const address = server.address() as AddressInfo;
    baseUrl = `http://localhost:${address.port}`;
  });

  afterAll(() => {
    server.close();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('input validation', () => {
    it('returns 400 with descriptive error when request body is empty', async () => {
      const { status, body } = await makeRequest(baseUrl, '/api/token', {
        method: 'POST',
        body: {},
      });

      expect(status).toBe(400);
      expect(body).toEqual({ error: 'Missing or invalid "code" in request body' });
    });

    it('returns 400 when code is not a string', async () => {
      const { status, body } = await makeRequest(baseUrl, '/api/token', {
        method: 'POST',
        body: { code: 123 },
      });

      expect(status).toBe(400);
      expect(body).toEqual({ error: 'Missing or invalid "code" in request body' });
    });
  });

  describe('successful token exchange', () => {
    it('sends correct params to Discord and returns the token response', async () => {
      const mockTokenResponse = {
        access_token: 'mock_access_token',
        token_type: 'Bearer',
        expires_in: 604800,
        scope: 'identify',
      };

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify(mockTokenResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      const { status, body } = await makeRequest(baseUrl, '/api/token', {
        method: 'POST',
        body: { code: 'test_auth_code' },
      });

      expect(status).toBe(200);
      expect(body).toEqual(mockTokenResponse);

      // Verify the outgoing call to Discord
      expect(fetchSpy).toHaveBeenCalledOnce();
      expect(fetchSpy).toHaveBeenCalledWith(
        'https://discord.com/api/oauth2/token',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        })
      );

      // Verify the body params sent to Discord
      const sentBody = fetchSpy.mock.calls[0][1]?.body as string;
      const sentParams = new URLSearchParams(sentBody);
      expect(sentParams.get('client_id')).toBe('test_client_id');
      expect(sentParams.get('client_secret')).toBe('test_client_secret');
      expect(sentParams.get('grant_type')).toBe('authorization_code');
      expect(sentParams.get('code')).toBe('test_auth_code');
    });
  });

  describe('Discord API error handling', () => {
    it('returns Discord error status and details on non-OK response', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response('{"error": "invalid_grant"}', {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      const { status, body } = await makeRequest(baseUrl, '/api/token', {
        method: 'POST',
        body: { code: 'expired_code' },
      });

      expect(status).toBe(400);
      expect(body).toEqual({
        error: 'Discord token exchange failed',
        details: '{"error": "invalid_grant"}',
      });
    });

    it('returns 500 when fetch throws a network error', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('ECONNREFUSED'));

      const { status, body } = await makeRequest(baseUrl, '/api/token', {
        method: 'POST',
        body: { code: 'some_code' },
      });

      expect(status).toBe(500);
      expect(body).toEqual({
        error: 'Token exchange request failed',
        details: 'ECONNREFUSED',
      });
    });
  });
});

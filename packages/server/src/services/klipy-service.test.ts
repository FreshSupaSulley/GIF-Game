import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { KlipyService, createKlipyService } from './klipy-service';

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function mockResponse(data: any, options?: { ok?: boolean; status?: number }) {
  return {
    ok: options?.ok ?? true,
    status: options?.status ?? 200,
    statusText: options?.ok === false ? 'Bad Request' : 'OK',
    json: async () => data,
    text: async () => JSON.stringify(data),
  };
}

// Helper to create Tenor-format GIF response objects
function createTenorGif(id: string, title: string = 'Test GIF') {
  return {
    id,
    content_description: title,
    media_formats: {
      gif: { url: `https://media.tenor.com/${id}.gif`, dims: [480, 270], size: 1000 },
      tinygif: { url: `https://media.tenor.com/${id}_tiny.gif`, dims: [220, 124], size: 500 },
      nanogif: { url: `https://media.tenor.com/${id}_nano.gif`, dims: [90, 50], size: 100 },
    },
  };
}

describe('KlipyService', () => {
  let service: KlipyService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new KlipyService({
      apiKey: 'test-api-key',
      clientKey: 'test-client',
      baseUrl: 'https://api.klipy.test',
      timeoutMs: 3000,
      retryCount: 3,
    });
  });

  describe('search', () => {
    it('returns normalized GIF results from Tenor/KLIPY format', async () => {
      mockFetch.mockResolvedValueOnce(
        mockResponse({
          results: [
            createTenorGif('g1', 'Funny Cat'),
            createTenorGif('g2', ''),
          ],
        })
      );

      const results = await service.search('cats');
      expect(results).toHaveLength(2);
      expect(results[0].id).toBe('g1');
      expect(results[0].title).toBe('Funny Cat');
      expect(results[0].url).toContain('g1.gif');
      expect(results[0].thumbnailUrl).toContain('g1_nano.gif');
      expect(results[1].title).toBe('Untitled GIF'); // normalized empty title
    });

    it('caps results at MAX_SEARCH_RESULTS (25)', async () => {
      const manyResults = Array.from({ length: 50 }, (_, i) =>
        createTenorGif(`g${i}`, `GIF ${i}`)
      );
      mockFetch.mockResolvedValueOnce(mockResponse({ results: manyResults }));

      const results = await service.search('test');
      expect(results.length).toBeLessThanOrEqual(25);
    });

    it('passes key, client_key, q, and limit as URL params', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse({ results: [] }));

      await service.search('dancing', 10);

      const calledUrl = mockFetch.mock.calls[0][0];
      expect(calledUrl).toContain('key=test-api-key');
      expect(calledUrl).toContain('client_key=test-client');
      expect(calledUrl).toContain('q=dancing');
      expect(calledUrl).toContain('limit=10');
    });

    it('uses /v2/search endpoint', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse({ results: [] }));

      await service.search('test');

      const calledUrl = mockFetch.mock.calls[0][0];
      expect(calledUrl).toContain('/v2/search');
    });

    it('does NOT use Bearer token auth (uses key param instead)', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse({ results: [] }));

      await service.search('test');

      const calledOptions = mockFetch.mock.calls[0][1];
      expect(calledOptions.headers.Authorization).toBeUndefined();
    });

    it('throws on non-OK response', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse({}, { ok: false, status: 500 }));

      await expect(service.search('test')).rejects.toThrow('KLIPY search failed');
    });

    it('throws on timeout', async () => {
      mockFetch.mockImplementationOnce((_url: string, opts: any) => {
        return new Promise((_, reject) => {
          opts.signal.addEventListener('abort', () => {
            const err = new Error('Aborted');
            err.name = 'AbortError';
            reject(err);
          });
        });
      });

      const shortService = new KlipyService({
        apiKey: 'key',
        baseUrl: 'https://api.klipy.test',
        timeoutMs: 1,
        retryCount: 1,
      });

      await expect(shortService.search('test')).rejects.toThrow('timed out');
    });
  });

  describe('random', () => {
    it('returns SelectedGif array for auto-fill from /v2/featured', async () => {
      mockFetch.mockResolvedValueOnce(
        mockResponse({
          results: [
            createTenorGif('r1', 'Random 1'),
            { ...createTenorGif('r2', ''), content_description: null },
          ],
        })
      );

      const gifs = await service.random(2);
      expect(gifs).toHaveLength(2);
      expect(gifs[0].id).toBe('r1');
      expect(gifs[0].title).toBe('Random 1');
      expect(gifs[1].title).toBe('Untitled GIF'); // null normalized
    });

    it('uses /v2/featured endpoint', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse({ results: [createTenorGif('r1')] }));

      await service.random(1);

      const calledUrl = mockFetch.mock.calls[0][0];
      expect(calledUrl).toContain('/v2/featured');
    });

    it('retries on failure', async () => {
      mockFetch
        .mockRejectedValueOnce(new Error('network error'))
        .mockRejectedValueOnce(new Error('network error'))
        .mockResolvedValueOnce(
          mockResponse({
            results: [createTenorGif('r1', 'Got it')],
          })
        );

      // Mock sleep to avoid waiting
      vi.spyOn(service as any, 'sleep').mockResolvedValue(undefined);

      const gifs = await service.random(1);
      expect(gifs).toHaveLength(1);
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('throws after all retries exhausted', async () => {
      mockFetch.mockRejectedValue(new Error('persistent failure'));

      vi.spyOn(service as any, 'sleep').mockResolvedValue(undefined);

      await expect(service.random(1)).rejects.toThrow('persistent failure');
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });
  });

  describe('media format fallbacks', () => {
    it('falls back to tinygif if gif is missing', async () => {
      mockFetch.mockResolvedValueOnce(
        mockResponse({
          results: [
            {
              id: 'g1',
              content_description: 'Test',
              media_formats: {
                tinygif: { url: 'https://example.com/tiny.gif', dims: [220, 124], size: 500 },
              },
            },
          ],
        })
      );

      const results = await service.search('test');
      expect(results[0].url).toBe('https://example.com/tiny.gif');
    });

    it('falls back to tinygif for thumbnail if nanogif is missing', async () => {
      mockFetch.mockResolvedValueOnce(
        mockResponse({
          results: [
            {
              id: 'g1',
              content_description: 'Test',
              media_formats: {
                gif: { url: 'https://example.com/full.gif', dims: [480, 270], size: 1000 },
                tinygif: { url: 'https://example.com/tiny.gif', dims: [220, 124], size: 500 },
              },
            },
          ],
        })
      );

      const results = await service.search('test');
      expect(results[0].thumbnailUrl).toBe('https://example.com/tiny.gif');
    });
  });
});


describe('KlipyService - Dev Mode', () => {
  let devService: KlipyService;

  beforeEach(() => {
    vi.clearAllMocks();
    devService = new KlipyService({
      apiKey: 'test-key',
      devMode: true,
    });
  });

  describe('search (dev mode)', () => {
    it('returns mock GIFs without calling fetch', async () => {
      const results = await devService.search('happy');
      expect(results.length).toBeGreaterThan(0);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('filters results by query when matches exist', async () => {
      const results = await devService.search('cat');
      expect(results.some((r) => r.title.toLowerCase().includes('cat'))).toBe(true);
    });

    it('returns shuffled results when no matches', async () => {
      const results = await devService.search('xyznonexistent');
      expect(results.length).toBeGreaterThan(0);
    });

    it('respects limit parameter', async () => {
      const results = await devService.search('test', 3);
      expect(results.length).toBeLessThanOrEqual(3);
    });

    it('returns GIFs with valid URLs', async () => {
      const results = await devService.search('party');
      for (const gif of results) {
        expect(gif.url).toMatch(/^https?:\/\//);
        expect(gif.thumbnailUrl).toMatch(/^https?:\/\//);
      }
    });
  });

  describe('random (dev mode)', () => {
    it('returns mock GIFs without calling fetch', async () => {
      const results = await devService.random(3);
      expect(results).toHaveLength(3);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('returns SelectedGif format', async () => {
      const results = await devService.random(1);
      expect(results[0]).toHaveProperty('id');
      expect(results[0]).toHaveProperty('url');
      expect(results[0]).toHaveProperty('thumbnailUrl');
      expect(results[0]).toHaveProperty('title');
    });

    it('returns unique IDs per call', async () => {
      const results1 = await devService.random(3);
      const results2 = await devService.random(3);
      const ids1 = results1.map((r) => r.id);
      const ids2 = results2.map((r) => r.id);
      // IDs should be different between calls (includes timestamp)
      expect(ids1).not.toEqual(ids2);
    });
  });
});

describe('createKlipyService factory', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('enables dev mode when KLIPY_API_KEY is not set', () => {
    delete process.env.KLIPY_API_KEY;
    delete process.env.KLIPY_DEV_MODE;
    const service = createKlipyService();
    // Service should work without errors (dev mode)
    expect(service).toBeDefined();
  });

  it('enables dev mode when KLIPY_DEV_MODE=true', () => {
    process.env.KLIPY_API_KEY = 'real-key';
    process.env.KLIPY_DEV_MODE = 'true';
    const service = createKlipyService();
    expect(service).toBeDefined();
  });
});
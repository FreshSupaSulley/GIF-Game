import type { SelectedGif } from '@gif-game/shared';
import type { GifResult } from '@gif-game/shared';
import {
  KLIPY_BASE_URL,
  KLIPY_TIMEOUT_MS,
  KLIPY_RETRY_COUNT,
  MAX_SEARCH_RESULTS,
} from '@gif-game/shared';

export interface KlipyServiceOptions {
  apiKey: string;
  clientKey?: string;
  baseUrl?: string;
  timeoutMs?: number;
  retryCount?: number;
  /**
   * When true, returns mock GIFs instead of calling the real API.
   * Use this during development to avoid hitting the 100 calls/hour rate limit.
   */
  devMode?: boolean;
}

/**
 * Tenor/KLIPY API GIF result structure.
 * KLIPY is Tenor-compatible, so response structure matches Tenor v2.
 */
interface TenorGifResponse {
  id: string;
  title?: string;
  content_description?: string;
  media_formats: {
    gif?: { url: string; dims: [number, number]; size: number };
    tinygif?: { url: string; dims: [number, number]; size: number };
    nanogif?: { url: string; dims: [number, number]; size: number };
    mp4?: { url: string; dims: [number, number]; size: number };
    tinymp4?: { url: string; dims: [number, number]; size: number };
  };
}

/**
 * Sample GIF URLs from giphy's public CDN for dev mode.
 * These are real GIFs that will render in the UI.
 */
const DEV_MODE_GIFS = [
  { id: 'dev-1', title: 'Excited Dance', url: 'https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif', thumb: 'https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/200w.gif' },
  { id: 'dev-2', title: 'Happy Cat', url: 'https://media.giphy.com/media/JIX9t2j0ZTN9S/giphy.gif', thumb: 'https://media.giphy.com/media/JIX9t2j0ZTN9S/200w.gif' },
  { id: 'dev-3', title: 'Mind Blown', url: 'https://media.giphy.com/media/xT0xeJpnrWC4XWblEk/giphy.gif', thumb: 'https://media.giphy.com/media/xT0xeJpnrWC4XWblEk/200w.gif' },
  { id: 'dev-4', title: 'Thumbs Up', url: 'https://media.giphy.com/media/111ebonMs90YLu/giphy.gif', thumb: 'https://media.giphy.com/media/111ebonMs90YLu/200w.gif' },
  { id: 'dev-5', title: 'Confused Math', url: 'https://media.giphy.com/media/WRQBXSCnEFJIuxktnw/giphy.gif', thumb: 'https://media.giphy.com/media/WRQBXSCnEFJIuxktnw/200w.gif' },
  { id: 'dev-6', title: 'Typing Fast', url: 'https://media.giphy.com/media/LmNwrBhejkK9EFP504/giphy.gif', thumb: 'https://media.giphy.com/media/LmNwrBhejkK9EFP504/200w.gif' },
  { id: 'dev-7', title: 'Facepalm', url: 'https://media.giphy.com/media/XsUtdIeJ0MWMo/giphy.gif', thumb: 'https://media.giphy.com/media/XsUtdIeJ0MWMo/200w.gif' },
  { id: 'dev-8', title: 'Celebrate', url: 'https://media.giphy.com/media/g9582DNuQppxC/giphy.gif', thumb: 'https://media.giphy.com/media/g9582DNuQppxC/200w.gif' },
  { id: 'dev-9', title: 'Shocked', url: 'https://media.giphy.com/media/l3q2K5jinAlChoCLS/giphy.gif', thumb: 'https://media.giphy.com/media/l3q2K5jinAlChoCLS/200w.gif' },
  { id: 'dev-10', title: 'Crying', url: 'https://media.giphy.com/media/d2lcHJTG5Tscg/giphy.gif', thumb: 'https://media.giphy.com/media/d2lcHJTG5Tscg/200w.gif' },
  { id: 'dev-11', title: 'Laughing', url: 'https://media.giphy.com/media/10JhviFuU2gWD6/giphy.gif', thumb: 'https://media.giphy.com/media/10JhviFuU2gWD6/200w.gif' },
  { id: 'dev-12', title: 'Eye Roll', url: 'https://media.giphy.com/media/Rhhr8D5mKSX7O/giphy.gif', thumb: 'https://media.giphy.com/media/Rhhr8D5mKSX7O/200w.gif' },
  { id: 'dev-13', title: 'Mic Drop', url: 'https://media.giphy.com/media/3o7qDSOvfaCO9b3MlO/giphy.gif', thumb: 'https://media.giphy.com/media/3o7qDSOvfaCO9b3MlO/200w.gif' },
  { id: 'dev-14', title: 'Slow Clap', url: 'https://media.giphy.com/media/dOJt6XZlQw8qQ/giphy.gif', thumb: 'https://media.giphy.com/media/dOJt6XZlQw8qQ/200w.gif' },
  { id: 'dev-15', title: 'Shrug', url: 'https://media.giphy.com/media/y65VoOlimZaus/giphy.gif', thumb: 'https://media.giphy.com/media/y65VoOlimZaus/200w.gif' },
  { id: 'dev-16', title: 'Popcorn', url: 'https://media.giphy.com/media/pUeXcg80cO8I8/giphy.gif', thumb: 'https://media.giphy.com/media/pUeXcg80cO8I8/200w.gif' },
  { id: 'dev-17', title: 'Running Away', url: 'https://media.giphy.com/media/3o7ZetIsjtbkgNE1I4/giphy.gif', thumb: 'https://media.giphy.com/media/3o7ZetIsjtbkgNE1I4/200w.gif' },
  { id: 'dev-18', title: 'High Five', url: 'https://media.giphy.com/media/l0MYJnJQ4EiYLxvQ4/giphy.gif', thumb: 'https://media.giphy.com/media/l0MYJnJQ4EiYLxvQ4/200w.gif' },
  { id: 'dev-19', title: 'Party Time', url: 'https://media.giphy.com/media/l0MYGb1LuZ3n7dRnO/giphy.gif', thumb: 'https://media.giphy.com/media/l0MYGb1LuZ3n7dRnO/200w.gif' },
  { id: 'dev-20', title: 'Victory', url: 'https://media.giphy.com/media/a0h7sAqON67nO/giphy.gif', thumb: 'https://media.giphy.com/media/a0h7sAqON67nO/200w.gif' },
  { id: 'dev-21', title: 'Waiting', url: 'https://media.giphy.com/media/QBd2kLB5qDmysEXre9/giphy.gif', thumb: 'https://media.giphy.com/media/QBd2kLB5qDmysEXre9/200w.gif' },
  { id: 'dev-22', title: 'Angry', url: 'https://media.giphy.com/media/l1J9u3TZfpmeDLkD6/giphy.gif', thumb: 'https://media.giphy.com/media/l1J9u3TZfpmeDLkD6/200w.gif' },
  { id: 'dev-23', title: 'Wink', url: 'https://media.giphy.com/media/ui1hpJSyBDWlG/giphy.gif', thumb: 'https://media.giphy.com/media/ui1hpJSyBDWlG/200w.gif' },
  { id: 'dev-24', title: 'Peace Out', url: 'https://media.giphy.com/media/42D3CxaINsAFemFuId/giphy.gif', thumb: 'https://media.giphy.com/media/42D3CxaINsAFemFuId/200w.gif' },
  { id: 'dev-25', title: 'Love It', url: 'https://media.giphy.com/media/26FLdmIp6wJr91JAI/giphy.gif', thumb: 'https://media.giphy.com/media/26FLdmIp6wJr91JAI/200w.gif' },
];

/**
 * Service for interacting with the KLIPY GIF API (Tenor-compatible).
 * Provides search and random GIF retrieval with timeout and retry logic.
 *
 * KLIPY uses the same API structure as Tenor v2:
 * - Base URL: api.klipy.com
 * - Endpoints: /v2/search, /v2/featured
 * - Auth: key param (not Bearer token)
 *
 * DEV MODE: Set devMode=true to use mock GIFs and avoid hitting
 * the 100 calls/hour rate limit during development.
 */
export class KlipyService {
  private apiKey: string;
  private clientKey: string;
  private baseUrl: string;
  private timeoutMs: number;
  private retryCount: number;
  private devMode: boolean;

  constructor(options: KlipyServiceOptions) {
    this.apiKey = options.apiKey;
    this.clientKey = options.clientKey ?? 'gif-guessing-game';
    this.baseUrl = options.baseUrl ?? KLIPY_BASE_URL;
    this.timeoutMs = options.timeoutMs ?? KLIPY_TIMEOUT_MS;
    this.retryCount = options.retryCount ?? KLIPY_RETRY_COUNT;
    this.devMode = options.devMode ?? false;

    if (this.devMode) {
      console.log('[KlipyService] Running in DEV MODE - using mock GIFs (no API calls)');
    }
  }

  /**
   * Searches KLIPY for GIFs matching the query.
   * In dev mode, returns mock GIFs filtered by query.
   */
  async search(query: string, limit?: number): Promise<GifResult[]> {
    if (this.devMode) {
      return this.mockSearch(query, limit);
    }

    const cappedLimit = Math.min(limit ?? MAX_SEARCH_RESULTS, MAX_SEARCH_RESULTS);

    const url = new URL('/v2/search', this.baseUrl);
    url.searchParams.set('key', this.apiKey);
    url.searchParams.set('client_key', this.clientKey);
    url.searchParams.set('q', query);
    url.searchParams.set('limit', String(cappedLimit));
    url.searchParams.set('media_filter', 'gif,tinygif,nanogif');
    url.searchParams.set('contentfilter', 'medium');

    const response = await this.fetchWithTimeout(url.toString());

    if (!response.ok) {
      throw new Error(`KLIPY search failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return this.normalizeResults(data.results ?? []);
  }

  /**
   * Fetches random/featured GIFs from KLIPY. Used for auto-fill on submission timeout.
   * In dev mode, returns random mock GIFs.
   */
  async random(count: number): Promise<SelectedGif[]> {
    if (this.devMode) {
      return this.mockRandom(count);
    }

    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.retryCount; attempt++) {
      try {
        const url = new URL('/v2/featured', this.baseUrl);
        url.searchParams.set('key', this.apiKey);
        url.searchParams.set('client_key', this.clientKey);
        url.searchParams.set('limit', String(count));
        url.searchParams.set('media_filter', 'gif,tinygif,nanogif');
        url.searchParams.set('contentfilter', 'medium');

        const response = await this.fetchWithTimeout(url.toString());

        if (!response.ok) {
          throw new Error(`KLIPY random failed: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        const results: TenorGifResponse[] = data.results ?? [];

        return results.slice(0, count).map((gif) => this.toSelectedGif(gif));
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));

        if (attempt < this.retryCount - 1) {
          await this.sleep(1000);
        }
      }
    }

    throw lastError ?? new Error('KLIPY random failed after retries');
  }

  // ---------------------------------------------------------------------------
  // Dev Mode Mock Implementations
  // ---------------------------------------------------------------------------

  private mockSearch(query: string, limit?: number): GifResult[] {
    const cappedLimit = Math.min(limit ?? MAX_SEARCH_RESULTS, MAX_SEARCH_RESULTS);
    const lowerQuery = query.toLowerCase();

    // Filter by query (simple substring match on title)
    let results = DEV_MODE_GIFS.filter((g) =>
      g.title.toLowerCase().includes(lowerQuery)
    );

    // If no matches, return random results (like a real search would for broad queries)
    if (results.length === 0) {
      results = this.shuffleArray([...DEV_MODE_GIFS]);
    }

    return results.slice(0, cappedLimit).map((g, i) => ({
      id: `${g.id}-${query}-${i}`, // Unique ID per search
      title: g.title,
      url: g.url,
      thumbnailUrl: g.thumb,
      width: 480,
      height: 270,
    }));
  }

  private mockRandom(count: number): SelectedGif[] {
    const shuffled = this.shuffleArray([...DEV_MODE_GIFS]);
    return shuffled.slice(0, count).map((g, i) => ({
      id: `${g.id}-random-${Date.now()}-${i}`,
      title: g.title,
      url: g.url,
      thumbnailUrl: g.thumb,
    }));
  }

  private shuffleArray<T>(array: T[]): T[] {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  // ---------------------------------------------------------------------------
  // Real API Helpers
  // ---------------------------------------------------------------------------

  private async fetchWithTimeout(url: string): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url, {
        headers: {
          Accept: 'application/json',
        },
        signal: controller.signal,
      });
      return response;
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error(`KLIPY request timed out after ${this.timeoutMs}ms`);
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private normalizeResults(results: TenorGifResponse[]): GifResult[] {
    return results.slice(0, MAX_SEARCH_RESULTS).map((gif) => {
      const formats = gif.media_formats;
      const gifUrl = formats.gif?.url ?? formats.tinygif?.url ?? '';
      const thumbnailUrl = formats.nanogif?.url ?? formats.tinygif?.url ?? gifUrl;
      const dims = formats.gif?.dims ?? formats.tinygif?.dims ?? [0, 0];

      return {
        id: gif.id,
        url: gifUrl,
        thumbnailUrl,
        title: this.normalizeTitle(gif.content_description ?? gif.title),
        width: dims[0],
        height: dims[1],
      };
    });
  }

  private toSelectedGif(gif: TenorGifResponse): SelectedGif {
    const formats = gif.media_formats;
    const gifUrl = formats.gif?.url ?? formats.tinygif?.url ?? '';
    const thumbnailUrl = formats.nanogif?.url ?? formats.tinygif?.url ?? gifUrl;

    return {
      id: gif.id,
      url: gifUrl,
      thumbnailUrl,
      title: this.normalizeTitle(gif.content_description ?? gif.title),
    };
  }

  private normalizeTitle(title: unknown): string {
    if (typeof title === 'string' && title.trim().length > 0) {
      return title.trim();
    }
    return 'Untitled GIF';
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Factory function to create a KlipyService with environment-based configuration.
 * Automatically enables dev mode when KLIPY_DEV_MODE=true or KLIPY_API_KEY is missing.
 */
export function createKlipyService(): KlipyService {
  const apiKey = process.env.KLIPY_API_KEY ?? '';
  const devMode = process.env.KLIPY_DEV_MODE === 'true' || !apiKey;

  if (!apiKey && !devMode) {
    console.warn('[KlipyService] KLIPY_API_KEY not set - falling back to dev mode');
  }

  return new KlipyService({
    apiKey,
    devMode,
  });
}

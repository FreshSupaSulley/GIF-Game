import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DiscordAuth, createDiscordAuth } from './discord-auth';

describe('DiscordAuth', () => {
  let discordAuth: DiscordAuth;

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    discordAuth = new DiscordAuth({
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    discordAuth.clearCache();
  });

  describe('exchangeCode', () => {
    it('should exchange code for token', async () => {
      const mockToken = {
        access_token: 'test-access-token',
        token_type: 'Bearer',
        expires_in: 604800,
        refresh_token: 'test-refresh-token',
        scope: 'identify',
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockToken),
      } as Response);

      const result = await discordAuth.exchangeCode('test-code');

      expect(result).toEqual(mockToken);
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/oauth2/token'),
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        })
      );
    });

    it('should return null on exchange failure', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        text: () => Promise.resolve('Invalid code'),
      } as Response);

      const result = await discordAuth.exchangeCode('invalid-code');

      expect(result).toBeNull();
    });

    it('should return null on network error', async () => {
      vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'));

      const result = await discordAuth.exchangeCode('test-code');

      expect(result).toBeNull();
    });
  });

  describe('validateToken', () => {
    it('should validate token and return user', async () => {
      const mockUser = {
        id: '123456789',
        username: 'TestUser',
        avatar: 'abc123',
        discriminator: '0',
        global_name: 'Test User',
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockUser),
      } as Response);

      const result = await discordAuth.validateToken('test-token');

      expect(result).toBeDefined();
      expect(result?.id).toBe('123456789');
      expect(result?.username).toBe('TestUser');
      // Avatar should be converted to full URL
      expect(result?.avatar).toBe('https://cdn.discordapp.com/avatars/123456789/abc123.png');
    });

    it('should return cached user on subsequent calls', async () => {
      const mockUser = {
        id: '123456789',
        username: 'TestUser',
        avatar: 'abc123',
        discriminator: '0',
        global_name: 'Test User',
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockUser),
      } as Response);

      // First call
      await discordAuth.validateToken('test-token');
      
      // Second call should use cache
      await discordAuth.validateToken('test-token');

      // Fetch should only be called once
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('should return null on 401 response', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 401,
      } as Response);

      const result = await discordAuth.validateToken('invalid-token');

      expect(result).toBeNull();
    });

    it('should return null on network error', async () => {
      vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'));

      const result = await discordAuth.validateToken('test-token');

      expect(result).toBeNull();
    });

    it('should use default avatar when none provided', async () => {
      const mockUser = {
        id: '123456789',
        username: 'TestUser',
        avatar: null,
        discriminator: '0',
        global_name: 'Test User',
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockUser),
      } as Response);

      const result = await discordAuth.validateToken('test-token');

      expect(result?.avatar).toMatch(/https:\/\/cdn\.discordapp\.com\/embed\/avatars\/\d\.png/);
    });
  });

  describe('cleanupCache', () => {
    it('should remove expired entries', async () => {
      vi.useFakeTimers();

      const mockUser = {
        id: '123456789',
        username: 'TestUser',
        avatar: 'abc123',
        discriminator: '0',
        global_name: 'Test User',
      };

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockUser),
      } as Response);

      // Validate token to cache it
      await discordAuth.validateToken('test-token');
      expect(fetch).toHaveBeenCalledTimes(1);

      // Advance past cache expiry (5 minutes)
      vi.advanceTimersByTime(6 * 60 * 1000);

      // Cleanup should remove expired entry
      discordAuth.cleanupCache();

      // Next validation should hit the API again
      await discordAuth.validateToken('test-token');
      expect(fetch).toHaveBeenCalledTimes(2);

      vi.useRealTimers();
    });
  });

  describe('createDiscordAuth', () => {
    it('should create instance from config', () => {
      const auth = createDiscordAuth({
        discordClientId: 'my-client-id',
        discordClientSecret: 'my-client-secret',
      });

      expect(auth).toBeInstanceOf(DiscordAuth);
    });
  });
});

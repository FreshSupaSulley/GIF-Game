import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadConfig } from './config';

describe('loadConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('happy path', () => {
    it('returns parsed config when all required vars are set', () => {
      process.env.DISCORD_CLIENT_ID = '123456789';
      process.env.DISCORD_CLIENT_SECRET = 'secret_abc';
      process.env.PORT = '4000';

      const config = loadConfig();

      expect(config).toEqual({
        discordClientId: '123456789',
        discordClientSecret: 'secret_abc',
        port: 4000,
      });
    });

    it('defaults PORT to 3001 when not set', () => {
      process.env.DISCORD_CLIENT_ID = '123456789';
      process.env.DISCORD_CLIENT_SECRET = 'secret_abc';
      delete process.env.PORT;

      const config = loadConfig();

      expect(config).toEqual({
        discordClientId: '123456789',
        discordClientSecret: 'secret_abc',
        port: 3001,
      });
    });
  });

  describe('missing required variables', () => {
    it('throws when DISCORD_CLIENT_ID is missing', () => {
      process.env.DISCORD_CLIENT_SECRET = 'secret_abc';
      delete process.env.DISCORD_CLIENT_ID;

      expect(() => loadConfig()).toThrow('Missing required environment variables: DISCORD_CLIENT_ID');
    });

    it('throws when DISCORD_CLIENT_SECRET is missing', () => {
      process.env.DISCORD_CLIENT_ID = '123456789';
      delete process.env.DISCORD_CLIENT_SECRET;

      expect(() => loadConfig()).toThrow('Missing required environment variables: DISCORD_CLIENT_SECRET');
    });

    it('throws with all missing vars listed when both are absent', () => {
      delete process.env.DISCORD_CLIENT_ID;
      delete process.env.DISCORD_CLIENT_SECRET;

      expect(() => loadConfig()).toThrow(
        'Missing required environment variables: DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET'
      );
    });
  });

  describe('PORT validation', () => {
    it('throws when PORT is not a valid number', () => {
      process.env.DISCORD_CLIENT_ID = '123456789';
      process.env.DISCORD_CLIENT_SECRET = 'secret_abc';
      process.env.PORT = 'not_a_number';

      expect(() => loadConfig()).toThrow('PORT must be a valid number between 1 and 65535');
    });

    it('throws when PORT is 0', () => {
      process.env.DISCORD_CLIENT_ID = '123456789';
      process.env.DISCORD_CLIENT_SECRET = 'secret_abc';
      process.env.PORT = '0';

      expect(() => loadConfig()).toThrow('PORT must be a valid number between 1 and 65535');
    });

    it('throws when PORT exceeds 65535', () => {
      process.env.DISCORD_CLIENT_ID = '123456789';
      process.env.DISCORD_CLIENT_SECRET = 'secret_abc';
      process.env.PORT = '70000';

      expect(() => loadConfig()).toThrow('PORT must be a valid number between 1 and 65535');
    });
  });
});

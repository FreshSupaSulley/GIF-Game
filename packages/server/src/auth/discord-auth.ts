import { DISCORD_API_BASE_URL } from '@gif-game/shared';

export interface DiscordUser {
  id: string;
  username: string;
  avatar: string;
  discriminator: string;
  global_name: string | null;
}

export interface TokenExchangeResult {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  scope: string;
}

export interface DiscordAuthOptions {
  clientId: string;
  clientSecret: string;
}

/**
 * Discord OAuth2 authentication service.
 * Handles token exchange and user info retrieval.
 */
export class DiscordAuth {
  private clientId: string;
  private clientSecret: string;
  private tokenCache: Map<string, { user: DiscordUser; expiresAt: number }> = new Map();

  constructor(options: DiscordAuthOptions) {
    this.clientId = options.clientId;
    this.clientSecret = options.clientSecret;
  }

  /**
   * Exchange an OAuth2 code for an access token.
   * Used during the initial OAuth flow from the client.
   */
  async exchangeCode(code: string): Promise<TokenExchangeResult | null> {
    try {
      const response = await fetch(`${DISCORD_API_BASE_URL}/oauth2/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: this.clientId,
          client_secret: this.clientSecret,
          grant_type: 'authorization_code',
          code,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        console.error('[DiscordAuth] Token exchange failed:', error);
        return null;
      }

      return await response.json() as TokenExchangeResult;
    } catch (err) {
      console.error('[DiscordAuth] Token exchange error:', err);
      return null;
    }
  }

  /**
   * Validate an access token and return the associated user.
   * Caches user info to reduce API calls.
   */
  async validateToken(accessToken: string): Promise<DiscordUser | null> {
    // Check cache first
    const cached = this.tokenCache.get(accessToken);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.user;
    }

    try {
      const response = await fetch(`${DISCORD_API_BASE_URL}/users/@me`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          // Token is invalid or expired
          this.tokenCache.delete(accessToken);
          return null;
        }
        console.error('[DiscordAuth] User fetch failed:', response.status);
        return null;
      }

      const user = await response.json() as DiscordUser;

      // Ensure avatar is a full URL or CDN path
      if (user.avatar && !user.avatar.startsWith('http')) {
        user.avatar = `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`;
      } else if (!user.avatar) {
        // Default avatar based on discriminator or user ID
        const defaultIndex = user.discriminator === '0' 
          ? (BigInt(user.id) >> 22n) % 6n 
          : parseInt(user.discriminator) % 5;
        user.avatar = `https://cdn.discordapp.com/embed/avatars/${defaultIndex}.png`;
      }

      // Cache for 5 minutes
      this.tokenCache.set(accessToken, {
        user,
        expiresAt: Date.now() + 5 * 60 * 1000,
      });

      return user;
    } catch (err) {
      console.error('[DiscordAuth] User fetch error:', err);
      return null;
    }
  }

  /**
   * Clear expired entries from the cache.
   */
  cleanupCache(): void {
    const now = Date.now();
    for (const [token, entry] of this.tokenCache) {
      if (entry.expiresAt < now) {
        this.tokenCache.delete(token);
      }
    }
  }

  /**
   * Clear all cached tokens (for shutdown).
   */
  clearCache(): void {
    this.tokenCache.clear();
  }
}

/**
 * Create a DiscordAuth instance from environment config.
 */
export function createDiscordAuth(config: { discordClientId: string; discordClientSecret: string }): DiscordAuth {
  return new DiscordAuth({
    clientId: config.discordClientId,
    clientSecret: config.discordClientSecret,
  });
}

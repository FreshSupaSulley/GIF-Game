import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { DiscordSDK } from '@discord/embedded-app-sdk';

const DISCORD_CLIENT_ID = import.meta.env.VITE_DISCORD_CLIENT_ID;

// Singleton Discord SDK instance - avoid re-initialization on React re-renders
const discordSdk = new DiscordSDK(DISCORD_CLIENT_ID);

export interface DiscordUser {
  id: string;
  username: string;
  avatar: string;
  discriminator: string;
  globalName: string | null;
}

export interface DiscordContextValue {
  /** Current auth status */
  status: 'loading' | 'authenticated' | 'error';
  /** Authenticated user info, null if not authenticated */
  user: DiscordUser | null;
  /** Discord instance ID (unique per Activity session) */
  instanceId: string | null;
  /** Access token for API calls, null if not authenticated */
  accessToken: string | null;
  /** Error message if status is 'error' */
  error: string | null;
  /** The Discord SDK instance */
  sdk: DiscordSDK;
}

const DiscordContext = createContext<DiscordContextValue | null>(null);

// Shared promise to prevent double auth on StrictMode
let authPromise: Promise<{ accessToken: string; user: DiscordUser }> | null = null;

async function performAuth(): Promise<{ accessToken: string; user: DiscordUser }> {
  if (authPromise) return authPromise;

  authPromise = (async () => {
    console.log('[DiscordSDK] Waiting for ready...');
    await discordSdk.ready();
    console.log('[DiscordSDK] SDK ready');

    console.log('[DiscordSDK] Calling authorize...');
    const { code } = await discordSdk.commands.authorize({
      client_id: DISCORD_CLIENT_ID,
      response_type: 'code',
      state: '',
      prompt: 'none',
      scope: ['identify'],
    });
    console.log('[DiscordSDK] Got auth code');

    console.log('[DiscordSDK] Exchanging code for token...');
    const tokenResponse = await fetch('/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });

    if (!tokenResponse.ok) {
      const body = await tokenResponse.text();
      throw new Error(`Token exchange failed: ${tokenResponse.status} - ${body}`);
    }

    const { access_token } = await tokenResponse.json();

    console.log('[DiscordSDK] Authenticating with access token...');
    await discordSdk.commands.authenticate({ access_token });
    console.log('[DiscordSDK] Authenticated');

    console.log('[DiscordSDK] Fetching user info...');
    const userResponse = await fetch('https://discord.com/api/v10/users/@me', {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    if (!userResponse.ok) {
      const body = await userResponse.text();
      throw new Error(`Failed to fetch user: ${userResponse.status} - ${body}`);
    }

    const userData = await userResponse.json();
    console.log('[DiscordSDK] Got user:', userData.username);

    // Build avatar URL
    let avatarUrl: string;
    if (userData.avatar) {
      avatarUrl = `https://cdn.discordapp.com/avatars/${userData.id}/${userData.avatar}.png`;
    } else {
      const defaultIndex = userData.discriminator === '0'
        ? (BigInt(userData.id) >> 22n) % 6n
        : parseInt(userData.discriminator) % 5;
      avatarUrl = `https://cdn.discordapp.com/embed/avatars/${defaultIndex}.png`;
    }

    const user: DiscordUser = {
      id: userData.id,
      username: userData.username,
      avatar: avatarUrl,
      discriminator: userData.discriminator,
      globalName: userData.global_name ?? null,
    };

    return { accessToken: access_token, user };
  })();

  return authPromise;
}

interface DiscordSDKProviderProps {
  children: ReactNode;
}

export function DiscordSDKProvider({ children }: DiscordSDKProviderProps) {
  const [state, setState] = useState<Omit<DiscordContextValue, 'sdk'>>({
    status: 'loading',
    user: null,
    instanceId: null,
    accessToken: null,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      try {
        const { accessToken, user } = await performAuth();

        if (cancelled) return;

        // Get the instance ID from the SDK
        const instanceId = discordSdk.instanceId;

        setState({
          status: 'authenticated',
          user,
          instanceId,
          accessToken,
          error: null,
        });
      } catch (err) {
        console.error('[DiscordSDK] Auth error:', err);
        if (cancelled) return;

        const message = err instanceof Error
          ? err.message
          : typeof err === 'object' && err !== null
            ? JSON.stringify(err)
            : String(err);

        setState({
          status: 'error',
          user: null,
          instanceId: null,
          accessToken: null,
          error: message,
        });
      }
    };

    init();

    return () => {
      cancelled = true;
    };
  }, []);

  const contextValue: DiscordContextValue = {
    ...state,
    sdk: discordSdk,
  };

  return (
    <DiscordContext.Provider value={contextValue}>
      {children}
    </DiscordContext.Provider>
  );
}

/**
 * Hook to access Discord SDK context.
 * Throws if used outside of DiscordSDKProvider.
 */
export function useDiscord(): DiscordContextValue {
  const context = useContext(DiscordContext);
  if (!context) {
    throw new Error('useDiscord must be used within a DiscordSDKProvider');
  }
  return context;
}

/**
 * Hook to get the authenticated user.
 * Returns null during loading or if auth failed.
 */
export function useDiscordUser(): DiscordUser | null {
  const { user } = useDiscord();
  return user;
}

/**
 * Hook to get the Discord instance ID.
 * Returns null during loading or if auth failed.
 */
export function useInstanceId(): string | null {
  const { instanceId } = useDiscord();
  return instanceId;
}

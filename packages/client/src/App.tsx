import { useEffect, useState } from 'react';
import { DiscordSDK } from '@discord/embedded-app-sdk';

const DISCORD_CLIENT_ID = import.meta.env.VITE_DISCORD_CLIENT_ID;

// Instantiate once at module level — avoids React StrictMode double-init
const discordSdk = new DiscordSDK(DISCORD_CLIENT_ID);
let authPromise: Promise<string> | null = null;

function getAccessToken(): Promise<string> {
  if (authPromise) return authPromise;
  authPromise = (async () => {
    console.log('[Discord] Waiting for ready...');
    await discordSdk.ready();
    console.log('[Discord] SDK ready');

    console.log('[Discord] Calling authorize...');
    const { code } = await discordSdk.commands.authorize({
      client_id: DISCORD_CLIENT_ID,
      response_type: 'code',
      state: '',
      prompt: 'none',
      scope: ['identify'],
    });
    console.log('[Discord] Got auth code:', code ? `yes (length=${code.length})` : 'MISSING');

    console.log('[Discord] Exchanging code for token via /api/token...');
    const tokenResponse = await fetch('/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });
    console.log('[Discord] /api/token response status:', tokenResponse.status);

    if (!tokenResponse.ok) {
      const body = await tokenResponse.text();
      console.error('[Discord] Token exchange failed, body:', body);
      throw new Error(`Token exchange failed: ${tokenResponse.status} - ${body}`);
    }

    const tokenData = await tokenResponse.json();
    console.log('[Discord] Token data keys:', Object.keys(tokenData));
    const { access_token } = tokenData;

    console.log('[Discord] Calling authenticate with access token...');
    await discordSdk.commands.authenticate({ access_token });
    console.log('[Discord] Authenticated');

    return access_token;
  })();
  return authPromise;
}

interface AuthState {
  status: 'loading' | 'authenticated' | 'error';
  username: string | null;
  error: string | null;
}

export default function App() {
  const [auth, setAuth] = useState<AuthState>({
    status: 'loading',
    username: null,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    const initDiscordSdk = async () => {
      try {
        console.log('[Discord] Initializing SDK with client ID:', DISCORD_CLIENT_ID);

        const access_token = await getAccessToken();

        console.log('[Discord] Fetching user info...');
        const userResponse = await fetch('https://discord.com/api/v10/users/@me', {
          headers: { Authorization: `Bearer ${access_token}` },
        });
        console.log('[Discord] User fetch status:', userResponse.status);

        if (!userResponse.ok) {
          const body = await userResponse.text();
          console.error('[Discord] User fetch failed, body:', body);
          throw new Error(`Failed to fetch user info: ${userResponse.status} - ${body}`);
        }

        const user = await userResponse.json();
        console.log('[Discord] Got user:', user.username);

        if (!cancelled) {
          setAuth({
            status: 'authenticated',
            username: user.username,
            error: null,
          });
        }
      } catch (err) {
        console.error('[Discord] Auth flow error:', err);
        const message =
          err instanceof Error
            ? err.message
            : typeof err === 'object' && err !== null
              ? JSON.stringify(err)
              : String(err);
        if (!cancelled) {
          setAuth({
            status: 'error',
            username: null,
            error: message,
          });
        }
      }
    };

    initDiscordSdk();

    return () => {
      cancelled = true;
    };
  }, []);

  if (auth.status === 'loading') {
    return (
      <div style={styles.container}>
        <p style={styles.loadingText}>Connecting to Discord...</p>
      </div>
    );
  }

  if (auth.status === 'error') {
    return (
      <div style={styles.container}>
        <h1 style={styles.heading}>Something went wrong</h1>
        <p style={styles.errorText}>{auth.error}</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <h1 style={styles.heading}>Hello World</h1>
      <p style={styles.username}>Welcome, {auth.username}!</p>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '1rem',
    padding: '2rem',
    textAlign: 'center',
  },
  heading: {
    fontSize: '2.5rem',
    fontWeight: 700,
    color: '#ffffff',
  },
  username: {
    fontSize: '1.25rem',
    color: '#a0a0d0',
  },
  loadingText: {
    fontSize: '1.25rem',
    color: '#a0a0d0',
  },
  errorText: {
    fontSize: '1rem',
    color: '#ff6b6b',
  },
};

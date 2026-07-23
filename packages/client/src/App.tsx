import { useEffect, useState } from 'react';
import { DiscordSDK } from '@discord/embedded-app-sdk';

const DISCORD_CLIENT_ID = import.meta.env.VITE_DISCORD_CLIENT_ID;

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
        const discordSdk = new DiscordSDK(DISCORD_CLIENT_ID);

        await discordSdk.ready();

        const { code } = await discordSdk.commands.authorize({
          client_id: DISCORD_CLIENT_ID,
          response_type: 'code',
          state: '',
          prompt: 'none',
          scope: ['identify'],
        });

        const tokenResponse = await fetch('/api/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code }),
        });

        if (!tokenResponse.ok) {
          throw new Error(`Token exchange failed: ${tokenResponse.status}`);
        }

        const { access_token } = await tokenResponse.json();

        await discordSdk.commands.authenticate({ access_token });

        const userResponse = await fetch('https://discord.com/api/v10/users/@me', {
          headers: { Authorization: `Bearer ${access_token}` },
        });

        if (!userResponse.ok) {
          throw new Error(`Failed to fetch user info: ${userResponse.status}`);
        }

        const user = await userResponse.json();

        if (!cancelled) {
          setAuth({
            status: 'authenticated',
            username: user.username,
            error: null,
          });
        }
      } catch (err) {
        if (!cancelled) {
          setAuth({
            status: 'error',
            username: null,
            error: err instanceof Error ? err.message : 'Unknown error occurred',
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

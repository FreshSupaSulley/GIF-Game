import {
  DiscordSDKProvider,
  useDiscord,
  WebSocketProvider,
  GameStateProvider,
} from './providers';
import { GameRouter, LoadingSpinner } from './components';
import { ParticlesProvider } from '@tsparticles/react';
import { loadSlim } from '@tsparticles/slim';

/**
 * Initialize the tsParticles engine with slim preset.
 * This is called once by ParticlesProvider.
 */
const particlesInit = async (engine: Parameters<typeof loadSlim>[0]) => {
  await loadSlim(engine);
};

/**
 * Loading screen component.
 */
function LoadingScreen({ message }: { message: string }) {
  console.log('[App] LoadingScreen:', message);
  return (
    <div style={styles.loadingContainer}>
      <LoadingSpinner size={48} />
      <p style={styles.loadingText}>{message}</p>
    </div>
  );
}

/**
 * Error screen component.
 */
function ErrorScreen({ error }: { error: string }) {
  return (
    <div style={styles.errorContainer}>
      <h1 style={styles.errorTitle}>Something went wrong</h1>
      <p style={styles.errorText}>{error}</p>
    </div>
  );
}

/**
 * Main game content.
 * Backgrounds are now controlled by GameRouter based on displayedPhase
 * so they respect stinger transitions.
 */
function GameContent() {
  return (
    <>
      <GameRouter />
    </>
  );
}

/**
 * Connected app that sets up WebSocket after Discord auth.
 * Particles don't show during loading/error states.
 */
function ConnectedApp() {
  const { status, user, instanceId, accessToken, error } = useDiscord();

  if (status === 'loading') {
    return (
      <LoadingScreen message="Connecting..." />
    );
  }

  if (status === 'error' || !user || !instanceId || !accessToken) {
    return (
      <ErrorScreen error={error ?? 'Authentication failed'} />
    );
  }

  return (
    <WebSocketProvider accessToken={accessToken} instanceId={instanceId}>
      <GameStateProvider playerId={user.id}>
        <GameContent />
      </GameStateProvider>
    </WebSocketProvider>
  );
}

/**
 * Root App component with Discord provider and particles.
 */
export default function App() {
  return (
    <ParticlesProvider init={particlesInit}>
      <DiscordSDKProvider>
        <ConnectedApp />
      </DiscordSDKProvider>
    </ParticlesProvider>
  );
}

const styles: Record<string, React.CSSProperties> = {
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    gap: '16px',
  },
  loadingText: {
    fontSize: '1.125rem',
    color: '#a0a0d0',
  },
  errorContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    gap: '16px',
    padding: '24px',
    textAlign: 'center',
  },
  errorTitle: {
    fontSize: '2rem',
    fontWeight: 700,
    color: '#fff',
    margin: 0,
  },
  errorText: {
    fontSize: '1rem',
    color: '#ED4245',
  },
};

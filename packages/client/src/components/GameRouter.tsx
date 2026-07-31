import { usePhase, useWebSocket } from '../hooks';
import { LobbyView, SubmissionView, GuessingView, ScoreboardView } from '../views';
import { LoadingSpinner } from './ui';

/**
 * Routes to the appropriate view based on the current game phase.
 */
export function GameRouter() {
  const phase = usePhase();
  const { status: wsStatus, error: wsError } = useWebSocket();

  // Show connection status while connecting
  if (wsStatus === 'connecting') {
    return (
      <div style={styles.loading}>
        <LoadingSpinner size={48} />
        <p style={styles.loadingText}>Connecting to server...</p>
      </div>
    );
  }

  if (wsStatus === 'reconnecting') {
    return (
      <div style={styles.loading}>
        <LoadingSpinner size={48} />
        <p style={styles.loadingText}>Reconnecting...</p>
      </div>
    );
  }

  if (wsStatus === 'disconnected') {
    return (
      <div style={styles.error}>
        <p>Disconnected from server</p>
        {wsError && <p style={styles.errorDetail}>{wsError}</p>}
      </div>
    );
  }

  // WebSocket connected but no game state yet
  if (!phase) {
    return (
      <div style={styles.loading}>
        <LoadingSpinner size={48} />
        <p style={styles.loadingText}>Loading game state...</p>
        <p style={styles.hint}>WebSocket: {wsStatus}</p>
      </div>
    );
  }

  switch (phase) {
    case 'lobby':
      return <LobbyView />;
    case 'submission':
      return <SubmissionView />;
    case 'guessing':
      return <GuessingView />;
    case 'endgame':
      return <ScoreboardView />;
    default:
      return (
        <div style={styles.error}>
          <p>Unknown game phase: {phase}</p>
        </div>
      );
  }
}

const styles: Record<string, React.CSSProperties> = {
  loading: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    gap: '16px',
  },
  loadingText: {
    color: '#a0a0d0',
    fontSize: '1.125rem',
  },
  hint: {
    color: '#666',
    fontSize: '0.875rem',
  },
  error: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    color: '#ED4245',
    gap: '8px',
  },
  errorDetail: {
    color: '#a0a0a0',
    fontSize: '0.875rem',
  },
};

import { useCallback } from 'react';
import { useGameState, useSend, useWebSocket } from '../hooks';
import { Button, Card, PlayerBadge, Slider } from '../components/ui';
import { MIN_PLAYERS, MIN_ROUNDS, MAX_ROUNDS, MIN_GUESS_TIME, MAX_GUESS_TIME } from '@gif-game/shared';

export function LobbyView() {
  const { config, players, hostId, isHost, connectedPlayerCount } = useGameState();
  const send = useSend();
  const { status: wsStatus } = useWebSocket();

  // In dev mode, server may add CPU players - allow starting with any count
  // Server will reject if not enough players and CPU mode is off
  const canStart = connectedPlayerCount >= 1;

  console.log('[LobbyView] isHost:', isHost, 'hostId:', hostId, 'wsStatus:', wsStatus, 'config:', config);

  const handleConfigUpdate = useCallback((key: string, value: number | boolean) => {
    console.log('[LobbyView] Sending config update:', key, value);
    send({ type: 'config:update', key, value });
  }, [send]);

  const handleStartGame = useCallback(() => {
    send({ type: 'game:start' });
  }, [send]);

  const sortedPlayers = Object.values(players).sort((a, b) => a.joinOrder - b.joinOrder);

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>GIF Guessing Game</h1>
      <p style={styles.subtitle}>
        {connectedPlayerCount < MIN_PLAYERS
          ? `Waiting for players... (${connectedPlayerCount}/${MIN_PLAYERS} minimum)`
          : `${connectedPlayerCount} player${connectedPlayerCount > 1 ? 's' : ''} ready!`}
      </p>

      <div style={styles.content}>
        {/* Players Panel */}
        <Card style={styles.playersCard}>
          <h2 style={styles.sectionTitle}>Players</h2>
          <div style={styles.playerList}>
            {sortedPlayers.map((player) => (
              <PlayerBadge
                key={player.id}
                avatar={player.avatar}
                username={player.username}
                isHost={player.id === hostId}
                isConnected={player.connected}
              />
            ))}
          </div>
        </Card>

        {/* Config Panel */}
        <Card style={styles.configCard}>
          <h2 style={styles.sectionTitle}>
            {isHost ? 'Game Settings' : 'Game Settings (Host Only)'}
          </h2>

          {config && (
            <div style={styles.configContent}>
              <Slider
                label="Rounds"
                value={config.roundCount}
                min={MIN_ROUNDS}
                max={MAX_ROUNDS}
                onChange={(v) => handleConfigUpdate('roundCount', v)}
                disabled={!isHost}
              />

              <Slider
                label="Guess Time"
                value={config.guessTimeLimit}
                min={MIN_GUESS_TIME}
                max={MAX_GUESS_TIME}
                onChange={(v) => handleConfigUpdate('guessTimeLimit', v)}
                disabled={!isHost}
                unit="s"
              />

              {/* Query Guess Toggle */}
              <div style={styles.toggleRow}>
                <div style={styles.toggleLabel}>
                  <span style={styles.infoLabel}>Guess the Search Query</span>
                  <span style={styles.toggleHint}>Players must guess what was searched</span>
                </div>
                <button
                  onClick={() => handleConfigUpdate('queryGuessEnabled', !config.queryGuessEnabled)}
                  disabled={!isHost}
                  style={{
                    ...styles.toggleButton,
                    backgroundColor: config.queryGuessEnabled ? '#5865F2' : 'rgba(255, 255, 255, 0.1)',
                    cursor: isHost ? 'pointer' : 'not-allowed',
                  }}
                >
                  {config.queryGuessEnabled ? 'ON' : 'OFF'}
                </button>
              </div>

              <div style={styles.infoRow}>
                <span style={styles.infoLabel}>Submission Time</span>
                <span style={styles.infoValue}>{config.submissionTimeLimit}s</span>
              </div>

              <div style={styles.infoRow}>
                <span style={styles.infoLabel}>GIFs per Player</span>
                <span style={styles.infoValue}>{config.roundCount}</span>
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Start Button */}
      <div style={styles.footer}>
        {isHost ? (
          <Button
            variant="primary"
            size="large"
            onClick={handleStartGame}
            disabled={!canStart}
          >
            {connectedPlayerCount >= MIN_PLAYERS 
              ? 'Start Game' 
              : `Start Game (+ CPU players)`}
          </Button>
        ) : (
          <p style={styles.waitingText}>Waiting for host to start the game...</p>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
    minHeight: '100vh',
    boxSizing: 'border-box',
  },
  title: {
    fontSize: '2.5rem',
    fontWeight: 700,
    color: '#fff',
    margin: 0,
    marginBottom: '8px',
  },
  subtitle: {
    fontSize: '1.125rem',
    color: '#a0a0d0',
    margin: 0,
    marginBottom: '24px',
  },
  content: {
    display: 'flex',
    gap: '24px',
    width: '100%',
    maxWidth: '800px',
  },
  playersCard: {
    flex: '1 1 0',
    minWidth: 0,
  },
  configCard: {
    flex: '1 1 0',
    minWidth: 0,
  },
  sectionTitle: {
    fontSize: '1.25rem',
    fontWeight: 600,
    color: '#fff',
    margin: 0,
    marginBottom: '16px',
  },
  playerList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  configContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  infoRow: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '8px 0',
    borderTop: '1px solid rgba(255, 255, 255, 0.1)',
  },
  infoLabel: {
    color: '#a0a0a0',
    fontSize: '14px',
  },
  infoValue: {
    color: '#fff',
    fontWeight: 600,
  },
  toggleRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 0',
    borderTop: '1px solid rgba(255, 255, 255, 0.1)',
  },
  toggleLabel: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  toggleHint: {
    color: '#666',
    fontSize: '12px',
  },
  toggleButton: {
    padding: '8px 16px',
    borderRadius: '4px',
    border: 'none',
    color: '#fff',
    fontWeight: 600,
    fontSize: '14px',
    transition: 'background-color 0.2s',
  },
  footer: {
    marginTop: '32px',
    textAlign: 'center',
  },
  waitingText: {
    color: '#a0a0d0',
    fontSize: '1rem',
  },
};

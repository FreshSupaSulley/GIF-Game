import { useState, useCallback } from 'react';
import { motion } from 'motion/react';
import { useGameState, useSend, useWebSocket } from '../hooks';
import { Button, Card, PlayerBadge, Slider, ConfirmDialog } from '../components/ui';
import { MIN_PLAYERS, MIN_ROUNDS, MAX_ROUNDS, MIN_GUESS_TIME, MAX_GUESS_TIME, MIN_SUBMISSION_TIME, MAX_SUBMISSION_TIME } from '@gif-game/shared';

export function LobbyView() {
  const { config, players, hostId, isHost, connectedPlayerCount } = useGameState();
  const send = useSend();
  const { status: wsStatus } = useWebSocket();
  
  // State for promote confirmation dialog
  const [promoteTarget, setPromoteTarget] = useState<{ id: string; username: string } | null>(null);
  // State to disable start button after clicking
  const [isStarting, setIsStarting] = useState(false);

  // In dev mode, server may add CPU players - allow starting with any count
  // Server will reject if not enough players and CPU mode is off
  const canStart = connectedPlayerCount >= 1 && !isStarting;

  console.log('[LobbyView] isHost:', isHost, 'hostId:', hostId, 'wsStatus:', wsStatus, 'config:', config);

  const handleConfigUpdate = useCallback((key: string, value: number | boolean) => {
    console.log('[LobbyView] Sending config update:', key, value);
    send({ type: 'config:update', key, value });
  }, [send]);

  const handleStartGame = useCallback(() => {
    setIsStarting(true);
    send({ type: 'game:start' });
  }, [send]);
  
  const handlePromoteClick = useCallback((playerId: string, username: string) => {
    setPromoteTarget({ id: playerId, username });
  }, []);
  
  const handlePromoteConfirm = useCallback(() => {
    if (promoteTarget) {
      send({ type: 'host:transfer', playerId: promoteTarget.id });
      setPromoteTarget(null);
    }
  }, [send, promoteTarget]);
  
  const handlePromoteCancel = useCallback(() => {
    setPromoteTarget(null);
  }, []);

  const sortedPlayers = Object.values(players).sort((a, b) => a.joinOrder - b.joinOrder);

  return (
    <div style={styles.container}>
      {/* Title with bounce animation */}
      <motion.h1
        style={styles.title}
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      >
        gif game
      </motion.h1>

      <div style={styles.content}>
        {/* Players Panel - tilted right */}
        <motion.div
          style={styles.tiltedCardWrapper}
          initial={{ opacity: 0, rotateY: 25, x: -50 }}
          animate={{ opacity: 1, rotateY: 12, x: 0 }}
          transition={{ type: 'spring', stiffness: 200, damping: 20, delay: 0.2 }}
        >
          <Card style={styles.playersCard}>
            <h2 style={styles.sectionTitle}>
              Players <span style={styles.playerCount}>({connectedPlayerCount})</span>
            </h2>
            <div style={styles.playerList}>
              {sortedPlayers.map((player, index) => (
                <PlayerBadge
                  key={player.id}
                  avatar={player.avatar}
                  username={player.username}
                  isHost={player.id === hostId}
                  isConnected={player.connected}
                  isCpu={player.id.startsWith('cpu-')}
                  animate
                  delay={0.3 + index * 0.08}
                  onPromote={isHost && player.id !== hostId && !player.id.startsWith('cpu-') 
                    ? () => handlePromoteClick(player.id, player.username) 
                    : undefined}
                />
              ))}
            </div>
          </Card>
        </motion.div>

        {/* Config Panel - tilted left */}
        <motion.div
          style={styles.tiltedCardWrapper}
          initial={{ opacity: 0, rotateY: -25, x: 50 }}
          animate={{ opacity: 1, rotateY: -12, x: 0 }}
          transition={{ type: 'spring', stiffness: 200, damping: 20, delay: 0.25 }}
        >
          <Card style={styles.configCard}>
            <h2 style={styles.sectionTitle}>
              {isHost ? 'Settings' : 'Settings (Host Only)'}
            </h2>

            {config && (
              <motion.div
                style={styles.configContent}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
            >
              <Slider
                label="Rounds"
                value={config.roundCount}
                min={MIN_ROUNDS}
                max={MAX_ROUNDS}
                onChange={(v) => handleConfigUpdate('roundCount', v)}
                disabled={!isHost}
              />

              <Slider
                label="Submission Time"
                value={config.submissionTimeLimit}
                min={MIN_SUBMISSION_TIME}
                max={MAX_SUBMISSION_TIME}
                onChange={(v) => handleConfigUpdate('submissionTimeLimit', v)}
                disabled={!isHost}
                unit="s"
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
            </motion.div>
          )}
          </Card>
        </motion.div>
      </div>

      {/* Start Button with entrance animation */}
      <motion.div
        style={styles.footer}
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.5 }}
      >
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
      </motion.div>
      
      {/* Promote confirmation dialog */}
      <ConfirmDialog
        isOpen={promoteTarget !== null}
        title="Transfer Host"
        message={`Are you sure you want to make ${promoteTarget?.username} the new host? You will lose host privileges.`}
        confirmText="Transfer"
        cancelText="Cancel"
        onConfirm={handlePromoteConfirm}
        onCancel={handlePromoteCancel}
      />
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
    fontSize: '4rem',
    fontWeight: 700,
    color: '#fff',
    margin: 0,
    marginBottom: '32px',
  },
  content: {
    display: 'flex',
    gap: '32px',
    width: '100%',
    maxWidth: '1000px',
    perspective: '1000px',
    perspectiveOrigin: 'center center',
  },
  tiltedCardWrapper: {
    flex: '1 1 0',
    minWidth: 0,
    transformStyle: 'preserve-3d',
  },
  playersCard: {
    height: '100%',
    padding: '28px',
  },
  configCard: {
    height: '100%',
    padding: '28px',
  },
  sectionTitle: {
    fontSize: '1.5rem',
    fontWeight: 600,
    color: '#fff',
    margin: 0,
    marginBottom: '20px',
  },
  playerCount: {
    fontWeight: 400,
    color: '#a0a0d0',
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
  footer: {
    marginTop: '32px',
    textAlign: 'center',
  },
  waitingText: {
    color: '#a0a0d0',
    fontSize: '1rem',
  },
};

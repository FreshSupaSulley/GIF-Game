import { useState, useCallback, useEffect } from 'react';
import { useGameState, useSend, useSubscription, useDiscordUser } from '../hooks';
import { Button, Card, Input, Timer, Avatar } from '../components/ui';
import { proxyGifUrl } from '../utils';
import type { ScoreBreakdown } from '@gif-game/shared';

export function GuessingView() {
  const { state, config, players, currentGif, hostId } = useGameState();
  const user = useDiscordUser();
  const send = useSend();

  const [submitterGuess, setSubmitterGuess] = useState<string | null>(null);
  const [titleGuess, setTitleGuess] = useState('');
  const [queryGuess, setQueryGuess] = useState('');
  const [timerMs, setTimerMs] = useState(0);
  const [scoreReveal, setScoreReveal] = useState<ScoreBreakdown | null>(null);

  const guessTimeLimit = (config?.guessTimeLimit ?? 30) * 1000;
  const queryGuessEnabled = config?.queryGuessEnabled ?? false;
  const isMyTurn = state?.turnOrder?.[state.currentTurnIndex] === user?.id;
  const currentGuesser = state?.turnOrder?.[state.currentTurnIndex];
  const currentGuesserPlayer = currentGuesser ? players[currentGuesser] : null;
  
  // Get the submitter's name for the query guess prompt
  const submitterPlayer = submitterGuess ? players[submitterGuess] : null;

  // Get eligible players for submitter guess (exclude self AND CPUs)
  const eligiblePlayers = Object.values(players)
    .filter(p => p.connected && p.id !== user?.id && !p.id.startsWith('cpu-'))
    .sort((a, b) => a.username.localeCompare(b.username));

  // Skip submitter guess if there's only one eligible player (it's obvious)
  const skipSubmitterGuess = eligiblePlayers.length <= 1;

  // Subscribe to timer ticks
  useSubscription('timer:tick', useCallback((msg) => {
    if (msg.phase === 'guessing') {
      setTimerMs(msg.remainingMs);
    }
  }, []));

  // Subscribe to score reveals
  useSubscription('score:reveal', useCallback((msg) => {
    setScoreReveal(msg.breakdown);
    // Clear after animation
    setTimeout(() => setScoreReveal(null), 3000);
  }, []));

  // Reset state when turn changes
  useEffect(() => {
    setSubmitterGuess(null);
    setTitleGuess('');
    setQueryGuess('');
  }, [state?.currentTurnIndex, state?.currentGifIndex]);

  // Handle submitter guess
  const handleSubmitterGuess = useCallback((playerId: string) => {
    if (!isMyTurn || submitterGuess !== null) return;
    setSubmitterGuess(playerId);
    send({ type: 'guess:submitter', playerId });
  }, [send, isMyTurn, submitterGuess]);

  // Check if submission is ready
  const submitterReady = skipSubmitterGuess || submitterGuess !== null;
  const queryReady = !queryGuessEnabled || queryGuess.trim().length > 0;
  const canSubmit = titleGuess.trim().length > 0 && submitterReady && queryReady;

  // Handle title guess (includes query guess)
  const handleTitleSubmit = useCallback(() => {
    if (!isMyTurn || !canSubmit) return;
    send({ 
      type: 'guess:title', 
      text: titleGuess.trim(),
      queryGuess: queryGuessEnabled ? queryGuess.trim() : undefined,
    });
  }, [send, isMyTurn, canSubmit, titleGuess, queryGuess, queryGuessEnabled]);

  // Handle Enter key on inputs
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleTitleSubmit();
    }
  }, [handleTitleSubmit]);

  // Get the proxied GIF URL
  const gifUrl = currentGif?.gif.url ? proxyGifUrl(currentGif.gif.url) : '';

  // Show score reveal overlay
  if (scoreReveal) {
    return (
      <div style={styles.container}>
        <Card style={styles.scoreRevealCard}>
          <h2 style={styles.revealTitle}>Score Breakdown</h2>
          
          <div style={styles.revealContent}>
            <div style={styles.revealRow}>
              <span>Guess:</span>
              <span>"{scoreReveal.guess}"</span>
            </div>
            <div style={styles.revealRow}>
              <span>Actual Title:</span>
              <span>"{scoreReveal.gifTitle}"</span>
            </div>

            {scoreReveal.submitterGuessCorrect !== null && (
              <div style={styles.revealRow}>
                <span>Submitter Guess:</span>
                <span style={{ color: scoreReveal.submitterGuessCorrect ? '#43B581' : '#ED4245' }}>
                  {scoreReveal.submitterGuessCorrect ? '✓ Correct' : '✗ Wrong'} (+{scoreReveal.submitterPoints})
                </span>
              </div>
            )}

            {scoreReveal.exactKeywords.length > 0 && (
              <div style={styles.revealRow}>
                <span>Title Keywords:</span>
                <span style={{ color: '#43B581' }}>
                  {scoreReveal.exactKeywords.join(', ')} (+{scoreReveal.exactMatchPoints})
                </span>
              </div>
            )}

            {scoreReveal.semanticPoints > 0 && (
              <div style={styles.revealRow}>
                <span>Title Similarity:</span>
                <span style={{ color: '#5865F2' }}>
                  {(scoreReveal.semanticScore * 100).toFixed(0)}% match (+{scoreReveal.semanticPoints})
                </span>
              </div>
            )}

            {/* Query bonus section */}
            {scoreReveal.queryUsed && (
              <>
                <div style={styles.revealRow}>
                  <span>Search Query:</span>
                  <span style={{ color: '#a0a0a0' }}>"{scoreReveal.queryUsed}"</span>
                </div>
                
                {scoreReveal.queryKeywords.length > 0 && (
                  <div style={styles.revealRow}>
                    <span>Query Keywords:</span>
                    <span style={{ color: '#FAA61A' }}>
                      {scoreReveal.queryKeywords.join(', ')} (+{scoreReveal.queryMatchPoints})
                    </span>
                  </div>
                )}

                {scoreReveal.querySemanticPoints > 0 && (
                  <div style={styles.revealRow}>
                    <span>Query Similarity:</span>
                    <span style={{ color: '#FAA61A' }}>
                      {(scoreReveal.querySemanticScore * 100).toFixed(0)}% match (+{scoreReveal.querySemanticPoints})
                    </span>
                  </div>
                )}
              </>
            )}

            <div style={styles.totalRow}>
              <span>Total Points:</span>
              <span style={styles.totalPoints}>+{scoreReveal.totalPoints}</span>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  // Spectator view (not my turn)
  if (!isMyTurn) {
    return (
      <div style={styles.container}>
        <h1 style={styles.title}>Guessing Phase</h1>

        {/* Current GIF */}
        {currentGif && (
          <Card style={styles.gifCard}>
            <img
              src={gifUrl}
              alt="Mystery GIF"
              style={styles.gifImage}
            />
          </Card>
        )}

        {/* Current guesser info */}
        <Card style={styles.spectatorCard}>
          <Timer remainingMs={timerMs} totalMs={guessTimeLimit} label="Time Remaining" />
          
          <div style={styles.currentGuesserInfo}>
            {currentGuesserPlayer && (
              <>
                <Avatar src={currentGuesserPlayer.avatar} alt={currentGuesserPlayer.username} size={48} />
                <span style={styles.guesserName}>
                  {currentGuesserPlayer.username} is guessing...
                </span>
              </>
            )}
          </div>
        </Card>

        <p style={styles.subtitle}>
          Round {(state?.currentGifIndex ?? 0) + 1} of {state?.mysteryPool.length ?? '?'}
        </p>
      </div>
    );
  }

  // My turn - active guessing view
  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Your Turn!</h1>

      {/* Timer */}
      <Card style={styles.timerCard}>
        <Timer remainingMs={timerMs} totalMs={guessTimeLimit} />
      </Card>

      {/* Large GIF */}
      {currentGif && (
        <Card style={styles.gifCard}>
          <img
            src={gifUrl}
            alt="Mystery GIF"
            style={styles.gifImage}
          />
        </Card>
      )}

      {/* Submitter Guess (skip if only CPUs or one eligible player) */}
      {!skipSubmitterGuess && (
        <Card style={styles.submitterCard}>
          <h3 style={styles.cardTitle}>Who submitted this GIF?</h3>
          <div style={styles.playerGrid}>
            {eligiblePlayers.map((player) => (
              <button
                key={player.id}
                onClick={() => handleSubmitterGuess(player.id)}
                disabled={submitterGuess !== null}
                style={{
                  ...styles.playerButton,
                  borderColor: submitterGuess === player.id ? '#5865F2' : 'transparent',
                  opacity: submitterGuess !== null && submitterGuess !== player.id ? 0.5 : 1,
                }}
              >
                <Avatar src={player.avatar} alt={player.username} size={36} />
                <span>{player.username}</span>
              </button>
            ))}
          </div>
        </Card>
      )}

      {/* Guess inputs - inline row */}
      <div style={styles.inputRow}>
        <Input
          value={titleGuess}
          onChange={(e) => setTitleGuess(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="GIF name?"
          maxLength={200}
          fullWidth
        />

        {queryGuessEnabled && (
          <Input
            value={queryGuess}
            onChange={(e) => setQueryGuess(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`What did ${submitterPlayer?.username || 'they'} search?`}
            maxLength={200}
            fullWidth
          />
        )}

        <Button
          variant="primary"
          onClick={handleTitleSubmit}
          disabled={!canSubmit}
        >
          Submit
        </Button>
      </div>

      {!submitterReady && (
        <p style={styles.hint}>Select a player first</p>
      )}
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
    fontSize: '2rem',
    fontWeight: 700,
    color: '#fff',
    margin: 0,
    marginBottom: '16px',
  },
  subtitle: {
    fontSize: '1rem',
    color: '#a0a0d0',
    marginTop: '16px',
  },
  timerCard: {
    marginBottom: '16px',
    minWidth: '200px',
    textAlign: 'center',
  },
  gifCard: {
    marginBottom: '16px',
  },
  gifImage: {
    maxWidth: '500px',
    maxHeight: '400px',
    borderRadius: '8px',
  },
  submitterCard: {
    marginBottom: '16px',
    width: '100%',
    maxWidth: '600px',
  },
  inputRow: {
    display: 'flex',
    gap: '12px',
    width: '100%',
    maxWidth: '700px',
    alignItems: 'center',
  },
  guessRow: {
    display: 'flex',
    gap: '16px',
    width: '100%',
    maxWidth: '700px',
    marginBottom: '16px',
  },
  guessCard: {
    flex: '1 1 0',
    minWidth: 0,
  },
  cardTitle: {
    fontSize: '1rem',
    fontWeight: 600,
    color: '#fff',
    margin: 0,
    marginBottom: '12px',
  },
  playerGrid: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
    justifyContent: 'center',
  },
  playerButton: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '4px',
    padding: '12px 16px',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    border: '2px solid transparent',
    borderRadius: '8px',
    cursor: 'pointer',
    color: '#fff',
    transition: 'border-color 0.2s',
  },
  inputRow: {
    display: 'flex',
    gap: '12px',
  },
  hint: {
    color: '#a0a0a0',
    fontSize: '14px',
    marginTop: '8px',
    textAlign: 'center',
  },
  spectatorCard: {
    textAlign: 'center',
    padding: '24px',
  },
  currentGuesserInfo: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    marginTop: '16px',
  },
  guesserName: {
    fontSize: '1.25rem',
    fontWeight: 600,
    color: '#fff',
  },
  scoreRevealCard: {
    textAlign: 'center',
    padding: '32px',
    maxWidth: '400px',
  },
  revealTitle: {
    fontSize: '1.5rem',
    fontWeight: 700,
    color: '#fff',
    margin: 0,
    marginBottom: '24px',
  },
  revealContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  revealRow: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '8px 0',
    borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
  },
  totalRow: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '16px 0',
    marginTop: '8px',
  },
  totalPoints: {
    fontSize: '1.5rem',
    fontWeight: 700,
    color: '#5865F2',
  },
};

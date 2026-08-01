import { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useGameState, useSend, useSubscription, useDiscordUser } from '../hooks';
import { Button, Card, Input, Avatar } from '../components/ui';
import { StingerTransition } from '../components/StingerTransition';
import type { StingerType } from '../components/StingerTransition';
import { proxyGifUrl } from '../utils';
import type { ScoreBreakdown } from '@gif-game/shared';

// Sub-views within the guessing phase
type GuessingSubView = 'my-turn' | 'spectator' | 'score-reveal';

// Get stinger config for sub-view transitions
function getSubViewStinger(from: GuessingSubView, to: GuessingSubView): { type: StingerType; color: string } {
  // Score reveal always uses burst
  if (to === 'score-reveal') {
    return { type: 'burst', color: '#57F287' };
  }
  // Leaving score reveal uses radial
  if (from === 'score-reveal') {
    return { type: 'radial', color: '#5865F2' };
  }
  // Between turns uses diamond
  return { type: 'diamond', color: '#EB459E' };
}

export function GuessingView() {
  const { state, config, players, currentGif, hostId } = useGameState();
  const user = useDiscordUser();
  const send = useSend();

  const [submitterGuess, setSubmitterGuess] = useState<string | null>(null);
  const [titleGuess, setTitleGuess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const guessTimeLimit = (config?.guessTimeLimit ?? 30) * 1000;
  
  // Initialize timer from state or default to full time
  const initialTimerMs = state?.guessTimer?.remainingMs ?? guessTimeLimit;
  const [timerMs, setTimerMs] = useState(initialTimerMs);
  
  // Sub-view state with stinger transitions
  const [displayedSubView, setDisplayedSubView] = useState<GuessingSubView>('spectator');
  const [isStingerActive, setIsStingerActive] = useState(false);
  const [stingerKey, setStingerKey] = useState(0);
  const [stingerConfig, setStingerConfig] = useState({ type: 'burst' as StingerType, color: '#57F287' });
  const targetSubViewRef = useRef<GuessingSubView>('spectator');
  const processingTransitionRef = useRef(false);
  
  // Score reveal data
  const [scoreReveal, setScoreReveal] = useState<ScoreBreakdown | null>(null);
  const pendingScoreRevealRef = useRef<ScoreBreakdown | null>(null);

  const isMyTurn = state?.turnOrder?.[state.currentTurnIndex] === user?.id;
  const currentGuesser = state?.turnOrder?.[state.currentTurnIndex];
  const currentGuesserPlayer = currentGuesser ? players[currentGuesser] : null;

  // Get eligible players for submitter guess (exclude self AND CPUs)
  const eligiblePlayers = Object.values(players)
    .filter(p => p.connected && p.id !== user?.id && !p.id.startsWith('cpu-'))
    .sort((a, b) => a.username.localeCompare(b.username));

  // Skip submitter guess if there's only one eligible player (it's obvious)
  const skipSubmitterGuess = eligiblePlayers.length <= 1;

  // Determine target sub-view based on current state
  const targetSubView: GuessingSubView = scoreReveal ? 'score-reveal' : (isMyTurn ? 'my-turn' : 'spectator');

  // Trigger stinger when sub-view changes
  const triggerTransition = useCallback((to: GuessingSubView) => {
    if (processingTransitionRef.current) {
      targetSubViewRef.current = to;
      return;
    }
    
    const from = displayedSubView;
    if (from === to) return;
    
    processingTransitionRef.current = true;
    targetSubViewRef.current = to;
    setStingerConfig(getSubViewStinger(from, to));
    setStingerKey(k => k + 1);
    setIsStingerActive(true);
  }, [displayedSubView]);

  // Handle stinger midpoint - swap view
  const handleStingerMidpoint = useCallback(() => {
    const target = targetSubViewRef.current;
    setDisplayedSubView(target);
    
    // If transitioning to score-reveal, set the score data now
    if (target === 'score-reveal' && pendingScoreRevealRef.current) {
      setScoreReveal(pendingScoreRevealRef.current);
    }
  }, []);

  // Handle stinger complete
  const handleStingerComplete = useCallback(() => {
    setIsStingerActive(false);
    processingTransitionRef.current = false;
    
    // If we're on score reveal, schedule transition back
    if (targetSubViewRef.current === 'score-reveal') {
      setTimeout(() => {
        pendingScoreRevealRef.current = null;
        setScoreReveal(null);
        // This will trigger the next transition
      }, 2500);
    }
  }, []);

  // Subscribe to timer ticks
  useSubscription('timer:tick', useCallback((msg) => {
    if (msg.phase === 'guessing') {
      setTimerMs(msg.remainingMs);
    }
  }, []));

  // Subscribe to score reveals - store pending and trigger transition
  useSubscription('score:reveal', useCallback((msg) => {
    pendingScoreRevealRef.current = msg.breakdown;
    triggerTransition('score-reveal');
  }, [triggerTransition]));

  // Handle turn changes - trigger transition to appropriate view
  useEffect(() => {
    const newTarget = isMyTurn ? 'my-turn' : 'spectator';
    // Only transition if not showing score reveal
    if (!scoreReveal && !pendingScoreRevealRef.current) {
      if (displayedSubView !== newTarget) {
        triggerTransition(newTarget);
      }
    }
  }, [isMyTurn, scoreReveal, displayedSubView, triggerTransition]);

  // When score reveal clears, transition to the correct turn view
  useEffect(() => {
    if (!scoreReveal && !pendingScoreRevealRef.current && displayedSubView === 'score-reveal') {
      const newTarget = isMyTurn ? 'my-turn' : 'spectator';
      triggerTransition(newTarget);
    }
  }, [scoreReveal, isMyTurn, displayedSubView, triggerTransition]);

  // Reset input state when turn changes
  useEffect(() => {
    setSubmitterGuess(null);
    setTitleGuess('');
    setIsSubmitting(false);
  }, [state?.currentTurnIndex, state?.currentGifIndex]);

  // Handle submitter guess
  const handleSubmitterGuess = useCallback((playerId: string) => {
    if (!isMyTurn || submitterGuess !== null) return;
    setSubmitterGuess(playerId);
    send({ type: 'guess:submitter', playerId });
  }, [send, isMyTurn, submitterGuess]);

  // Check if submission is ready
  const submitterReady = skipSubmitterGuess || submitterGuess !== null;
  const canSubmit = titleGuess.trim().length > 0 && submitterReady && !isSubmitting;

  // Handle title guess - same guess is used for both title AND query matching
  const handleTitleSubmit = useCallback(() => {
    if (!isMyTurn || !canSubmit || isSubmitting) return;
    setIsSubmitting(true);
    send({ 
      type: 'guess:title', 
      text: titleGuess.trim(),
      queryGuess: titleGuess.trim(), // Same guess for both
    });
  }, [send, isMyTurn, canSubmit, titleGuess, isSubmitting]);

  // Handle Enter key on inputs
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleTitleSubmit();
    }
  }, [handleTitleSubmit]);

  // Get the proxied GIF URL
  const gifUrl = currentGif?.gif.url ? proxyGifUrl(currentGif.gif.url) : '';

  // Render score reveal content
  const renderScoreReveal = () => {
    if (!scoreReveal) return null;
    return (
      <div style={styles.scoreRevealContainer}>
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        >
          <Card style={styles.scoreRevealCard}>
            <h2 style={styles.revealTitle}>Score Breakdown</h2>
            
            <div style={styles.revealContent}>
              <motion.div
                style={styles.revealRow}
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.1 }}
              >
                <span>Guess:</span>
                <span>"{scoreReveal.guess}"</span>
              </motion.div>
              <motion.div
                style={styles.revealRow}
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.15 }}
              >
                <span>Actual Title:</span>
                <span>"{scoreReveal.gifTitle}"</span>
              </motion.div>

              {scoreReveal.submitterGuessCorrect !== null && (
                <motion.div
                  style={styles.revealRow}
                  initial={{ x: -20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 0.2 }}
                >
                  <span>Submitter Guess:</span>
                  <span style={{ color: scoreReveal.submitterGuessCorrect ? '#43B581' : '#ED4245' }}>
                    {scoreReveal.submitterGuessCorrect ? '✓ Correct' : '✗ Wrong'} (+{scoreReveal.submitterPoints})
                  </span>
                </motion.div>
              )}

              {scoreReveal.perfectMatch && (
                <motion.div
                  style={styles.revealRow}
                  initial={{ x: -20, opacity: 0, scale: 1.1 }}
                  animate={{ x: 0, opacity: 1, scale: 1 }}
                  transition={{ delay: 0.22, type: 'spring', stiffness: 400 }}
                >
                  <span style={{ color: '#FFD700' }}>PERFECT MATCH!</span>
                  <span style={{ color: '#FFD700', fontWeight: 700 }}>
                    +{scoreReveal.perfectMatchBonus}
                  </span>
                </motion.div>
              )}

              {scoreReveal.exactKeywords.length > 0 && (
                <motion.div
                  style={styles.revealRow}
                  initial={{ x: -20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 0.25 }}
                >
                  <span>Title Keywords:</span>
                  <span style={{ color: '#43B581' }}>
                    {scoreReveal.exactKeywords.join(', ')} (+{scoreReveal.exactMatchPoints})
                  </span>
                </motion.div>
              )}

              {scoreReveal.semanticPoints > 0 && (
                <motion.div
                  style={styles.revealRow}
                  initial={{ x: -20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 0.3 }}
                >
                  <span>Title Similarity:</span>
                  <span style={{ color: '#5865F2' }}>
                    {(scoreReveal.semanticScore * 100).toFixed(0)}% match (+{scoreReveal.semanticPoints})
                  </span>
                </motion.div>
              )}

              {/* Query bonus section */}
              {scoreReveal.queryUsed && (
                <>
                  <motion.div
                    style={styles.revealRow}
                    initial={{ x: -20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: 0.35 }}
                  >
                    <span>Search Query:</span>
                    <span style={{ color: '#a0a0a0' }}>"{scoreReveal.queryUsed}"</span>
                  </motion.div>
                  
                  {scoreReveal.queryKeywords.length > 0 && (
                    <motion.div
                      style={styles.revealRow}
                      initial={{ x: -20, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      transition={{ delay: 0.4 }}
                    >
                      <span>Query Keywords:</span>
                      <span style={{ color: '#FAA61A' }}>
                        {scoreReveal.queryKeywords.join(', ')} (+{scoreReveal.queryMatchPoints})
                      </span>
                    </motion.div>
                  )}

                  {scoreReveal.querySemanticPoints > 0 && (
                    <motion.div
                      style={styles.revealRow}
                      initial={{ x: -20, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      transition={{ delay: 0.45 }}
                    >
                      <span>Query Similarity:</span>
                      <span style={{ color: '#FAA61A' }}>
                        {(scoreReveal.querySemanticScore * 100).toFixed(0)}% match (+{scoreReveal.querySemanticPoints})
                      </span>
                    </motion.div>
                  )}
                </>
              )}

              <motion.div
                style={styles.totalRow}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 400, damping: 15, delay: 0.5 }}
              >
                <span>Total Points:</span>
                <span style={styles.totalPoints}>+{scoreReveal.totalPoints}</span>
              </motion.div>
            </div>
          </Card>
        </motion.div>
      </div>
    );
  };

  // Render spectator view
  const renderSpectator = () => (
    <div style={styles.spectatorContainer}>
        <motion.h1
          style={styles.title}
          initial={{ y: -30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        >
          Guessing Phase
        </motion.h1>

        {/* Current GIF with dramatic entrance */}
        {currentGif && (
          <motion.div
            initial={{ scale: 0.5, opacity: 0, rotateY: -30 }}
            animate={{ scale: 1, opacity: 1, rotateY: 0 }}
            transition={{ type: 'spring', stiffness: 200, damping: 20, delay: 0.1 }}
          >
            <Card style={styles.gifCard}>
              <img
                src={gifUrl}
                alt="Mystery GIF"
                style={styles.gifImage}
              />
            </Card>
          </motion.div>
        )}

        {/* Current guesser info */}
        <Card style={styles.spectatorCard} animate delay={0.2}>
          <motion.div
            style={styles.currentGuesserInfo}
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            {currentGuesserPlayer && (
              <>
                <Avatar src={currentGuesserPlayer.avatar} alt={currentGuesserPlayer.username} size={48} />
                <span style={styles.guesserName}>
                  {currentGuesserPlayer.username} is guessing...
                </span>
              </>
            )}
          </motion.div>
        </Card>

        <motion.p
          style={styles.subtitle}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          Round {(state?.currentGifIndex ?? 0) + 1} of {state?.mysteryPool.length ?? '?'}
        </motion.p>
      </div>
  );

  // Render my turn view
  const renderMyTurn = () => (
    <div style={styles.container}>
      <motion.h1
        style={styles.title}
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 400, damping: 15 }}
      >
        Your Turn!
      </motion.h1>

      {/* Large GIF with dramatic reveal */}
      {currentGif && (
        <motion.div
          initial={{ scale: 0.3, opacity: 0, y: 50 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 200, damping: 20, delay: 0.1 }}
        >
          <Card style={styles.gifCard}>
            <img
              src={gifUrl}
              alt="Mystery GIF"
              style={styles.gifImage}
            />
          </Card>
        </motion.div>
      )}

      {/* Submitter Guess (skip if only CPUs or one eligible player) */}
      {!skipSubmitterGuess && (
        <motion.div
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.25 }}
          style={{ width: '100%', maxWidth: '600px' }}
        >
          <Card style={styles.submitterCard}>
            <h3 style={styles.cardTitle}>Who submitted this GIF?</h3>
            <div style={styles.playerGrid}>
              {eligiblePlayers.map((player, index) => (
                <motion.button
                  key={player.id}
                  onClick={() => handleSubmitterGuess(player.id)}
                  disabled={submitterGuess !== null}
                  style={{
                    ...styles.playerButton,
                    borderColor: submitterGuess === player.id ? '#5865F2' : 'transparent',
                    opacity: submitterGuess !== null && submitterGuess !== player.id ? 0.5 : 1,
                  }}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: submitterGuess !== null && submitterGuess !== player.id ? 0.5 : 1 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 20, delay: 0.3 + index * 0.05 }}
                  whileHover={submitterGuess === null ? { scale: 1.05, y: -2 } : undefined}
                  whileTap={submitterGuess === null ? { scale: 0.95 } : undefined}
                >
                  <Avatar src={player.avatar} alt={player.username} size={36} />
                  <span>{player.username}</span>
                </motion.button>
              ))}
            </div>
          </Card>
        </motion.div>
      )}

      {/* Guess inputs - stacked vertically */}
      <motion.div
        style={styles.inputStack}
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.35 }}
      >
        <Input
          value={titleGuess}
          onChange={(e) => setTitleGuess(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="What is this GIF?"
          maxLength={200}
          fullWidth
        />

        <Button
          variant="primary"
          onClick={handleTitleSubmit}
          disabled={!canSubmit}
          fullWidth
        >
          Submit
        </Button>
      </motion.div>

      <AnimatePresence>
        {!submitterReady && (
          <motion.p
            style={styles.hint}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            Select a player first
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );

  // Render the current sub-view based on displayedSubView
  const renderCurrentView = () => {
    switch (displayedSubView) {
      case 'score-reveal':
        return renderScoreReveal();
      case 'spectator':
        return renderSpectator();
      case 'my-turn':
        return renderMyTurn();
      default:
        return renderSpectator();
    }
  };

  // Main render with stinger overlay
  return (
    <>
      {/* Stinger for sub-view transitions */}
      <StingerTransition
        key={stingerKey}
        isActive={isStingerActive}
        type={stingerConfig.type}
        color={stingerConfig.color}
        duration={0.8}
        onMidpoint={handleStingerMidpoint}
        onComplete={handleStingerComplete}
      />
      {renderCurrentView()}
    </>
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
  spectatorContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
    minHeight: '100vh',
    boxSizing: 'border-box',
    backgroundColor: 'rgba(88, 101, 242, 0.08)', // Brighter purple tint for spectator
  },
  scoreRevealContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
    minHeight: '100vh',
    boxSizing: 'border-box',
    position: 'relative',
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
    maxWidth: '700px',
    maxHeight: '550px',
    borderRadius: '8px',
  },
  submitterCard: {
    marginBottom: '16px',
    width: '100%',
  },
  inputStack: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    width: '100%',
    maxWidth: '400px',
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
  },
  hint: {
    color: '#a0a0a0',
    fontSize: '14px',
    marginTop: '8px',
    textAlign: 'center',
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
  spectatorCard: {
    textAlign: 'center',
    padding: '24px',
  },
  scoreRevealCard: {
    textAlign: 'center',
    padding: '48px',
    maxWidth: '600px',
    minWidth: '500px',
  },
  revealTitle: {
    fontSize: '2rem',
    fontWeight: 700,
    color: '#fff',
    margin: 0,
    marginBottom: '32px',
  },
  revealContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  revealRow: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '12px 0',
    fontSize: '1.125rem',
    borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
  },
  totalRow: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '20px 0',
    marginTop: '12px',
    fontSize: '1.25rem',
  },
  totalPoints: {
    fontSize: '2rem',
    fontWeight: 700,
    color: '#FAA61A',
  },
};

import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useSubscription, useGameState } from '../hooks';
import type { GamePhase } from '@gif-game/shared';

interface GlobalTimerProps {
  /** Override the phase used for visibility (for stinger sync) */
  phase?: GamePhase | null;
}

/**
 * Global timer that displays in the top-left corner across all game screens.
 * Subscribes to timer:tick events and shows the countdown.
 */
export function GlobalTimer({ phase: phaseOverride }: GlobalTimerProps) {
  const { state } = useGameState();
  const currentPhase = phaseOverride ?? state?.phase;
  const [timerState, setTimerState] = useState<{
    phase: string;
    remainingMs: number;
  } | null>(null);

  // Clear timer state when game phase changes to non-timed phase
  useEffect(() => {
    if (currentPhase !== 'submission' && currentPhase !== 'guessing') {
      setTimerState(null);
    }
  }, [currentPhase]);

  // Subscribe to timer ticks
  useSubscription('timer:tick', useCallback((msg) => {
    setTimerState({
      phase: msg.phase,
      remainingMs: msg.remainingMs,
    });
  }, []));

  // Only show timer during submission and guessing phases
  const isRelevantPhase = timerState?.phase === 'submission' || timerState?.phase === 'guessing';
  
  // Don't show if no timer active or not a relevant phase
  if (!timerState || timerState.remainingMs <= 0 || !isRelevantPhase) {
    return null;
  }

  const seconds = Math.ceil(timerState.remainingMs / 1000);
  const isLow = seconds <= 5;
  
  // Get phase label
  const phaseLabel = timerState.phase === 'submission' ? 'Submit' : 
                     timerState.phase === 'guessing' ? 'Guess' : '';

  return (
    <AnimatePresence>
      <motion.div
        style={styles.container}
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      >
        {phaseLabel && (
          <span style={styles.label}>{phaseLabel}</span>
        )}
        <motion.span
          style={{
            ...styles.time,
            color: isLow ? '#ED4245' : '#fff',
          }}
          animate={isLow ? { scale: [1, 1.1, 1] } : { scale: 1 }}
          transition={{
            duration: 0.5,
            repeat: isLow ? Infinity : 0,
            repeatType: 'reverse',
          }}
        >
          {seconds}s
        </motion.span>
      </motion.div>
    </AnimatePresence>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: 'fixed',
    top: 16,
    left: 16,
    zIndex: 50,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    padding: '8px 16px',
    borderRadius: 8,
    backdropFilter: 'blur(8px)',
  },
  label: {
    color: '#a0a0d0',
    fontSize: 14,
    fontWeight: 500,
  },
  time: {
    fontSize: 24,
    fontWeight: 700,
    fontVariantNumeric: 'tabular-nums',
  },
};

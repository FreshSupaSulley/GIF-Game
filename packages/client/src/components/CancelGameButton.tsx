import { useState, useCallback, useEffect } from 'react';
import { motion } from 'motion/react';
import { useGameState, useSend } from '../hooks';
import { ConfirmDialog } from './ui';
import type { GamePhase } from '@gif-game/shared';

interface CancelGameButtonProps {
  /** Override the phase used for visibility (for stinger sync) */
  phase?: GamePhase | null;
}

/**
 * Cancel game button that appears in the top-right corner for hosts during active games.
 * Opens a confirmation dialog before canceling the game for everyone.
 */
export function CancelGameButton({ phase: phaseOverride }: CancelGameButtonProps) {
  const { isHost, phase: statePhase } = useGameState();
  const phase = phaseOverride ?? statePhase;
  const send = useSend();
  const [showConfirm, setShowConfirm] = useState(false);
  const [isCanceling, setIsCanceling] = useState(false);

  // Reset isCanceling when phase changes (e.g., returning to lobby or starting new game)
  useEffect(() => {
    setIsCanceling(false);
    setShowConfirm(false);
  }, [phase]);

  // Show on all active game phases (not lobby, not endgame) for host only
  const isActiveGame = phase !== 'lobby' && phase !== 'endgame' && phase !== null;
  const shouldShow = isHost && isActiveGame;

  const handleCancelClick = useCallback(() => {
    setShowConfirm(true);
  }, []);

  const handleConfirm = useCallback(() => {
    setIsCanceling(true);
    send({ type: 'game:cancel' });
    setShowConfirm(false);
  }, [send]);

  const handleCancel = useCallback(() => {
    setShowConfirm(false);
  }, []);

  if (!shouldShow) {
    return null;
  }

  return (
    <>
      <motion.button
        onClick={handleCancelClick}
        disabled={isCanceling}
        style={{
          position: 'fixed',
          top: 16,
          right: 16,
          zIndex: 50,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          backgroundColor: 'rgba(237, 66, 69, 0.8)',
          color: '#fff',
          border: 'none',
          borderRadius: 8,
          padding: '8px 14px',
          fontSize: '14px',
          fontWeight: 600,
          cursor: isCanceling ? 'not-allowed' : 'pointer',
          backdropFilter: 'blur(8px)',
          opacity: isCanceling ? 0.6 : 1,
        }}
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        whileHover={!isCanceling ? { scale: 1.05, backgroundColor: 'rgba(237, 66, 69, 1)' } : undefined}
        whileTap={!isCanceling ? { scale: 0.95 } : undefined}
        title="End game early and return to lobby"
      >
        ✕ End Game
      </motion.button>

      <ConfirmDialog
        isOpen={showConfirm}
        title="End Game Early?"
        message="This will cancel the current game for all players and return everyone to the lobby. Are you sure?"
        confirmText="End Game"
        cancelText="Keep Playing"
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </>
  );
}

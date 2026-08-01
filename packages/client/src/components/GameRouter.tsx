import { useState, useEffect, useRef, useCallback } from 'react';
import { usePhase, useWebSocket } from '../hooks';
import { LobbyView, SubmissionView, GuessingView, ScoreboardView } from '../views';
import { LoadingSpinner } from './ui';
import { AnimatedView, AnimatedPresenceWrapper } from './AnimatedView';
import { StingerTransition, getStingerConfig } from './StingerTransition';
import { ParticleBackground } from './ParticleBackground';
import { ScrollingGifsBackground } from './ScrollingGifsBackground';
import { CelebrationBackground } from './CelebrationBackground';
import { GlobalTimer } from './GlobalTimer';
import { CancelGameButton } from './CancelGameButton';
import type { GamePhase } from '@gif-game/shared';

/**
 * Routes to the appropriate view based on the current game phase.
 * Uses AnimatePresence for smooth transitions between views.
 * Plays stinger transitions between phase changes.
 */
export function GameRouter() {
  const phase = usePhase();
  const { status: wsStatus, error: wsError } = useWebSocket();
  
  // Track the displayed phase (may lag behind actual phase during stinger)
  const [displayedPhase, setDisplayedPhase] = useState<GamePhase | null>(null);
  const [isStingerActive, setIsStingerActive] = useState(false);
  const [stingerConfig, setStingerConfig] = useState(getStingerConfig('lobby', 'lobby'));
  // Counter to force stinger remount on each new transition
  const [stingerKey, setStingerKey] = useState(0);
  
  // Track previous phase for stinger selection
  const previousPhaseRef = useRef<GamePhase | null>(null);
  // Store the target phase for the stinger to use (avoids stale closure)
  const targetPhaseRef = useRef<GamePhase | null>(null);
  // Track if we've started processing a phase change
  const processingPhaseChangeRef = useRef(false);

  // Handle phase changes with stinger transitions
  useEffect(() => {
    console.log('[GameRouter] Phase effect:', { 
      phase, 
      displayedPhase, 
      isStingerActive, 
      processing: processingPhaseChangeRef.current,
      previousPhase: previousPhaseRef.current,
      targetPhase: targetPhaseRef.current 
    });
    
    if (phase === null) {
      // Reset when no phase
      setDisplayedPhase(null);
      processingPhaseChangeRef.current = false;
      return;
    }

    // If this is the first phase (initial load), show it directly
    if (displayedPhase === null) {
      console.log('[GameRouter] Initial phase, setting directly:', phase);
      setDisplayedPhase(phase);
      previousPhaseRef.current = phase;
      return;
    }

    // If already processing a phase change, update the target but don't restart stinger
    if (processingPhaseChangeRef.current) {
      console.log('[GameRouter] Already processing, updating target to:', phase);
      targetPhaseRef.current = phase;
      return;
    }

    // If phase changed, trigger stinger
    if (phase !== displayedPhase) {
      console.log('[GameRouter] Phase changed, triggering stinger:', { from: displayedPhase, to: phase });
      const fromPhase = displayedPhase; // Use current displayedPhase, not previousPhaseRef
      const config = getStingerConfig(fromPhase, phase);
      setStingerConfig(config);
      targetPhaseRef.current = phase;
      previousPhaseRef.current = phase;
      processingPhaseChangeRef.current = true;
      setStingerKey(k => k + 1); // Force stinger remount
      setIsStingerActive(true);
    }
  }, [phase, displayedPhase]);

  // Handle stinger midpoint - swap the view
  const handleStingerMidpoint = useCallback(() => {
    // Use ref to get the correct target phase (avoids stale closure)
    const targetPhase = targetPhaseRef.current;
    console.log('[GameRouter] Stinger midpoint, setting displayedPhase to:', targetPhase);
    if (targetPhase) {
      setDisplayedPhase(targetPhase);
    }
  }, []);

  // Handle stinger complete
  const handleStingerComplete = useCallback(() => {
    console.log('[GameRouter] Stinger complete, resetting processingPhaseChangeRef');
    setIsStingerActive(false);
    // Reset processing flag AFTER setting stinger inactive
    // Use setTimeout to ensure state update happens first
    setTimeout(() => {
      processingPhaseChangeRef.current = false;
      console.log('[GameRouter] processingPhaseChangeRef reset to false');
    }, 0);
  }, []);

  // Show connection status while connecting
  if (wsStatus === 'connecting') {
    return (
      <AnimatedPresenceWrapper mode="wait">
        <AnimatedView viewKey="connecting">
          <div style={styles.loading}>
            <LoadingSpinner size={48} />
            <p style={styles.loadingText}>Connecting to server...</p>
          </div>
        </AnimatedView>
      </AnimatedPresenceWrapper>
    );
  }

  if (wsStatus === 'reconnecting') {
    return (
      <AnimatedPresenceWrapper mode="wait">
        <AnimatedView viewKey="reconnecting">
          <div style={styles.loading}>
            <LoadingSpinner size={48} />
            <p style={styles.loadingText}>Reconnecting...</p>
          </div>
        </AnimatedView>
      </AnimatedPresenceWrapper>
    );
  }

  if (wsStatus === 'disconnected') {
    return (
      <AnimatedPresenceWrapper mode="wait">
        <AnimatedView viewKey="disconnected">
          <div style={styles.error}>
            <p>Disconnected from server</p>
            {wsError && <p style={styles.errorDetail}>{wsError}</p>}
          </div>
        </AnimatedView>
      </AnimatedPresenceWrapper>
    );
  }

  // WebSocket connected but no game state yet
  if (!phase || !displayedPhase) {
    return (
      <AnimatedPresenceWrapper mode="wait">
        <AnimatedView viewKey="loading-state">
          <div style={styles.loading}>
            <LoadingSpinner size={48} />
            <p style={styles.loadingText}>Loading game state...</p>
            <p style={styles.hint}>WebSocket: {wsStatus}</p>
          </div>
        </AnimatedView>
      </AnimatedPresenceWrapper>
    );
  }

  // Render the appropriate view based on displayed phase
  const renderView = () => {
    switch (displayedPhase) {
      case 'lobby':
        return (
          <AnimatedView viewKey="lobby">
            <LobbyView />
          </AnimatedView>
        );
      case 'submission':
        return (
          <AnimatedView viewKey="submission">
            <SubmissionView />
          </AnimatedView>
        );
      case 'guessing':
        return (
          <AnimatedView viewKey="guessing">
            <GuessingView />
          </AnimatedView>
        );
      case 'endgame':
        return (
          <AnimatedView viewKey="endgame">
            <ScoreboardView />
          </AnimatedView>
        );
      default:
        return (
          <AnimatedView viewKey="unknown">
            <div style={styles.error}>
              <p>Unknown game phase: {displayedPhase}</p>
            </div>
          </AnimatedView>
        );
    }
  };

  // Background visibility based on displayedPhase (not actual phase)
  const isLobby = displayedPhase === 'lobby';
  const isEndgame = displayedPhase === 'endgame';
  const isGameplay = displayedPhase === 'submission' || displayedPhase === 'guessing';

  console.log('[GameRouter] Render:', { phase, displayedPhase, isStingerActive, stingerType: stingerConfig.type });

  return (
    <>
      {/* Global UI elements that respect stinger transitions */}
      <GlobalTimer phase={displayedPhase} />
      <CancelGameButton phase={displayedPhase} />
      
      {/* Backgrounds controlled by displayedPhase so they change with stinger */}
      <ScrollingGifsBackground visible={isLobby} />
      <ParticleBackground phase={displayedPhase} visible={isGameplay} />
      <CelebrationBackground visible={isEndgame} />
      
      {/* Stinger transition overlay */}
      <StingerTransition
        key={stingerKey}
        isActive={isStingerActive}
        type={stingerConfig.type}
        color={stingerConfig.color}
        duration={1.0}
        onMidpoint={handleStingerMidpoint}
        onComplete={handleStingerComplete}
      />
      
      {/* Main view content */}
      <AnimatedPresenceWrapper mode="wait">
        {renderView()}
      </AnimatedPresenceWrapper>
    </>
  );
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

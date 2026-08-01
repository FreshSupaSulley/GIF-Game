import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import type { CSSProperties } from 'react';
import { useReducedMotion } from '../hooks';

/**
 * Stinger types available for transitions.
 * 'swoosh' - Horizontal sweep with multiple bars
 * 'radial' - Circular reveal from center
 * 'diamond' - Diamond shape expanding from center
 * 'curtain' - Vertical curtains closing/opening
 * 'burst' - Explosive burst from center with particles
 */
export type StingerType = 'swoosh' | 'radial' | 'diamond' | 'curtain' | 'burst';

interface StingerTransitionProps {
  /** Whether the stinger animation should play */
  isActive: boolean;
  /** Callback when the stinger reaches its midpoint (time to swap content) */
  onMidpoint?: () => void;
  /** Callback when the stinger completes */
  onComplete?: () => void;
  /** Type of stinger animation */
  type?: StingerType;
  /** Primary color for the stinger */
  color?: string;
  /** Duration of the full animation in seconds */
  duration?: number;
  /** Z-index for the overlay */
  zIndex?: number;
}

/**
 * Full-screen stinger transition overlay.
 * Plays a dramatic animation that can cover a view swap.
 * 
 * Uses timeouts for reliable callback timing instead of animation events.
 * 
 * Usage:
 * 1. Set isActive to true when transitioning
 * 2. In onMidpoint callback, swap the underlying content
 * 3. Animation completes revealing new content
 */
export function StingerTransition({
  isActive,
  onMidpoint,
  onComplete,
  type = 'swoosh',
  color = '#5865F2',
  duration = 0.6,
  zIndex = 1000,
}: StingerTransitionProps) {
  const prefersReducedMotion = useReducedMotion();
  const midpointTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const completeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Store callbacks in refs to avoid re-triggering effect when they change
  const onMidpointRef = useRef(onMidpoint);
  const onCompleteRef = useRef(onComplete);
  onMidpointRef.current = onMidpoint;
  onCompleteRef.current = onComplete;

  // For reduced motion, use shorter duration
  const actualDuration = prefersReducedMotion ? 0.2 : duration;
  
  console.log('[StingerTransition] Render:', { isActive, actualDuration, type, prefersReducedMotion });
  
  // Use effect to handle timing - more reliable than animation callbacks
  useEffect(() => {
    if (isActive) {
      // Clear any existing timers
      if (midpointTimerRef.current) clearTimeout(midpointTimerRef.current);
      if (completeTimerRef.current) clearTimeout(completeTimerRef.current);
      
      // Trigger midpoint at 55% of duration (when screen is fully covered)
      // The stinger animations cover the screen from 0-45%, hold at 45-55%, then reveal from 55-100%
      const midpointMs = actualDuration * 1000 * 0.55;
      console.log('[StingerTransition] Starting, midpoint in', midpointMs, 'ms, total duration', actualDuration * 1000, 'ms');
      
      midpointTimerRef.current = setTimeout(() => {
        console.log('[StingerTransition] Midpoint reached at', midpointMs, 'ms');
        onMidpointRef.current?.();
      }, midpointMs);
      
      // Trigger complete at end of duration (+ small buffer)
      const completeMs = actualDuration * 1000 + 100;
      completeTimerRef.current = setTimeout(() => {
        console.log('[StingerTransition] Complete at', completeMs, 'ms');
        onCompleteRef.current?.();
      }, completeMs);
    }
    
    return () => {
      if (midpointTimerRef.current) clearTimeout(midpointTimerRef.current);
      if (completeTimerRef.current) clearTimeout(completeTimerRef.current);
    };
  }, [isActive, actualDuration]);

  return (
    <AnimatePresence>
      {isActive && (
        prefersReducedMotion ? (
          <SimpleFadeOverlay
            color={color}
            duration={actualDuration}
            zIndex={zIndex}
          />
        ) : (
          <StingerOverlay
            type={type}
            color={color}
            duration={actualDuration}
            zIndex={zIndex}
          />
        )
      )}
    </AnimatePresence>
  );
}

/**
 * Simple fade overlay for reduced-motion preference.
 */
function SimpleFadeOverlay({
  color,
  duration,
  zIndex,
}: {
  color: string;
  duration: number;
  zIndex: number;
}) {
  return (
    <motion.div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        backgroundColor: color,
        zIndex,
        pointerEvents: 'none',
      }}
      initial={{ opacity: 0 }}
      animate={{ opacity: [0, 0.8, 0.8, 0] }}
      exit={{ opacity: 0 }}
      transition={{
        duration,
        times: [0, 0.4, 0.6, 1],
        ease: 'easeInOut',
      }}
    />
  );
}

interface StingerOverlayProps {
  type: StingerType;
  color: string;
  duration: number;
  zIndex: number;
}

function StingerOverlay({
  type,
  color,
  duration,
  zIndex,
}: StingerOverlayProps) {
  switch (type) {
    case 'swoosh':
      return (
        <SwooshStinger
          color={color}
          duration={duration}
          zIndex={zIndex}
        />
      );
    case 'radial':
      return (
        <RadialStinger
          color={color}
          duration={duration}
          zIndex={zIndex}
        />
      );
    case 'diamond':
      return (
        <DiamondStinger
          color={color}
          duration={duration}
          zIndex={zIndex}
        />
      );
    case 'curtain':
      return (
        <CurtainStinger
          color={color}
          duration={duration}
          zIndex={zIndex}
        />
      );
    case 'burst':
      return (
        <BurstStinger
          color={color}
          duration={duration}
          zIndex={zIndex}
        />
      );
    default:
      return null;
  }
}

// Base overlay styles
const overlayBase: CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  width: '100%',
  height: '100%',
  pointerEvents: 'none',
  overflow: 'hidden',
};

interface StingerProps {
  color: string;
  duration: number;
  zIndex: number;
}

/**
 * Swoosh stinger: Multiple horizontal bars sweep across the screen.
 * Classic game-show style transition.
 */
function SwooshStinger({ color, duration, zIndex }: StingerProps) {
  const barCount = 5;
  const barDelay = 0.03;

  return (
    <motion.div
      style={{ ...overlayBase, zIndex }}
      initial={{ opacity: 1 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.1, delay: duration }}
    >
      {Array.from({ length: barCount }).map((_, i) => (
        <motion.div
          key={i}
          style={{
            position: 'absolute',
            top: `${(i / barCount) * 100}%`,
            left: 0,
            width: '100%',
            height: `${100 / barCount + 1}%`,
            backgroundColor: i % 2 === 0 ? color : adjustColor(color, 20),
            transformOrigin: 'left center',
          }}
          initial={{ scaleX: 0 }}
          animate={{
            scaleX: [0, 1, 1, 0],
            originX: [0, 0, 1, 1],
          }}
          transition={{
            duration: duration,
            delay: i * barDelay,
            times: [0, 0.45, 0.55, 1],
            ease: [0.4, 0, 0.2, 1],
          }}
        />
      ))}
      {/* Accent line */}
      <motion.div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: `linear-gradient(90deg, transparent 0%, ${adjustColor(color, 40)} 50%, transparent 100%)`,
          opacity: 0.6,
        }}
        initial={{ x: '-100%' }}
        animate={{ x: '100%' }}
        transition={{ duration: duration * 0.8, ease: 'easeInOut' }}
      />
    </motion.div>
  );
}

/**
 * Radial stinger: Circle expands from center, then contracts.
 */
function RadialStinger({ color, duration, zIndex }: StingerProps) {
  return (
    <motion.div
      style={{ ...overlayBase, zIndex }}
    >
      <motion.div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: '300vmax',
          height: '300vmax',
          borderRadius: '50%',
          backgroundColor: color,
          transform: 'translate(-50%, -50%)',
        }}
        initial={{ scale: 0 }}
        animate={{ scale: [0, 1, 1, 0] }}
        transition={{
          duration: duration,
          times: [0, 0.45, 0.55, 1],
          ease: [0.4, 0, 0.2, 1],
        }}
      />
      {/* Inner accent circle */}
      <motion.div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: '280vmax',
          height: '280vmax',
          borderRadius: '50%',
          border: `4px solid ${adjustColor(color, 30)}`,
          backgroundColor: 'transparent',
          transform: 'translate(-50%, -50%)',
        }}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: [0, 1.1, 1, 0], opacity: [0, 1, 1, 0] }}
        transition={{
          duration: duration,
          times: [0, 0.4, 0.6, 1],
          ease: 'easeOut',
        }}
      />
    </motion.div>
  );
}

/**
 * Diamond stinger: Diamond shape expands then retracts.
 * Energetic, game-show feel.
 */
function DiamondStinger({ color, duration, zIndex }: StingerProps) {
  return (
    <motion.div
      style={{ ...overlayBase, zIndex }}
    >
      <motion.div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: '300vmax',
          height: '300vmax',
          backgroundColor: color,
          transform: 'translate(-50%, -50%) rotate(45deg)',
        }}
        initial={{ scale: 0 }}
        animate={{ scale: [0, 1.2, 1.2, 0] }}
        transition={{
          duration: duration,
          times: [0, 0.4, 0.6, 1],
          ease: [0.4, 0, 0.2, 1],
        }}
      />
      {/* Inner glow */}
      <motion.div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: '250vmax',
          height: '250vmax',
          backgroundColor: adjustColor(color, 20),
          transform: 'translate(-50%, -50%) rotate(45deg)',
        }}
        initial={{ scale: 0 }}
        animate={{ scale: [0, 1.2, 1.2, 0] }}
        transition={{
          duration: duration,
          times: [0, 0.42, 0.58, 1],
          ease: [0.4, 0, 0.2, 1],
        }}
      />
      {/* Sparkle effects */}
      {[0, 90, 180, 270].map((angle) => (
        <motion.div
          key={angle}
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            width: '20px',
            height: '20px',
            backgroundColor: adjustColor(color, 50),
            borderRadius: '2px',
            transform: 'translate(-50%, -50%) rotate(45deg)',
          }}
          initial={{ scale: 0, x: 0, y: 0 }}
          animate={{
            scale: [0, 1.5, 0],
            x: [0, Math.cos((angle * Math.PI) / 180) * 150, Math.cos((angle * Math.PI) / 180) * 300],
            y: [0, Math.sin((angle * Math.PI) / 180) * 150, Math.sin((angle * Math.PI) / 180) * 300],
          }}
          transition={{
            duration: duration * 0.6,
            delay: duration * 0.2,
            ease: 'easeOut',
          }}
        />
      ))}
    </motion.div>
  );
}

/**
 * Curtain stinger: Vertical curtains close from sides, then open.
 * Classic theatrical feel.
 */
function CurtainStinger({ color, duration, zIndex }: StingerProps) {
  return (
    <motion.div
      style={{ ...overlayBase, zIndex }}
    >
      {/* Left curtain */}
      <motion.div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '50%',
          height: '100%',
          backgroundColor: color,
          transformOrigin: 'left center',
        }}
        initial={{ scaleX: 0 }}
        animate={{ scaleX: [0, 1, 1, 0] }}
        transition={{
          duration: duration,
          times: [0, 0.45, 0.55, 1],
          ease: [0.4, 0, 0.2, 1],
        }}
      />
      {/* Right curtain */}
      <motion.div
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          width: '50%',
          height: '100%',
          backgroundColor: color,
          transformOrigin: 'right center',
        }}
        initial={{ scaleX: 0 }}
        animate={{ scaleX: [0, 1, 1, 0] }}
        transition={{
          duration: duration,
          times: [0, 0.45, 0.55, 1],
          ease: [0.4, 0, 0.2, 1],
        }}
      />
      {/* Center line accent */}
      <motion.div
        style={{
          position: 'absolute',
          top: 0,
          left: '50%',
          width: '4px',
          height: '100%',
          backgroundColor: adjustColor(color, 40),
          transform: 'translateX(-50%)',
        }}
        initial={{ scaleY: 0 }}
        animate={{ scaleY: [0, 1, 1, 0] }}
        transition={{
          duration: duration * 0.8,
          delay: duration * 0.1,
          times: [0, 0.4, 0.6, 1],
          ease: 'easeInOut',
        }}
      />
    </motion.div>
  );
}

/**
 * Burst stinger: Explosive burst from center with particles.
 * Dramatic reveal effect, good for score reveals.
 */
function BurstStinger({ color, duration, zIndex }: StingerProps) {
  // Create burst particles radiating outward
  const particleCount = 12;
  const particles = Array.from({ length: particleCount }, (_, i) => {
    const angle = (i / particleCount) * 360;
    return { angle, delay: Math.random() * 0.1 };
  });

  return (
    <motion.div
      style={{ ...overlayBase, zIndex, overflow: 'hidden' }}
    >
      {/* Central expanding circle that covers screen */}
      <motion.div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: '300vmax',
          height: '300vmax',
          borderRadius: '50%',
          backgroundColor: color,
          transform: 'translate(-50%, -50%)',
        }}
        initial={{ scale: 0 }}
        animate={{ scale: [0, 1, 1, 0] }}
        transition={{
          duration: duration,
          times: [0, 0.4, 0.6, 1],
          ease: [0.16, 1, 0.3, 1],
        }}
      />
      {/* Inner glow ring */}
      <motion.div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: '200vmax',
          height: '200vmax',
          borderRadius: '50%',
          backgroundColor: adjustColor(color, 30),
          transform: 'translate(-50%, -50%)',
        }}
        initial={{ scale: 0 }}
        animate={{ scale: [0, 1, 1, 0] }}
        transition={{
          duration: duration * 0.95,
          delay: duration * 0.05,
          times: [0, 0.4, 0.6, 1],
          ease: [0.16, 1, 0.3, 1],
        }}
      />
      {/* Burst particles */}
      {particles.map(({ angle, delay }, i) => (
        <motion.div
          key={i}
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            width: '30px',
            height: '30px',
            backgroundColor: adjustColor(color, 60),
            borderRadius: '4px',
            transform: `translate(-50%, -50%) rotate(${angle}deg)`,
          }}
          initial={{ scale: 0, x: 0, y: 0 }}
          animate={{
            scale: [0, 1.5, 1, 0],
            x: [0, Math.cos((angle * Math.PI) / 180) * 200, Math.cos((angle * Math.PI) / 180) * 400],
            y: [0, Math.sin((angle * Math.PI) / 180) * 200, Math.sin((angle * Math.PI) / 180) * 400],
          }}
          transition={{
            duration: duration * 0.8,
            delay: delay,
            ease: 'easeOut',
          }}
        />
      ))}
      {/* Center flash */}
      <motion.div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: '100px',
          height: '100px',
          borderRadius: '50%',
          backgroundColor: '#fff',
          transform: 'translate(-50%, -50%)',
          boxShadow: `0 0 60px 30px ${adjustColor(color, 80)}`,
        }}
        initial={{ scale: 0, opacity: 1 }}
        animate={{ scale: [0, 3, 0], opacity: [1, 1, 0] }}
        transition={{
          duration: duration * 0.5,
          ease: 'easeOut',
        }}
      />
    </motion.div>
  );
}

/**
 * Adjust a hex color's brightness.
 * Positive amount lightens, negative darkens.
 */
function adjustColor(hex: string, amount: number): string {
  const cleanHex = hex.replace('#', '');
  const num = parseInt(cleanHex, 16);
  
  const r = Math.min(255, Math.max(0, (num >> 16) + amount));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00ff) + amount));
  const b = Math.min(255, Math.max(0, (num & 0x0000ff) + amount));
  
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

/**
 * Stinger configurations for different phase transitions.
 * Maps from->to phase transitions to specific stinger types and colors.
 */
export const transitionStingers: Record<string, { type: StingerType; color: string }> = {
  'lobby->submission': { type: 'swoosh', color: '#5865F2' },
  'submission->guessing': { type: 'diamond', color: '#EB459E' },
  'guessing->guessing': { type: 'radial', color: '#57F287' }, // Between rounds
  'guessing->endgame': { type: 'curtain', color: '#FEE75C' },
  'endgame->lobby': { type: 'swoosh', color: '#5865F2' },
};

/**
 * Get the stinger config for a phase transition.
 */
export function getStingerConfig(fromPhase: string, toPhase: string): { type: StingerType; color: string } {
  const key = `${fromPhase}->${toPhase}`;
  return transitionStingers[key] ?? { type: 'swoosh', color: '#5865F2' };
}

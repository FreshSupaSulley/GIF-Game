import { useCallback, useMemo, useRef, useEffect, useState } from 'react';
import { Particles } from '@tsparticles/react';
import type { Container, ISourceOptions } from '@tsparticles/engine';
import type { GamePhase } from '@gif-game/shared';
import { useReducedMotion } from '../hooks';

interface ParticleBackgroundProps {
  phase: GamePhase | null;
  /** Whether to show particles (e.g., only after fully connected) */
  visible?: boolean;
}

/**
 * Full-screen particle background that changes theme based on game phase.
 * Creates a Jackbox-style ambient atmosphere behind all game content.
 * 
 * Features:
 * - No mouse interactivity (particles ignore cursor)
 * - Center transparency gradient so content stands out
 * - Respects prefers-reduced-motion
 * - Low FPS limit to prevent acceleration issues in iframes
 */
export function ParticleBackground({ phase, visible = true }: ParticleBackgroundProps) {
  const prefersReducedMotion = useReducedMotion();
  const containerRef = useRef<Container | null>(null);
  const [isPageVisible, setIsPageVisible] = useState(!document.hidden);
  
  const particlesLoaded = useCallback(async (container: Container | undefined) => {
    containerRef.current = container ?? null;
  }, []);

  // Handle visibility changes - completely destroy and recreate particles
  // This is more reliable than pause/play for iframe contexts
  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsPageVisible(!document.hidden);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // Get particle config based on current phase
  const options = useMemo(() => getParticleConfig(phase ?? 'lobby'), [phase]);

  // Don't render if not visible OR if page is hidden
  if (!visible || !isPageVisible) {
    return (
      // Show static gradient when particles are hidden
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          zIndex: -1,
          background: `linear-gradient(135deg, ${getPhaseGradient(phase ?? 'lobby').join(', ')})`,
          opacity: 0.15,
        }}
      />
    );
  }

  // Show static gradient for reduced-motion users
  if (prefersReducedMotion) {
    const gradientColors = getPhaseGradient(phase ?? 'lobby');
    return (
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          zIndex: -1,
          background: `linear-gradient(135deg, ${gradientColors.join(', ')})`,
          opacity: 0.3,
        }}
      />
    );
  }

  return (
    <>
      {/* Force remount on phase change to reset delta time */}
      <Particles
        key={`particles-${phase}`}
        id="particle-background"
        particlesLoaded={particlesLoaded}
        options={options}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          zIndex: -1,
          pointerEvents: 'none',
        }}
      />
      {/* Center transparency gradient overlay */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          zIndex: -1,
          pointerEvents: 'none',
          background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0) 70%)',
        }}
      />
    </>
  );
}

/**
 * Get gradient colors for static background (reduced-motion fallback).
 */
function getPhaseGradient(phase: GamePhase): string[] {
  switch (phase) {
    case 'lobby':
      return ['#5865F2', '#7289DA', '#9B84EE'];
    case 'submission':
      return ['#5865F2', '#FAA61A', '#F47B67'];
    case 'guessing':
      return ['#5865F2', '#EB459E', '#57F287'];
    case 'endgame':
      return ['#FFD700', '#FFA500', '#57F287'];
    default:
      return ['#5865F2', '#7289DA', '#9B84EE'];
  }
}

/**
 * Get particle configuration for a specific game phase.
 * All configs have NO interactivity (particles ignore mouse).
 */
function getParticleConfig(phase: GamePhase): ISourceOptions {
  switch (phase) {
    case 'lobby':
      return lobbyConfig;
    case 'submission':
      return submissionConfig;
    case 'guessing':
      return guessingConfig;
    case 'endgame':
      return endgameConfig;
    default:
      return lobbyConfig;
  }
}

/**
 * Base interactivity config - NO mouse interaction.
 */
const noInteractivity = {
  detectsOn: 'window' as const,
  events: {
    onHover: { enable: false },
    onClick: { enable: false },
  },
};

/**
 * Lobby theme: Calm, ambient floating particles
 * Soft purples and blues matching Discord aesthetic
 */
const lobbyConfig: ISourceOptions = {
  fullScreen: false,
  fpsLimit: 30, // Lower FPS to reduce acceleration issues
  smooth: true,
  detectRetina: true,
  pauseOnBlur: true,
  pauseOnOutsideViewport: true,
  background: { color: 'transparent' },
  particles: {
    number: {
      value: 40, // Fewer particles
      density: { enable: true, width: 800, height: 800 },
    },
    color: {
      value: ['#5865F2', '#7289DA', '#9B84EE', '#EB459E', '#3BA55C'],
    },
    shape: { type: 'circle' },
    opacity: {
      value: { min: 0.1, max: 0.4 },
    },
    size: {
      value: { min: 2, max: 5 },
    },
    collisions: {
      enable: false,
    },
    move: {
      enable: true,
      speed: 0.3, // Much slower
      direction: 'none',
      random: true,
      straight: false,
      outModes: { default: 'out' },
    },
    links: {
      enable: true,
      distance: 150,
      color: '#5865F2',
      opacity: 0.15,
      width: 1,
    },
  },
  interactivity: noInteractivity,
};

/**
 * Submission theme: Focused, searching energy
 * Warmer colors (oranges, yellows mixed with purples)
 */
const submissionConfig: ISourceOptions = {
  fullScreen: false,
  fpsLimit: 30,
  smooth: true,
  detectRetina: true,
  pauseOnBlur: true,
  pauseOnOutsideViewport: true,
  background: { color: 'transparent' },
  particles: {
    number: {
      value: 45,
      density: { enable: true, width: 800, height: 800 },
    },
    color: {
      value: ['#5865F2', '#9B84EE', '#FAA61A', '#F47B67', '#FEE75C'],
    },
    shape: { type: 'circle' },
    opacity: {
      value: { min: 0.15, max: 0.5 },
    },
    size: {
      value: { min: 2, max: 4 },
    },
    collisions: {
      enable: false,
    },
    move: {
      enable: true,
      speed: 0.5,
      direction: 'none',
      random: true,
      straight: false,
      outModes: { default: 'out' },
    },
    links: { enable: false },
  },
  interactivity: noInteractivity,
};

/**
 * Guessing theme: High energy, competitive atmosphere
 * Fast-moving particles with bright, vibrant colors
 */
const guessingConfig: ISourceOptions = {
  fullScreen: false,
  fpsLimit: 30,
  smooth: true,
  detectRetina: true,
  pauseOnBlur: true,
  pauseOnOutsideViewport: true,
  background: { color: 'transparent' },
  particles: {
    number: {
      value: 50,
      density: { enable: true, width: 800, height: 800 },
    },
    color: {
      value: ['#5865F2', '#EB459E', '#57F287', '#FEE75C', '#ED4245'],
    },
    shape: { type: ['circle', 'star'] },
    opacity: {
      value: { min: 0.2, max: 0.6 },
    },
    size: {
      value: { min: 2, max: 5 },
    },
    collisions: {
      enable: false,
    },
    move: {
      enable: true,
      speed: 0.8,
      direction: 'none',
      random: true,
      straight: false,
      outModes: { default: 'out' },
    },
    links: { enable: false },
    rotate: {
      value: { min: 0, max: 360 },
      direction: 'random',
      animation: { enable: true, speed: 2 },
    },
  },
  interactivity: noInteractivity,
};

/**
 * Endgame theme: Celebration mode!
 * Confetti-style particles with gold, victory colors
 * Very slow to prevent acceleration issues
 */
const endgameConfig: ISourceOptions = {
  fullScreen: false,
  fpsLimit: 20, // Very low FPS to prevent acceleration
  smooth: true,
  detectRetina: true,
  pauseOnBlur: true,
  pauseOnOutsideViewport: true,
  background: { color: 'transparent' },
  particles: {
    number: {
      value: 40,
      density: { enable: true, width: 800, height: 800 },
    },
    color: {
      value: ['#FFD700', '#FFA500', '#57F287', '#5865F2', '#EB459E', '#ED4245'],
    },
    shape: { type: ['circle', 'square'] },
    opacity: {
      value: 0.5,
    },
    size: {
      value: { min: 4, max: 8 },
    },
    collisions: {
      enable: false,
    },
    move: {
      enable: true,
      speed: 0.3, // Very slow
      direction: 'bottom',
      random: true,
      straight: false,
      outModes: { default: 'out' },
    },
    links: { enable: false },
  },
  interactivity: noInteractivity,
};

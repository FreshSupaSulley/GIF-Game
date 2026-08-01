import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Particles } from '@tsparticles/react';
import type { Container, ISourceOptions } from '@tsparticles/engine';
import { motion } from 'motion/react';

interface ScoreRevealBackgroundProps {
  visible?: boolean;
  score?: number;
}

/**
 * Score reveal background with rising sparkle particles on the edges.
 * Uses tsParticles for smooth, performant animations.
 * Keeps the center clear for content.
 */
export function ScoreRevealBackground({ visible = true, score = 0 }: ScoreRevealBackgroundProps) {
  const containerRef = useRef<Container | null>(null);
  const [isPageVisible, setIsPageVisible] = useState(!document.hidden);
  
  const particlesLoaded = useCallback(async (container: Container | undefined) => {
    containerRef.current = container ?? null;
  }, []);

  // Handle visibility changes
  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsPageVisible(!document.hidden);
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // Determine theme based on score
  const isGoodScore = score > 50;
  
  const options: ISourceOptions = useMemo(() => ({
    fullScreen: false,
    fpsLimit: 30,
    detectRetina: true,
    particles: {
      number: {
        value: 40,
        density: {
          enable: true,
          width: 1200,
          height: 800,
        },
      },
      color: {
        value: isGoodScore 
          ? ['#FAA61A', '#FFD700', '#57F287', '#FFEC8B']
          : ['#5865F2', '#7289DA', '#9B84EE', '#B9BBBE'],
      },
      shape: {
        type: 'star',
        options: {
          star: {
            sides: 4,
          },
        },
      },
      opacity: {
        value: { min: 0.3, max: 0.7 },
        animation: {
          enable: true,
          speed: 0.5,
          sync: false,
        },
      },
      size: {
        value: { min: 2, max: 6 },
        animation: {
          enable: true,
          speed: 2,
          sync: false,
        },
      },
      move: {
        enable: true,
        speed: { min: 0.5, max: 1.5 },
        direction: 'top' as const,
        random: true,
        straight: false,
        outModes: {
          default: 'out' as const,
          top: 'out' as const,
          bottom: 'out' as const,
        },
      },
      // Spawn particles on edges only
      position: {
        x: { min: 0, max: 100 },
        y: { min: 70, max: 100 },
      },
      twinkle: {
        particles: {
          enable: true,
          frequency: 0.05,
          opacity: 1,
        },
      },
      collisions: {
        enable: false,
      },
    },
    interactivity: {
      events: {
        onHover: { enable: false },
        onClick: { enable: false },
      },
    },
    emitters: [
      // Left edge emitter
      {
        position: { x: 5, y: 50 },
        size: { width: 5, height: 80 },
        rate: { quantity: 2, delay: 0.5 },
        particles: {
          move: {
            direction: 'top-right' as const,
            speed: { min: 0.5, max: 1.5 },
          },
        },
      },
      // Right edge emitter
      {
        position: { x: 95, y: 50 },
        size: { width: 5, height: 80 },
        rate: { quantity: 2, delay: 0.5 },
        particles: {
          move: {
            direction: 'top-left' as const,
            speed: { min: 0.5, max: 1.5 },
          },
        },
      },
      // Bottom edge emitter
      {
        position: { x: 50, y: 95 },
        size: { width: 80, height: 5 },
        rate: { quantity: 3, delay: 0.4 },
        particles: {
          move: {
            direction: 'top' as const,
            speed: { min: 0.8, max: 2 },
          },
        },
      },
    ],
    background: {
      color: 'transparent',
    },
  }), [isGoodScore]);

  // Colors for overlays
  const primaryColor = isGoodScore ? '#FAA61A' : '#5865F2';
  const glowColor = isGoodScore ? 'rgba(250, 166, 26, 0.15)' : 'rgba(88, 101, 242, 0.15)';

  if (!visible || !isPageVisible) {
    return null;
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: -1,
        overflow: 'hidden',
        pointerEvents: 'none',
      }}
    >
      {/* Subtle radial gradient in center */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: `radial-gradient(ellipse at center, ${glowColor} 0%, transparent 60%)`,
        }}
      />

      {/* Edge glow bars */}
      <motion.div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: '3px',
          height: '100%',
          background: `linear-gradient(to bottom, transparent 10%, ${primaryColor}50 50%, transparent 90%)`,
        }}
        animate={{ opacity: [0.4, 0.8, 0.4] }}
        transition={{ duration: 2, repeat: Infinity }}
      />
      <motion.div
        style={{
          position: 'absolute',
          right: 0,
          top: 0,
          width: '3px',
          height: '100%',
          background: `linear-gradient(to bottom, transparent 10%, ${primaryColor}50 50%, transparent 90%)`,
        }}
        animate={{ opacity: [0.4, 0.8, 0.4] }}
        transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
      />

      {/* Particles */}
      <Particles
        id="score-reveal-particles"
        particlesLoaded={particlesLoaded}
        options={options}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
        }}
      />

      {/* Center fade for content readability */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '60%',
          height: '60%',
          background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.4) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />
    </div>
  );
}

import { useEffect, useState } from 'react';
import { motion } from 'motion/react';

// Celebration emojis that float and bounce
const CELEBRATION_EMOJIS = ['🏆', '⭐', '👏', '🎉', '🌟', '✨', '🥇', '👑'];

interface CelebrationItem {
  id: number;
  emoji: string;
  x: number; // percentage
  y: number; // percentage
  size: number;
  delay: number;
  duration: number;
}

interface CelebrationBackgroundProps {
  visible?: boolean;
  itemCount?: number;
}

/**
 * Celebration background for the winners screen.
 * Shows floating/pulsing emojis like trophies, stars, clapping hands.
 * Non-falling, creates a festive atmosphere.
 */
export function CelebrationBackground({
  visible = true,
  itemCount = 20,
}: CelebrationBackgroundProps) {
  const [items, setItems] = useState<CelebrationItem[]>([]);

  useEffect(() => {
    if (!visible) return;

    const newItems: CelebrationItem[] = [];
    for (let i = 0; i < itemCount; i++) {
      // Position emojis on edges (left, right, bottom) - avoid center
      // Distribute roughly: 35% left edge, 35% right edge, 30% bottom edge
      const edgeRoll = Math.random();
      let x: number;
      let y: number;
      
      if (edgeRoll < 0.35) {
        // Left edge: x from 0-15%, y anywhere
        x = Math.random() * 15;
        y = Math.random() * 100;
      } else if (edgeRoll < 0.70) {
        // Right edge: x from 85-100%, y anywhere
        x = 85 + Math.random() * 15;
        y = Math.random() * 100;
      } else {
        // Bottom edge: x anywhere, y from 75-100%
        x = Math.random() * 100;
        y = 75 + Math.random() * 25;
      }
      
      newItems.push({
        id: i,
        emoji: CELEBRATION_EMOJIS[Math.floor(Math.random() * CELEBRATION_EMOJIS.length)],
        x,
        y,
        size: 30 + Math.random() * 40, // 30-70px
        delay: Math.random() * 2, // 0-2s delay
        duration: 2 + Math.random() * 2, // 2-4s animation duration
      });
    }
    setItems(newItems);
  }, [visible, itemCount]);

  if (!visible) {
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
      {/* Gradient background */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: 'radial-gradient(ellipse at center, rgba(250, 166, 26, 0.15) 0%, rgba(0, 0, 0, 0) 70%)',
        }}
      />

      {/* Floating celebration items */}
      {items.map((item) => (
        <motion.div
          key={item.id}
          style={{
            position: 'absolute',
            left: `${item.x}%`,
            top: `${item.y}%`,
            fontSize: item.size,
            opacity: 0.6,
            filter: 'drop-shadow(0 0 10px rgba(255, 215, 0, 0.5))',
          }}
          initial={{ scale: 0, rotate: -20 }}
          animate={{
            scale: [0.8, 1.2, 0.8],
            rotate: [-10, 10, -10],
            y: [-10, 10, -10],
          }}
          transition={{
            duration: item.duration,
            delay: item.delay,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        >
          {item.emoji}
        </motion.div>
      ))}

      {/* Sparkle bursts on edges */}
      <SparkleCluster x={8} y={20} delay={0} />
      <SparkleCluster x={92} y={15} delay={0.5} />
      <SparkleCluster x={12} y={80} delay={1} />
      <SparkleCluster x={88} y={75} delay={1.5} />
      <SparkleCluster x={5} y={50} delay={0.3} />
      <SparkleCluster x={95} y={45} delay={0.8} />
    </div>
  );
}

/**
 * A cluster of sparkles that pulse together
 */
function SparkleCluster({ x, y, delay }: { x: number; y: number; delay: number }) {
  return (
    <motion.div
      style={{
        position: 'absolute',
        left: `${x}%`,
        top: `${y}%`,
        transform: 'translate(-50%, -50%)',
      }}
      initial={{ opacity: 0, scale: 0 }}
      animate={{
        opacity: [0, 1, 0],
        scale: [0.5, 1.5, 0.5],
      }}
      transition={{
        duration: 2,
        delay,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
    >
      <div style={{ position: 'relative', width: 60, height: 60 }}>
        {/* Center star */}
        <motion.span
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            fontSize: 30,
          }}
          animate={{ rotate: 360 }}
          transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
        >
          ✨
        </motion.span>
        {/* Surrounding sparkles */}
        {[0, 60, 120, 180, 240, 300].map((angle, i) => (
          <motion.span
            key={angle}
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              fontSize: 16,
              transform: `translate(-50%, -50%) rotate(${angle}deg) translateY(-25px)`,
            }}
            animate={{
              opacity: [0.3, 1, 0.3],
            }}
            transition={{
              duration: 1,
              delay: delay + i * 0.1,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          >
            ⭐
          </motion.span>
        ))}
      </div>
    </motion.div>
  );
}

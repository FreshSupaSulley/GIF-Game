import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { proxyGifUrl } from '../utils';

// Sample GIF URLs for the background - fun, recognizable GIFs
const SAMPLE_GIFS = [
  'https://media.giphy.com/media/JIX9t2j0ZTN9S/giphy.gif', // Cat typing
  'https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif', // This is fine
  'https://media.giphy.com/media/3o7TKSjRrfIPjeiVyM/giphy.gif', // Mind blown
  'https://media.giphy.com/media/l41lGvinEgARjB2HC/giphy.gif', // Dancing
  'https://media.giphy.com/media/xT9IgG50Fb7Mi0prBC/giphy.gif', // Applause
  'https://media.giphy.com/media/5VKbvrjxpVJCM/giphy.gif', // Thumbs up
  'https://media.giphy.com/media/QMHoU66sBXqqLqYvGO/giphy.gif', // Wow
  'https://media.giphy.com/media/l0HlvtIPzPdt2usKs/giphy.gif', // Excited
  'https://media.giphy.com/media/3oEjI6SIIHBdRxXI40/giphy.gif', // Thinking
  'https://media.giphy.com/media/xUPGGDNsLvqsBOhuU0/giphy.gif', // Laughing
  'https://media.giphy.com/media/l3q2K5jinAlChoCLS/giphy.gif', // Cool
  'https://media.giphy.com/media/3o7abKhOpu0NwenH3O/giphy.gif', // Party
];

interface ScrollingGif {
  id: number;
  url: string;
  yPosition: number; // Percentage from top (0-100)
  size: number;
  duration: number;
  delay: number;
  direction: 'left' | 'right';
}

interface ScrollingGifsBackgroundProps {
  /** Whether to show the background */
  visible?: boolean;
  /** Number of GIFs to show */
  gifCount?: number;
  /** Opacity of the GIFs */
  opacity?: number;
}

/**
 * Background with GIFs scrolling horizontally across the screen.
 * Creates a fun, dynamic lobby atmosphere.
 */
export function ScrollingGifsBackground({
  visible = true,
  gifCount = 15,
  opacity = 0.15,
}: ScrollingGifsBackgroundProps) {
  const [gifs, setGifs] = useState<ScrollingGif[]>([]);

  // Generate scrolling GIFs on mount
  useEffect(() => {
    if (!visible) return;

    const newGifs: ScrollingGif[] = [];

    for (let i = 0; i < gifCount; i++) {
      const gifUrl = SAMPLE_GIFS[Math.floor(Math.random() * SAMPLE_GIFS.length)];
      // Random Y position across the full screen height (-10% to 100% to cover edges)
      const yPosition = -10 + Math.random() * 110;
      
      newGifs.push({
        id: i,
        url: proxyGifUrl(gifUrl), // Use proxy for Discord iframe
        yPosition,
        size: 400 + Math.floor(Math.random() * 600), // 400-1000px (huge)
        duration: 25 + Math.random() * 20, // 25-45 seconds
        delay: Math.random() * -30, // Stagger start times across 30s
        direction: Math.random() > 0.5 ? 'left' : 'right',
      });
    }

    setGifs(newGifs);
  }, [visible, gifCount]);

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
      {/* Animated gradient background */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '300%',
          height: '300%',
          background: 'linear-gradient(45deg, #1a1a2e, #16213e, #0f3460, #1a1a2e, #2d1b4e, #1a1a2e)',
          backgroundSize: '400% 400%',
          animation: 'gradientShift 20s ease infinite',
          transform: 'translate(-25%, -25%)',
        }}
      />
      
      {/* Inject keyframes via style tag */}
      <style>{`
        @keyframes gradientShift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
      `}</style>

      {/* Dark gradient overlay for better content visibility */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.3) 70%)',
          zIndex: 1,
        }}
      />

      {/* Scrolling GIFs */}
      <div style={{ opacity, position: 'relative', width: '100%', height: '100%' }}>
        {gifs.map((gif) => (
          <motion.div
            key={gif.id}
            style={{
              position: 'absolute',
              top: `${gif.yPosition}%`,
              transform: 'translateY(-50%)',
              width: gif.size,
              height: gif.size,
              borderRadius: '8px',
              overflow: 'hidden',
            }}
            initial={{
              x: gif.direction === 'left' ? '100vw' : '-150px',
            }}
            animate={{
              x: gif.direction === 'left' ? '-200px' : '100vw',
            }}
            transition={{
              duration: gif.duration,
              delay: gif.delay,
              repeat: Infinity,
              ease: 'linear',
            }}
          >
            <img
              src={gif.url}
              alt=""
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                filter: 'grayscale(30%)',
              }}
              loading="lazy"
            />
          </motion.div>
        ))}
      </div>
    </div>
  );
}

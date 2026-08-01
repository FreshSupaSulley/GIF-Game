import { useState, useEffect } from 'react';

/**
 * Hook to detect user's reduced-motion preference.
 * Returns true if the user prefers reduced motion.
 * 
 * Use this to disable or simplify animations for accessibility.
 */
export function useReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() => {
    // Check on initial render (SSR-safe)
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

    const handleChange = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches);
    };

    // Add listener
    mediaQuery.addEventListener('change', handleChange);

    // Cleanup
    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, []);

  return prefersReducedMotion;
}

/**
 * Get simplified animation props for reduced-motion mode.
 * Returns empty objects that effectively disable animations.
 */
export function getReducedMotionProps() {
  return {
    initial: false,
    animate: {},
    exit: {},
    transition: { duration: 0 },
    whileHover: {},
    whileTap: {},
  };
}

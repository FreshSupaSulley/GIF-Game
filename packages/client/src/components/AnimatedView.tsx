import { motion, AnimatePresence, type Variants } from 'motion/react';
import type { ReactNode, CSSProperties } from 'react';

/**
 * Animation variants for view transitions.
 * Jackbox-style: bouncy scale with fade, snappy timing.
 */
export const viewVariants: Variants = {
  initial: {
    opacity: 0,
    scale: 0.95,
    y: 20,
  },
  animate: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      type: 'spring',
      stiffness: 300,
      damping: 25,
      mass: 0.8,
    },
  },
  exit: {
    opacity: 0,
    scale: 0.98,
    y: -10,
    transition: {
      duration: 0.15,
      ease: 'easeIn',
    },
  },
};

/**
 * Alternative variants for more dramatic entrances.
 */
export const dramaticVariants: Variants = {
  initial: {
    opacity: 0,
    scale: 0.8,
    rotateX: -10,
  },
  animate: {
    opacity: 1,
    scale: 1,
    rotateX: 0,
    transition: {
      type: 'spring',
      stiffness: 200,
      damping: 20,
      mass: 1,
    },
  },
  exit: {
    opacity: 0,
    scale: 1.05,
    transition: {
      duration: 0.2,
      ease: 'easeIn',
    },
  },
};

/**
 * Slide-in variants for side panels or modals.
 */
export const slideVariants: Variants = {
  initial: {
    opacity: 0,
    x: 50,
  },
  animate: {
    opacity: 1,
    x: 0,
    transition: {
      type: 'spring',
      stiffness: 400,
      damping: 30,
    },
  },
  exit: {
    opacity: 0,
    x: -50,
    transition: {
      duration: 0.15,
    },
  },
};

interface AnimatedViewProps {
  children: ReactNode;
  /** Unique key for AnimatePresence tracking */
  viewKey: string;
  /** Which animation variants to use */
  variants?: Variants;
  /** Additional styles for the container */
  style?: CSSProperties;
  /** Additional class name */
  className?: string;
}

/**
 * Wrapper component that provides smooth enter/exit animations for views.
 * Use this to wrap individual view components for transition effects.
 */
export function AnimatedView({
  children,
  viewKey,
  variants = viewVariants,
  style,
  className,
}: AnimatedViewProps) {
  return (
    <motion.div
      key={viewKey}
      initial="initial"
      animate="animate"
      exit="exit"
      variants={variants}
      style={{
        width: '100%',
        height: '100%',
        ...style,
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

interface AnimatedPresenceWrapperProps {
  children: ReactNode;
  /** Mode for AnimatePresence: 'wait' waits for exit before enter, 'sync' runs both together */
  mode?: 'wait' | 'sync' | 'popLayout';
}

/**
 * Wrapper for AnimatePresence to handle view switching with proper exit animations.
 * Place this around the view router/switch logic.
 */
export function AnimatedPresenceWrapper({
  children,
  mode = 'wait',
}: AnimatedPresenceWrapperProps) {
  return (
    <AnimatePresence mode={mode}>
      {children}
    </AnimatePresence>
  );
}

/**
 * Stagger container variants for animating lists of items.
 */
export const staggerContainerVariants: Variants = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1,
    },
  },
  exit: {
    transition: {
      staggerChildren: 0.03,
      staggerDirection: -1,
    },
  },
};

/**
 * Individual item variants for use within stagger containers.
 */
export const staggerItemVariants: Variants = {
  initial: {
    opacity: 0,
    y: 20,
    scale: 0.95,
  },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: 'spring',
      stiffness: 400,
      damping: 25,
    },
  },
  exit: {
    opacity: 0,
    y: -10,
    scale: 0.95,
    transition: {
      duration: 0.1,
    },
  },
};

/**
 * Pop-in variants for elements that should "pop" into view (scores, badges).
 */
export const popVariants: Variants = {
  initial: {
    opacity: 0,
    scale: 0,
  },
  animate: {
    opacity: 1,
    scale: 1,
    transition: {
      type: 'spring',
      stiffness: 500,
      damping: 15,
    },
  },
  exit: {
    opacity: 0,
    scale: 0,
    transition: {
      duration: 0.1,
    },
  },
};

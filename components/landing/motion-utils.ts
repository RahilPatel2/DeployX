import * as React from "react";
import { useReducedMotion, type Variants } from "framer-motion";

/**
 * Premium Animation & Motion Design Tokens for DeployX
 * Standardized easing curves, spring physics, and viewport triggers.
 */

// Custom cubic bezier easing curves
export const EASING = {
  smooth: [0.22, 1, 0.36, 1] as const, // Custom apple-style smooth ease-out
  expo: [0.16, 1, 0.3, 1] as const,   // Fast initial response with long settle
  bounce: [0.34, 1.56, 0.64, 1] as const, // Subtle tactile overshoot
  soft: [0.25, 0.1, 0.25, 1] as const,  // Natural smooth ease-in-out
};

// Common Spring Configurations
export const SPRINGS = {
  snappy: { type: "spring", stiffness: 400, damping: 28 },
  gentle: { type: "spring", stiffness: 220, damping: 24 },
  bouncy: { type: "spring", stiffness: 300, damping: 15 },
  subtle: { type: "spring", stiffness: 150, damping: 20 },
} as const;

// Viewport Trigger Options for Scroll-Triggered Animations
export const VIEWPORT_CONFIG = {
  once: true,
  margin: "-80px",
  amount: 0.15,
} as const;

/**
 * Staggered Container Variants
 */
export const containerStaggerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: (delay = 0.1) => ({
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: delay,
    },
  }),
};

export const slowStaggerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.14,
      delayChildren: 0.2,
    },
  },
};

/**
 * Scroll Entrance Variants
 */
export const fadeUpVariants: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.65,
      ease: EASING.smooth,
    },
  },
};

export const fadeInVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      duration: 0.6,
      ease: EASING.soft,
    },
  },
};

// Aliases for clean declarative composition
export const FADE_UP = fadeUpVariants;

export function containerStagger(staggerChildren: number = 0.08, delayChildren: number = 0.1): Variants {
  return {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren,
        delayChildren,
      },
    },
  };
}

export const slideInLeftVariants: Variants = {
  hidden: { opacity: 0, x: -32 },
  visible: {
    opacity: 1,
    x: 0,
    transition: {
      duration: 0.7,
      ease: EASING.expo,
    },
  },
};

export const slideInRightVariants: Variants = {
  hidden: { opacity: 0, x: 32 },
  visible: {
    opacity: 1,
    x: 0,
    transition: {
      duration: 0.7,
      ease: EASING.expo,
    },
  },
};

export const scaleInVariants: Variants = {
  hidden: { opacity: 0, scale: 0.94 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: {
      duration: 0.6,
      ease: EASING.smooth,
    },
  },
};

/**
 * Interactive Hover Motion Variants
 */
export const buttonHoverVariants = {
  initial: { scale: 1 },
  hover: {
    scale: 1.03,
    transition: SPRINGS.snappy,
  },
  tap: {
    scale: 0.97,
    transition: { duration: 0.1 },
  },
};

export const cardHoverVariants: Variants = {
  initial: { y: 0, scale: 1 },
  hover: {
    y: -4,
    scale: 1.008,
    transition: {
      duration: 0.3,
      ease: EASING.smooth,
    },
  },
};

export const iconHoverVariants: Variants = {
  initial: { scale: 1, rotate: 0 },
  hover: {
    scale: 1.15,
    rotate: 5,
    transition: SPRINGS.bouncy,
  },
};

const emptySubscribe = () => () => {};

/**
 * Hook to safely respect prefers-reduced-motion without hydration mismatch
 */
export function useSafeReducedMotion(): boolean {
  const prefersReduced = useReducedMotion();
  const isClient = React.useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  return isClient ? Boolean(prefersReduced) : false;
}

/**
 * 3D Perspective Card Tilt Calculator
 */
export function calculateCardTilt(
  e: React.MouseEvent<HTMLDivElement>,
  cardRect: DOMRect,
  intensity: number = 8
): { rotateX: number; rotateY: number } {
  const x = e.clientX - cardRect.left;
  const y = e.clientY - cardRect.top;
  const centerX = cardRect.width / 2;
  const centerY = cardRect.height / 2;

  const rotateX = ((y - centerY) / centerY) * -intensity;
  const rotateY = ((x - centerX) / centerX) * intensity;

  return { rotateX, rotateY };
}

/**
 * ABRN Drive — Luxury Fintech Motion Presets
 * Framer Motion spring physics configurations.
 *
 * Design principle: motion should feel physical — like objects with mass
 * responding to force. Springs, not linear timing, create the luxury feel.
 *
 * Usage:
 *   import { springs, transitions, variants } from '@/lib/motion-presets'
 *   <motion.div transition={springs.gentle} />
 *   <motion.div variants={variants.fadeInUp} initial="initial" animate="animate" />
 */

import type { Transition, Variants } from 'framer-motion'

/* ========== SPRING PHYSICS ========== */
/**
 * Spring presets — think of them as materials:
 * - gentle: silk curtain falling (low stiffness, moderate damping)
 * - snappy: high-end car door closing (high stiffness, precise damping)
 * - dramatic: champagne cork pop (high stiffness, low damping = overshoot)
 * - micro: watch hand ticking (very fast, no overshoot)
 */
export const springs = {
  gentle: {
    type: 'spring' as const,
    stiffness: 120,
    damping: 20,
    mass: 1,
  },
  snappy: {
    type: 'spring' as const,
    stiffness: 300,
    damping: 30,
    mass: 0.8,
  },
  dramatic: {
    type: 'spring' as const,
    stiffness: 400,
    damping: 15,
    mass: 1,
  },
  micro: {
    type: 'spring' as const,
    stiffness: 500,
    damping: 40,
    mass: 0.5,
  },
} as const satisfies Record<string, Transition>

/* ========== TWEEN PRESETS ========== */
/**
 * For animations where spring physics don't apply
 * (opacity fades, color transitions, etc.)
 */
export const tweens: Record<string, Transition> = {
  fast: {
    type: 'tween',
    duration: 0.15,
    ease: [0.16, 1, 0.3, 1], // ease-out-expo
  },
  normal: {
    type: 'tween',
    duration: 0.25,
    ease: [0.16, 1, 0.3, 1],
  },
  slow: {
    type: 'tween',
    duration: 0.4,
    ease: [0.4, 0, 0.2, 1], // ease-in-out-smooth
  },
}

/* ========== COMPOSITE TRANSITIONS ========== */
/**
 * Combine springs for layout + tweens for opacity.
 * This creates the "expensive" feel: position springs while opacity fades.
 */
export const transitions = {
  /** Card hover — gentle lift with opacity shift */
  cardHover: {
    y: springs.gentle,
    boxShadow: tweens.normal,
  },
  /** Modal entry — dramatic spring for scale, smooth fade for opacity */
  modalEntry: {
    scale: springs.dramatic,
    opacity: tweens.fast,
  },
  /** Modal exit — fast tween out, no spring bounce */
  modalExit: {
    scale: tweens.fast,
    opacity: tweens.fast,
  },
  /** Page transition — gentle crossfade with subtle slide */
  pageTransition: {
    x: springs.gentle,
    opacity: tweens.normal,
  },
  /** Stagger children — used with staggerChildren in parent */
  staggerParent: {
    staggerChildren: 0.06,
    delayChildren: 0.1,
  },
  /** Bulk action bar — slides up from bottom */
  slideUp: {
    y: springs.snappy,
    opacity: tweens.fast,
  },
} as const

/* ========== ANIMATION VARIANTS ========== */
/**
 * Reusable Framer Motion variants for common patterns.
 * Usage:
 *   <motion.div variants={variants.fadeInUp} initial="initial" animate="animate" />
 */
export const variants: Record<string, Variants> = {
  fadeInUp: {
    initial: { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0, transition: springs.gentle },
    exit: { opacity: 0, y: -8, transition: tweens.fast },
  },
  fadeInDown: {
    initial: { opacity: 0, y: -12 },
    animate: { opacity: 1, y: 0, transition: springs.gentle },
    exit: { opacity: 0, y: 8, transition: tweens.fast },
  },
  fadeIn: {
    initial: { opacity: 0 },
    animate: { opacity: 1, transition: tweens.normal },
    exit: { opacity: 0, transition: tweens.fast },
  },
  scaleIn: {
    initial: { opacity: 0, scale: 0.95 },
    animate: { opacity: 1, scale: 1, transition: springs.snappy },
    exit: { opacity: 0, scale: 0.95, transition: tweens.fast },
  },
  slideInRight: {
    initial: { opacity: 0, x: 20 },
    animate: { opacity: 1, x: 0, transition: springs.gentle },
    exit: { opacity: 0, x: -20, transition: tweens.fast },
  },
  slideInLeft: {
    initial: { opacity: 0, x: -20 },
    animate: { opacity: 1, x: 0, transition: springs.gentle },
    exit: { opacity: 0, x: 20, transition: tweens.fast },
  },
  slideUp: {
    initial: { opacity: 0, y: 24 },
    animate: { opacity: 1, y: 0, transition: springs.snappy },
    exit: { opacity: 0, y: 24, transition: tweens.fast },
  },
  staggerContainer: {
    initial: {},
    animate: {
      transition: {
        staggerChildren: 0.06,
        delayChildren: 0.1,
      },
    },
    exit: {
      transition: {
        staggerChildren: 0.03,
        staggerDirection: -1,
      },
    },
  },
  staggerChild: {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0, transition: springs.gentle },
    exit: { opacity: 0, y: -4, transition: tweens.fast },
  },
}

/* ========== HOVER/TAP PRESETS ========== */
/**
 * Interactive state presets for whileHover and whileTap.
 * Usage:
 *   <motion.button whileHover={hover.lift} whileTap={tap.press} />
 */
export const hover = {
  /** Subtle lift — for cards and containers */
  lift: { y: -2, transition: springs.micro },
  /** Gentle scale — for icons and badges */
  grow: { scale: 1.05, transition: springs.micro },
  /** Glow effect — pair with CSS shadow variable */
  glow: { scale: 1.01, transition: springs.micro },
} as const

export const tap = {
  /** Button press — scale down slightly */
  press: { scale: 0.97, transition: springs.micro },
  /** Deep press — for primary actions */
  deepPress: { scale: 0.95, transition: springs.micro },
} as const

/* ========== REDUCED MOTION ========== */
/**
 * Use this to conditionally disable animations.
 * Usage:
 *   const prefersReducedMotion = usePrefersReducedMotion()
 *   <motion.div animate={prefersReducedMotion ? {} : { y: 0 }} />
 */
export const reducedMotionVariants: Record<string, Variants> = {
  fadeInUp: {
    initial: { opacity: 0 },
    animate: { opacity: 1, transition: { duration: 0.01 } },
    exit: { opacity: 0, transition: { duration: 0.01 } },
  },
  scaleIn: {
    initial: { opacity: 0 },
    animate: { opacity: 1, transition: { duration: 0.01 } },
    exit: { opacity: 0, transition: { duration: 0.01 } },
  },
}

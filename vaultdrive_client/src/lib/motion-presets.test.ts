import { describe, it, expect } from 'vitest'
import { springs, tweens, variants, hover, tap, transitions, reducedMotionVariants } from './motion-presets'

describe('motion-presets', () => {
  it('exports spring presets with correct physics properties', () => {
    expect(springs.gentle).toHaveProperty('type', 'spring')
    expect(springs.gentle).toHaveProperty('stiffness')
    expect(springs.gentle).toHaveProperty('damping')
    expect(springs.snappy.stiffness).toBeGreaterThan(springs.gentle.stiffness)
    expect(springs.micro.damping).toBeGreaterThan(springs.dramatic.damping)
  })

  it('exports tween presets with duration and easing', () => {
    expect(tweens.fast).toHaveProperty('type', 'tween')
    expect(tweens.fast).toHaveProperty('duration')
    expect(tweens.fast).toHaveProperty('ease')
    expect((tweens.normal as { duration: number }).duration).toBeGreaterThan(
      (tweens.fast as { duration: number }).duration
    )
  })

  it('exports variant sets with initial/animate/exit states', () => {
    const requiredVariants = ['fadeInUp', 'fadeIn', 'scaleIn', 'slideUp', 'staggerContainer', 'staggerChild']
    for (const name of requiredVariants) {
      expect(variants).toHaveProperty(name)
      expect(variants[name]).toHaveProperty('initial')
      expect(variants[name]).toHaveProperty('animate')
    }
  })

  it('exports hover and tap presets for interactive states', () => {
    expect(hover.lift).toHaveProperty('y', -2)
    expect(hover.grow).toHaveProperty('scale', 1.05)
    expect(tap.press).toHaveProperty('scale', 0.97)
  })

  it('exports composite transitions for complex animations', () => {
    expect(transitions.cardHover).toHaveProperty('y')
    expect(transitions.modalEntry).toHaveProperty('scale')
    expect(transitions.staggerParent).toHaveProperty('staggerChildren')
  })

  it('exports reduced motion variants as graceful fallbacks', () => {
    expect(reducedMotionVariants.fadeInUp.animate).toHaveProperty('transition')
    const transition = (reducedMotionVariants.fadeInUp.animate as { transition: { duration: number } }).transition
    expect(transition.duration).toBeLessThanOrEqual(0.01)
  })
})

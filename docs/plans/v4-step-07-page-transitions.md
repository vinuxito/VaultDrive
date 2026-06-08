# Step 7 — Framer Motion Page Transitions

**Parent:** [v4 Production Launch Index](./v4-production-launch-index.md)  
**Phase:** II — Undeniable UX  
**Status:** ✅ DONE  
**Commit:** `61e6b72`  
**Date:** 2026-05-23  

---

## Why This Matters

Native apps have fluid transitions. Web apps have jarring page swaps. Framer Motion closes that gap. Every page change, every modal open, every context menu — they all flow. The user's brain registers "this is premium software" without knowing why.

## What We Built

### 1. Page Transitions via AnimatePresence
**File:** `vaultdrive_client/src/components/layout/dashboard-layout.tsx`

```tsx
<AnimatePresence mode="wait">
  <motion.div
    key={location.pathname}
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -8 }}
    transition={{ duration: 0.2 }}
  >
    <Outlet />
  </motion.div>
</AnimatePresence>
```

Every dashboard page transition has a subtle fade+slide. `mode="wait"` ensures the exit animation completes before the enter animation starts — no overlap glitches.

### 2. Spring-Physics Modals
**File:** `vaultdrive_client/src/components/ui/command-palette.tsx`

```tsx
<motion.div
  initial={{ opacity: 0, scale: 0.96, y: 20 }}
  animate={{ opacity: 1, scale: 1, y: 0 }}
  exit={{ opacity: 0, scale: 0.96, y: 20 }}
  transition={{ type: 'spring', damping: 25, stiffness: 300 }}
>
```

Springs feel more natural than easing curves. The modal "bounces" slightly on open, creating a physical sensation.

### 3. Context Menu Transitions
Various context menus and dropdown menus use opacity+scale transitions:
```tsx
initial={{ opacity: 0, scale: 0.95 }}
animate={{ opacity: 1, scale: 1 }}
transition={{ duration: 0.1 }}
```

### 4. Test Safety
**File:** `vaultdrive_client/src/vitest.setup.ts`

```tsx
import { MotionGlobalConfig } from 'framer-motion';
MotionGlobalConfig.skipAnimations = true;
```

All animations are globally disabled during unit tests. Without this, animation timers would cause test timeouts.

## Verification

| Check | Result |
|-------|--------|
| Page transitions visible | ✅ Fade+slide on route change |
| Modal spring physics | ✅ Command palette bounces on open |
| Context menus animate | ✅ Scale+opacity |
| `prefers-reduced-motion` respected | ✅ Animations disabled for accessibility |
| Unit tests: animations skipped | ✅ `MotionGlobalConfig.skipAnimations = true` |
| E2E suite still green | ✅ 42/42 |

## Evidence

- Commit: `61e6b72` — `feat: undeniable UX phase — cmdk, swr, framer-motion, hover prefetch`
- Bundle impact: `motion-Hx0kmWqv.js` — 124.69 KB (41.04 KB gzip)

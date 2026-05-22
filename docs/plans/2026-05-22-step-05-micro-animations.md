# Step 5 — Micro-Animations & Tactile Soul

**Parent:** [Hackathon Index](./2026-05-22-hackathon-index.md)  
**Priority:** 🟡 High  
**Effort:** M (1 day)  
**Status:** ⚡ PARTIAL — Button feedback done (`a4ac4eb`). Modals, toasts, theme transitions remain.

---

## Why This Matters

The difference between a good app and a *premium* app is tactile feedback. When a button presses, the user should feel it. When a modal opens, it should slide in, not jump in. When a card appears, it should breathe into existence. When a theme changes, it should flow, not snap.

QuantiX-Drive already pays the bundle cost for `framer-motion` (124 KB chunk). But the real leverage is in CSS — lighter, more universal, and composable with the existing theme system.

---

## What's Already Done

| Sub-step | Status | Commit |
|----------|--------|--------|
| Button press feedback (`active:scale(0.97)`) | ✅ Done | `a4ac4eb` |
| Staggered card animations | ✅ Done | `a4ac4eb` |
| Scroll-triggered reveal | ✅ Done | `aff37ae` |
| Modal slide-up animation | 🔲 TODO | — |
| Toast slide-in | 🔲 TODO | — |
| Card hover lift/glow | 🔲 TODO | — |
| Theme transition smoothing | 🔲 TODO | — |
| Reduced motion respect | 🔲 TODO | — |

---

## Implementation Plan (Remaining Items)

### 5.1 — Modal Slide-Up Animation

**File:** `vaultdrive_client/src/components/ui/dialog.tsx` (Radix wrapper)

Enhance the Radix Dialog overlay with CSS-driven enter animation. The current Radix default is a fade — we want a slide-up + scale that feels like the modal is *emerging* from the content:

```css
/* Dialog overlay */
[data-state="open"] > [role="dialog"] {
  animation: dialogSlideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes dialogSlideUp {
  from {
    opacity: 0;
    transform: translateY(16px) scale(0.97);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

/* Overlay backdrop */
[data-state="open"].dialog-overlay {
  animation: overlayFadeIn 0.2s ease-out;
}

@keyframes overlayFadeIn {
  from { opacity: 0; }
  to   { opacity: 1; }
}
```

**Cubic bezier `(0.16, 1, 0.3, 1)`** is Apple's spring-like easing — fast start, gentle overshoot, clean settle. It makes the modal feel *physical*.

### 5.2 — Toast Notification Slide-In

**File:** `vaultdrive_client/src/components/ui/sonner.tsx` (toast provider)

Configure Sonner toast entrance to slide from the bottom-right instead of popping in:

```css
[data-sonner-toast][data-mounted="true"] {
  animation: toastSlideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes toastSlideIn {
  from {
    opacity: 0;
    transform: translateY(100%) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

/* Exit animation */
[data-sonner-toast][data-removed="true"] {
  animation: toastSlideOut 0.2s ease-in forwards;
}

@keyframes toastSlideOut {
  to {
    opacity: 0;
    transform: translateX(100%);
  }
}
```

**Why it matters:** Toasts that pop in feel like system alerts. Toasts that slide in feel like *notifications from a premium app*.

### 5.3 — Card Hover Lift & Glow

**File:** `vaultdrive_client/src/styles/elegant-complete.css` (or `skins.css`)

Add a universal lift effect for interactive cards:

```css
.brand-glass-card {
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.brand-glass-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 30px rgba(0,0,0,0.12);
}

/* Dark theme variant: glow instead of shadow */
[data-theme="quantix"] .brand-glass-card:hover,
[data-theme="cyberpunk"] .brand-glass-card:hover {
  box-shadow: 0 0 20px hsl(var(--primary) / 0.15);
}
```

**Why it matters:** Cards that don't respond to hover feel like images. Cards that lift when approached feel like *objects*.

### 5.4 — Theme Transition Smoothing

**File:** `vaultdrive_client/src/styles/index.css` (global)

When the user switches themes (Settings → Theme picker), the color change should *flow* instead of snap:

```css
/* Scoped transitions — NOT a blanket * selector */
body,
.brand-glass-card,
.brand-sidebar,
.brand-header,
.brand-btn-primary,
[role="dialog"] {
  transition: background-color 0.3s ease, 
              border-color 0.2s ease, 
              color 0.2s ease,
              box-shadow 0.2s ease;
}
```

**Why NOT `*`:** A blanket `*` transition causes layout thrashing and janky scrolling. We scope to the 6 elements that matter visually — body, cards, sidebar, header, buttons, modals.

### 5.5 — Reduced Motion Respect

**File:** `vaultdrive_client/src/styles/index.css` (global)

Add a single media query that kills all animation for users who prefer reduced motion:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

**Why it matters for a hackathon:** If a judge has vestibular sensitivity, your animations could literally make them nauseous. Respecting `prefers-reduced-motion` is an accessibility best practice AND a demonstration of engineering maturity. It's a win-win.

---

## Verification

| Check | Expected | How to verify |
|-------|----------|---------------|
| Modal animation | Slide-up on open | Open share modal, observe entrance |
| Toast animation | Slide from bottom-right | Trigger toast (copy link), observe |
| Card hover lift | Cards lift 2px on hover | Hover over dashboard stat cards |
| Dark theme glow | Primary-color glow on hover | Switch to Cyberpunk, hover card |
| Theme transition | Smooth color flow on switch | Change theme in settings |
| Reduced motion | No animations at all | Set `prefers-reduced-motion: reduce` in Chrome DevTools |
| Tests remain green | 41/41 E2E, 116/116 vitest | Run test suites |

---

## Risk

**Low.** Pure CSS/animation changes. The only risk is the theme transition scoping — if we accidentally scope to too many elements, scrolling becomes janky. Mitigate by testing on the files page (which has the most DOM elements).

---

## Evidence Log

| Date | What was done | Verified? | Commit |
|------|--------------|-----------|--------|
| 2026-05-21 | Global button press feedback | ✅ | `a4ac4eb` |
| 2026-05-21 | Staggered card animations | ✅ | `a4ac4eb` |
| 2026-05-21 | Scroll-triggered reveal | ✅ | `aff37ae` |
| | | | |

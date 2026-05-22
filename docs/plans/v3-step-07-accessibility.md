# Step 7 — Accessibility & Reduced Motion

**Parent:** [v3 Hackathon Index](./v3-hackathon-index.md)  
**Status:** ✅ DONE  
**Commit:** `6336521`  
**Deployed:** 2026-05-22

---

## Why This Matters

Accessibility isn't a checkbox. It's a statement: "We built this for everyone." In a hackathon, that statement can be the difference between "impressive" and "mature."

When a judge Tabs through the app and sees clean focus rings — that's craft. When they inspect the HTML and see ARIA landmarks — that's engineering discipline.

## What We Built

### 1. Skip-to-Content Link
A visually hidden `<a href="#root">Skip to content</a>` link appears at the top of the page. It becomes visible when focused (keyboard Tab). This allows keyboard users to bypass the navigation and jump directly to content.

**File:** `vaultdrive_client/index.html` — before `<div id="root">`

### 2. Focus-Visible Global Styles
All interactive elements show a `2px solid hsl(var(--primary))` outline on `:focus-visible`. The outline uses the theme's primary color, so it's always visible regardless of the active skin. `outline-offset: 2px` prevents the ring from overlapping content.

**File:** `vaultdrive_client/src/index.css` — `:focus-visible` in `@layer base`

### 3. ARIA Landmarks
- `<div id="root" role="main">` — identifies the main content area.
- `<aside role="navigation" aria-label="Main navigation">` — identifies the sidebar.
- `aria-label` on all icon-only buttons (menu toggle, notifications, search).

**Files:** `vaultdrive_client/index.html`, `vaultdrive_client/src/components/layout/sidebar.tsx`, `vaultdrive_client/src/components/layout/dashboard-layout.tsx`

### 4. Screen Reader Utility
A `.sr-only` CSS class hides content visually while keeping it accessible to screen readers. Uses the standard `clip: rect(0,0,0,0)` pattern.

**File:** `vaultdrive_client/src/index.css` — `.sr-only` in `@layer base`

### 5. Reduced Motion Support
Two layers of `prefers-reduced-motion: reduce` handling:

**Layer 1 (index.css):** Disables all animation-duration, animation-iteration-count, transition-duration, and scroll-behavior for `*, *::before, *::after`.

**Layer 2 (luxury-tokens.css):** Specifically targets luxury utilities — `.lux-glass` and `.lux-elevated` transitions set to `0.01ms`, `.lux-mesh-animated` animation disabled, `.lux-skeleton` shimmer disabled.

**Files:** `vaultdrive_client/src/index.css` lines 253-260, `vaultdrive_client/src/styles/luxury-tokens.css` lines 411-423

### 6. Semantic HTML Baseline
The app uses proper semantic elements throughout:
- `<button>` for actions (not `<div onClick>`)
- `<a>` for navigation links
- `<nav>` in the bottom navigation
- `<main>` wrapping content area
- `<header>` for the top bar
- Radix UI primitives provide built-in ARIA for Dialog, DropdownMenu, Tabs, etc.

## Verification

| Check | Result |
|-------|--------|
| Skip link visible on Tab | ✅ Verified |
| Focus ring on buttons | ✅ Primary-colored, theme-aware |
| Sidebar has `role="navigation"` | ✅ With `aria-label` |
| Root has `role="main"` | ✅ |
| Reduced motion disables animations | ✅ Both CSS layers |
| `.sr-only` class available | ✅ |
| E2E suite still green | ✅ 41/41 |

## Evidence

- Commit: `6336521` — `feat(hackathon): complete all remaining steps`
- index.html: skip link, role="main"
- sidebar.tsx: role="navigation", aria-label
- index.css: :focus-visible, .sr-only, prefers-reduced-motion

# Step 4 — Micro-Animations & Tactile Feedback

**Parent:** [Hackathon Index](./2026-05-21-hackathon-index.md)  
**Priority:** 🟡 High  
**Effort:** M (1 day)

---

## Why This Matters

The difference between a good app and a *premium* app is tactile feedback. When a button presses, the user should feel it. When a modal opens, it should slide in, not jump in. When a card appears, it should breathe into existence.

QuantiX-Drive already has `framer-motion` in the dependency tree (124 KB chunk). We're paying the bundle cost — we should use it where it matters.

---

## Current State (Verified)

- **framer-motion:** Installed, producing a 124 KB chunk (`motion-Dsp8GjAY.js`). Usage is sparse.
- **Radix UI:** Provides default dialog/popover animations. Functional but not premium.
- **CSS animations:** The `quantix` and `cyberpunk` themes have ambient background orbs. The skeleton loader uses `animate-pulse`. The theme toggle cycles with no transition.
- **Button interactions:** Standard Tailwind `hover:` and `active:scale-95` on quick-action buttons. Other buttons have no press feedback.

---

## Success Condition

After this step:
1. Every **primary button** has a subtle press animation (`active:scale-[0.97]` + shadow shift).
2. **Modals** (share, create drop link, etc.) animate in with a slide-up + fade.
3. **Toast notifications** slide in from the right, not pop.
4. **Navigation transitions** between pages have a subtle fade (not a hard swap).
5. **Hover states** on interactive elements (cards, links, buttons) show a gentle lift or glow.
6. **Theme switcher** transitions smoothly between themes (CSS `transition` on custom properties).
7. All animations respect `prefers-reduced-motion`.

---

## Implementation Plan

### 4.1 — Button Press Feedback (Global)

**File:** `vaultdrive_client/src/components/ui/button.tsx` (or global CSS)

Add a universal press feedback to all buttons:

```css
button:active:not(:disabled) {
  transform: scale(0.97);
  transition: transform 0.1s ease;
}
```

For primary/branded buttons, add a shadow reduction on press:
```css
.brand-btn-primary:active {
  box-shadow: 0 1px 2px rgba(0,0,0,0.2);
}
```

### 4.2 — Modal Animation

**File:** `vaultdrive_client/src/components/ui/dialog.tsx` (Radix wrapper)

Enhance the Radix Dialog with CSS-driven enter/exit animations:

```css
[data-state="open"] .dialog-content {
  animation: slideUp 0.2s ease-out;
}

@keyframes slideUp {
  from { opacity: 0; transform: translateY(16px) scale(0.98); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}
```

### 4.3 — Toast Slide-In

**File:** `vaultdrive_client/src/components/ui/sonner.tsx` (or toast provider)

Configure toast entrance animation to slide from the right edge:

```css
[data-sonner-toast][data-mounted] {
  animation: slideInRight 0.3s ease-out;
}

@keyframes slideInRight {
  from { opacity: 0; transform: translateX(100%); }
  to   { opacity: 1; transform: translateX(0); }
}
```

### 4.4 — Card Hover Lift

**File:** Global CSS or skins.css

Add a subtle lift effect to interactive cards:

```css
.brand-glass-card {
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}
.brand-glass-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 30px rgba(0,0,0,0.12);
}
```

For dark themes, use a glow instead of a shadow:
```css
[data-theme="quantix"] .brand-glass-card:hover {
  box-shadow: var(--shadow-glow-primary);
}
```

### 4.5 — Theme Transition

**File:** `vaultdrive_client/src/styles/index.css` or global

Add a smooth transition when switching themes:

```css
html {
  transition: background-color 0.3s ease, color 0.3s ease;
}
html * {
  transition: background-color 0.3s ease, border-color 0.3s ease, color 0.15s ease;
}
```

**Caution:** Broad `*` transitions can cause performance issues. An alternative is to scope it to specific elements (`body`, `.brand-glass-card`, etc.).

### 4.6 — Reduced Motion

**File:** Global CSS

Ensure all animations respect user preferences:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## Verification

| Check | Expected | How to verify |
|-------|----------|---------------|
| Button press | Visible scale + shadow change on click | Click any primary button |
| Modal animation | Slide-up entrance | Open share modal |
| Toast animation | Slide from right | Trigger a toast (e.g., copy share link) |
| Card hover | Lift effect on hover | Hover over feature cards |
| Theme transition | Smooth color change | Switch themes in settings |
| Reduced motion | No animations | Set `prefers-reduced-motion: reduce` in browser, verify |

---

## Risk

**Low.** Pure CSS/animation changes. The only risk is performance degradation from over-broad transitions — mitigate by scoping to specific elements.

---

## Evidence Log

| Date | What was done | Verified? | Commit |
|------|--------------|-----------|--------|
| | | | |

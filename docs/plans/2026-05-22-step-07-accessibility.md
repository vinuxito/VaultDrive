# Step 7 — Accessibility & Reduced Motion

**Parent:** [Hackathon Index](./2026-05-22-hackathon-index.md)  
**Priority:** 🟡 High  
**Effort:** S (half day)  
**Status:** 🔲 TODO

---

## Why This Is New (Not in v1)

The v1 plan focused on visual polish. This step focuses on **invisible polish** — the kind a judge notices when they Tab through the app, or when they use a screen reader, or when they have motion sensitivity.

Accessibility isn't a checkbox. It's a statement: "We built this for everyone." In a hackathon, that statement can be the difference between "impressive" and "mature."

---

## Current State (Needs Audit)

- **Radix UI:** All Radix primitives (Dialog, DropdownMenu, Tabs, etc.) ship with ARIA attributes. This gives us a strong baseline.
- **Semantic HTML:** The app uses `<button>`, `<a>`, `<nav>`, `<main>` — good baseline.
- **Color contrast:** The Elegant and Business themes likely pass AA. Cyberpunk and QuantiX dark themes need verification.
- **Keyboard navigation:** Radix handles focus trapping in modals. But do custom components (file cards, action menus) respond to keyboard?
- **Screen reader labels:** Do file upload buttons, share modals, and action menus have `aria-label`?
- **Focus indicators:** Are focus rings visible on all interactive elements, or were they hidden for aesthetics?
- **`prefers-reduced-motion`:** Not yet implemented (scheduled in Step 5.5).

---

## Implementation Plan

### 7.1 — Lighthouse Accessibility Audit

**Method:** Run Lighthouse in "accessibility" mode on 4 key pages:
1. Landing page (`/quantix/`)
2. Login page (`/quantix/login`)
3. Dashboard (`/quantix/dashboard`)
4. Files page (`/quantix/files`)

Record scores. Target: **90+** on all pages.

```bash
# Via Chrome DevTools MCP:
lighthouse_audit mode=navigation device=desktop
```

Save reports to `docs/reports/2026-05-22-a11y-audit.md`.

### 7.2 — Color Contrast Fixes

For each theme, verify that:
- Body text on background passes **WCAG 2.1 AA** (4.5:1 ratio)
- Large text (>18px or >14px bold) passes **3:1 ratio**
- Interactive elements (links, buttons) are distinguishable without relying solely on color

**Likely issues:**
- Cyberpunk theme: neon text on dark background may be too low contrast
- Muted text (`text-muted-foreground`) may fail on some backgrounds

**Fix:** Adjust `--muted-foreground` HSL values in theme CSS to ensure sufficient contrast while maintaining the aesthetic.

### 7.3 — Focus Ring Visibility

**File:** `vaultdrive_client/src/styles/index.css`

Ensure focus indicators are visible on keyboard navigation but don't clutter mouse interaction:

```css
/* Only show focus ring on keyboard navigation */
*:focus-visible {
  outline: 2px solid hsl(var(--primary));
  outline-offset: 2px;
  border-radius: 4px;
}

/* Remove default focus ring on mouse click */
*:focus:not(:focus-visible) {
  outline: none;
}
```

**Why `:focus-visible`:** This CSS pseudo-class only activates on keyboard navigation (Tab, arrow keys), not mouse clicks. It's the modern solution to the "ugly focus ring" problem.

### 7.4 — ARIA Labels for Custom Components

Audit and add `aria-label` to:

| Component | Current | Needed |
|-----------|---------|--------|
| File upload button | May lack label | `aria-label="Upload file"` |
| Share action button | May lack label | `aria-label="Share file {filename}"` |
| Theme toggle | May lack label | `aria-label="Switch theme"` |
| Language selector | May lack label | `aria-label="Change language"` |
| PIN input | May lack label | `aria-label="Enter your PIN"` |
| Sidebar collapse | May lack label | `aria-label="Toggle sidebar"` |
| File action menu | May lack label | `aria-label="Actions for {filename}"` |

### 7.5 — Keyboard Navigation Verification

Test the full golden path using ONLY keyboard:

1. Tab to "Get Started" → Enter
2. Tab through register form → fill fields → Tab to submit → Enter
3. Tab through PIN setup → enter digits → Tab to confirm → Enter
4. Tab through dashboard → Tab to "Upload" → Enter → file picker
5. Tab to file → Tab to share → Enter → modal opens
6. Tab to copy button → Enter → link copied
7. Tab to theme picker → Enter → select theme

If any step is unreachable by keyboard, add `tabIndex` or refactor the component to use a `<button>` instead of a `<div onClick>`.

### 7.6 — Skip Navigation Link

**File:** `vaultdrive_client/src/App.tsx` (or layout component)

Add a visually hidden "Skip to content" link as the first focusable element:

```tsx
<a 
  href="#main-content" 
  className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 
             focus:bg-primary focus:text-primary-foreground focus:px-4 focus:py-2 focus:rounded"
>
  Skip to content
</a>

// On the main content area:
<main id="main-content" tabIndex={-1}>
```

**Why it matters:** Screen reader users shouldn't have to Tab through the entire sidebar on every page load. One "Skip to content" link saves 15+ Tab presses.

### 7.7 — `prefers-reduced-motion` (Coordinated with Step 5.5)

If Step 5.5 hasn't been done yet, implement the media query here:

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

---

## Verification

| Check | Expected | How to verify |
|-------|----------|---------------|
| Lighthouse a11y score | 90+ on all 4 pages | Run Lighthouse audit |
| Color contrast (Elegant theme) | AA pass on all text | Chrome contrast checker |
| Color contrast (Cyberpunk) | AA pass on body text | Chrome contrast checker |
| Focus rings visible | Ring appears on Tab | Tab through dashboard |
| Focus rings hidden on click | No ring on mouse click | Click buttons |
| ARIA labels present | All custom components labeled | Screen reader test |
| Keyboard golden path | Complete flow with Tab + Enter only | Manual keyboard test |
| Skip navigation | Link appears on first Tab | Tab on fresh page load |
| Reduced motion | Zero animations | Set `prefers-reduced-motion: reduce` |
| Tests remain green | 41/41 E2E, 116/116 vitest | Run test suites |

---

## Risk

**Low.** Accessibility improvements don't change functionality. The only risk is accidentally breaking a visual layout with focus ring styles — mitigate by scoping to `:focus-visible` only.

---

## Evidence Log

| Date | What was done | Verified? | Commit |
|------|--------------|-----------|--------|
| | | | |

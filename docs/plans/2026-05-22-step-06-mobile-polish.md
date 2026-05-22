# Step 6 — Mobile: When the Judge Pulls Out Their Phone

**Parent:** [Hackathon Index](./2026-05-22-hackathon-index.md)  
**Priority:** 🟡 High  
**Effort:** M (1 day)  
**Status:** 🔲 TODO

---

## Why This Matters

It's the hackathon equivalent of a stress test: the judge opens your app on their phone. If the layout breaks, the glassmorphic cards overlap, or buttons are too small to tap — you've just told them the product isn't real.

QuantiX-Drive doesn't need to be a native mobile app. It needs to **not break** on a phone. And if it looks premium on a 375px screen? That's the "they thought of everything" moment.

---

## Current State (Needs Verification)

- **Responsive utilities:** Tailwind `md:`, `lg:` breakpoints are used throughout.
- **Grid layouts:** Dashboard (2/4-col), feature cards (2/4-col), settings tabs.
- **Bottom nav:** A `BottomNav` component exists (`mobile/bottom-nav.tsx`). Need to verify it's wired and functional.
- **Sidebar:** Desktop sidebar collapses. Mobile behavior needs verification.
- **Modals:** Radix dialogs should center on mobile but may overflow.
- **Tables:** File lists, audit logs — tables are notoriously bad on mobile.
- **Touch targets:** Minimum 44×44px for comfortable touch.

---

## Implementation Plan

### 6.1 — Comprehensive Mobile Viewport Audit

**Method:** Chrome DevTools device emulation  
**Devices:** iPhone SE (375px), iPhone 14 (390px), Pixel 7 (412px)  
**Pages to test:** Landing, Login, Dashboard, Files, Groups, Shared, Settings, Public share page

For each page, document:
- [ ] Horizontal scrolling (should be zero)
- [ ] Overlapping elements
- [ ] Text readability (minimum 14px body text on mobile)
- [ ] Button/link touch targets (minimum 44×44px)
- [ ] Navigation accessibility (can reach all pages?)
- [ ] Modal behavior (fits viewport? scrollable?)

Save audit results as a markdown table in the evidence log.

### 6.2 — Bottom Navigation Verification

**File:** `vaultdrive_client/src/components/mobile/bottom-nav.tsx`

Verify:
- Is `BottomNav` rendered at `sm:` and below?
- Does it contain icons + labels for: Dashboard, Files, Groups, Settings?
- Does it highlight the active route?
- Does it use the active theme colors?
- Does it have minimum 44px touch targets?

If the component exists but isn't wired, wire it into the main layout. If it doesn't exist, build it.

**Design:**
```
┌────────┬────────┬────────┬────────┐
│  🏠    │  📁    │  👥    │  ⚙️    │
│ Home   │ Files  │ Groups │ More   │
└────────┴────────┴────────┴────────┘
```

Use the `lucide-react` icons already in the bundle. Style with `brand-glass-card` backdrop-blur for the premium glass effect.

### 6.3 — Modal Mobile Full-Screen

**File:** `vaultdrive_client/src/components/ui/dialog.tsx`

On screens below 640px, dialogs should expand to near-fullscreen with bottom-sheet behavior:

```css
@media (max-width: 640px) {
  [role="dialog"] {
    width: 100vw !important;
    max-width: 100vw !important;
    max-height: 85vh;
    border-radius: 1rem 1rem 0 0;
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    top: auto;
    margin: 0;
  }
}
```

**Why bottom-sheet:** Mobile users expect modals to slide up from the bottom (iOS/Android pattern). A centered floating dialog on a small screen feels unnatural.

### 6.4 — File List Mobile Strategy

**File:** `vaultdrive_client/src/pages/files.tsx` (file table/grid)

For the file list on mobile, implement a **card layout** instead of a table:

```css
@media (max-width: 640px) {
  .file-list-table {
    display: none;
  }
  .file-list-cards {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
}
```

Each card shows: file name, size, date, encryption badge, and action button. This is far more thumb-friendly than a horizontal table.

### 6.5 — Landing Page Mobile Hero

**File:** `vaultdrive_client/src/pages/home.tsx`

Ensure:
- Hero text is at least 18px on mobile (not squished to 14px)
- CTA buttons stack vertically on `sm:` screens
- The brand logo doesn't dominate >50% of the viewport
- The cycling encryption trust signal is readable on one line

### 6.6 — PWA Install Prompt

**File:** `vaultdrive_client/src/components/pwa/InstallPrompt.tsx` (new)

The app already has a `manifest.json`. Add a smart install banner that appears ONCE on mobile after the user has been active for 30 seconds:

```tsx
// Listen for the beforeinstallprompt event
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  setDeferredPrompt(e);
});

// Show a styled banner:
<div className="brand-glass-card p-3 fixed bottom-16 left-4 right-4">
  <div className="flex items-center justify-between">
    <span>📱 Install QuantiX Drive for instant access</span>
    <Button size="sm" onClick={handleInstall}>Install</Button>
  </div>
</div>
```

**Why it matters:** A PWA install prompt says "this is a real app, not a website." If a judge installs it on their home screen and it opens full-screen with the QuantiX icon... that's unforgettable.

### 6.7 — Touch Target Enforcement

Scan all interactive elements and ensure:
- Minimum height: 44px
- Minimum width: 44px
- Adequate spacing between adjacent targets (no accidental taps)

**Quick CSS fix for small buttons:**
```css
@media (max-width: 640px) {
  button, [role="button"], a {
    min-height: 44px;
    min-width: 44px;
  }
}
```

---

## Verification

| Check | Expected | How to verify |
|-------|----------|---------------|
| iPhone SE viewport (375px) | No horizontal scroll, all content visible | Chrome DevTools |
| Bottom nav | Visible on mobile, all links work | Load dashboard on 375px |
| Modal on mobile | Bottom-sheet behavior, scrollable | Open share modal on 375px |
| File list on mobile | Card layout, thumb-friendly | Navigate to /files on 375px |
| Landing hero on mobile | Text readable, buttons stacked | Load / on 375px |
| Touch targets | All buttons ≥ 44px | Chrome DevTools accessibility audit |
| PWA install | Install banner appears after 30s | Open on mobile Chrome |
| Tests remain green | 41/41 E2E, 116/116 vitest | Run test suites |

---

## Risk

**Low-Medium.** Mobile CSS changes can accidentally break desktop layouts. Mitigate by:
1. Wrapping all mobile CSS in `@media (max-width: 640px)` or Tailwind `sm:` prefixes
2. Testing desktop after every mobile change
3. Running E2E after completion (tests run on desktop viewport by default)

---

## Evidence Log

| Date | What was done | Verified? | Commit |
|------|--------------|-----------|--------|
| | | | |

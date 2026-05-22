# Step 5 — Mobile & Responsive Polish

**Parent:** [Hackathon Index](./2026-05-21-hackathon-index.md)  
**Priority:** 🟡 High  
**Effort:** S (half day)

---

## Why This Matters

A hackathon judge may pull out their phone to test the app. If the layout breaks, the glassmorphic cards overlap, or the navigation is unusable on a small screen, you lose credibility instantly. The app doesn't need to be a native mobile experience — it needs to **not break**.

---

## Current State (Inference — Needs Verification)

- **Tailwind responsive utilities** are used throughout (`md:`, `lg:` breakpoints).
- **Grid layouts** on dashboard (2-col/4-col), feature cards (2-col/4-col), etc.
- **Sidebar/navbar:** Uses a responsive nav layout. Need to verify mobile hamburger behavior.
- **Modals:** Radix dialogs should be responsive by default, but need to verify they don't overflow on small screens.
- **Tables:** File lists, audit logs — tables are notoriously bad on mobile. Need to verify.
- **Touch targets:** Buttons need to be at least 44x44px for comfortable touch.

---

## Success Condition

After this step:
1. The app is **fully usable** on a 375px-wide viewport (iPhone SE).
2. Navigation is **accessible** via a mobile menu (hamburger or bottom nav).
3. No horizontal scrolling on any page.
4. All buttons and interactive elements have **minimum 44px touch targets**.
5. Modals are **full-screen or near-full on mobile** instead of floating in a tiny box.
6. The landing page hero looks intentional on mobile, not squished.

---

## Implementation Plan

### 5.1 — Mobile Viewport Audit

**Method:** Browser DevTools device emulation (iPhone SE, iPhone 14, Pixel 7)

Systematically load every page and document:
- Layout issues (overflow, overlap, squished elements)
- Navigation usability
- Touch target sizes
- Modal behavior
- Table readability

### 5.2 — Navigation Mobile Menu

**File:** `vaultdrive_client/src/components/navbar.tsx`

Verify the mobile menu exists and works. If it's a hamburger, ensure:
- It opens a full-screen overlay or slide-in panel.
- All nav items are accessible.
- The menu closes on route change.

### 5.3 — Table Responsive Strategy

For file lists and audit logs on mobile, implement one of:
- **Card layout:** Transform table rows into stacked cards below `md:`.
- **Horizontal scroll with shadow indicators:** Let the table scroll with visual cues.
- **Column hiding:** Show only the most important columns on mobile.

### 5.4 — Modal Mobile Fullscreen

**File:** `vaultdrive_client/src/components/ui/dialog.tsx`

On screens below `sm:` (640px), dialogs should expand to near-fullscreen:

```css
@media (max-width: 640px) {
  [role="dialog"] {
    width: 100vw !important;
    max-width: 100vw !important;
    height: auto;
    max-height: 90vh;
    border-radius: 1rem 1rem 0 0;
    bottom: 0;
    top: auto;
  }
}
```

### 5.5 — Touch Target Enforcement

Scan all interactive elements. Any button, link, or toggle smaller than 44x44px gets padding or min-height enforced.

### 5.6 — Landing Page Mobile Hero

Ensure the hero section on mobile:
- Text is readable (not too small).
- Buttons stack vertically if needed.
- The brand logo doesn't dominate the viewport.

---

## Verification

| Check | Expected | How to verify |
|-------|----------|---------------|
| iPhone SE viewport | No horizontal scroll, all content visible | Chrome DevTools, 375px |
| Mobile nav | Menu opens, all links accessible | Click hamburger/menu |
| File list on mobile | Readable, no overflow | Navigate to /files on 375px |
| Modal on mobile | Near-fullscreen, scrollable | Open share modal on 375px |
| Touch targets | All buttons ≥ 44px | Chrome DevTools accessibility audit |
| Landing hero on mobile | Text readable, buttons accessible | Load / on 375px |

---

## Risk

**Low.** CSS-only changes. No functionality changes. Everything is independently reversible.

---

## Evidence Log

| Date | What was done | Verified? | Commit |
|------|--------------|-----------|--------|
| | | | |

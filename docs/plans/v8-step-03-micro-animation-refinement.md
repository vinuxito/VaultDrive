# Step 3: Animation Polish & Motion Accessibility

This step polishes the timings and ensures full accessibility and fallback safety.

---

## 🎯 Goal
Fine-tune transition easing curves, handle device performance bounds, and respect user system accessibility preferences (reduced motion).

---

## 🏗️ Proposed Changes

### 1. Easing Curves & Timings
#### [MODIFY] [transitions.css](file:///lamp/www/ABRN-Drive/vaultdrive_client/src/styles/transitions.css)
- Implement custom cubic-bezier curves (e.g. `cubic-bezier(0.16, 1, 0.3, 1)`) for all view-transition animations to create a luxurious feel.
- Cap transit times to 250ms for page switches and 450ms for the full theme reveal circle, keeping the application snappy.

### 2. Motion Accessibility (Reduced Motion)
#### [MODIFY] [index.css](file:///lamp/www/ABRN-Drive/vaultdrive_client/src/index.css)
- Inside the `@media (prefers-reduced-motion: reduce)` block, disable all custom view transitions:
  ```css
  @media (prefers-reduced-motion: reduce) {
    ::view-transition-group(*),
    ::view-transition-old(*),
    ::view-transition-new(*) {
      animation: none !important;
    }
  }
  ```
- This guarantees that users with vestibular sensitivities do not experience visual flashes or motion scaling.

---

## 🧪 Verification Plan
- Emulate `prefers-reduced-motion: reduce` in Chrome DevTools, click through pages and theme swatches, and verify that all transitions default back to clean, instant state swaps.

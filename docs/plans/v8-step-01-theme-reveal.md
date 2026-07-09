# Step 1: Circular Theme Reveal Ripple

This step implements the circular clip-path ripple reveal effect when toggling skins.

---

## 🎯 Goal
Intercept theme/skin selection events, record cursor coordinates, wrap DOM state updates in a View Transition block, and animate a circular expand clip-path overlay.

---

## 🏗️ Proposed Changes

### 1. Intercepting Swatch & Cycle Selection
#### [MODIFY] [theme-provider.tsx](file:///lamp/www/ABRN-Drive/vaultdrive_client/src/components/theme-provider.tsx)
- Expose a `setThemeWithTransition(theme: string, event: React.MouseEvent)` helper on the ThemeContext.
- Verify browser support for `document.startViewTransition`. Fall back to normal `setTheme` if unsupported.

#### [MODIFY] [settings.tsx](file:///lamp/www/ABRN-Drive/vaultdrive_client/src/pages/settings.tsx) and [navbar.tsx](file:///lamp/www/ABRN-Drive/vaultdrive_client/src/components/navbar.tsx)
- Pass click events to the theme toggle handlers.
- Bind the swatch clicks and navbar cycle clicks to `setThemeWithTransition`.

### 2. Animating the Ripple Reveal
#### [MODIFY] [transitions.css](file:///lamp/www/ABRN-Drive/vaultdrive_client/src/styles/transitions.css)
- Implement custom view-transition selectors:
  ```css
  ::view-transition-image-pair(root) {
    isolation: auto;
  }
  ::view-transition-old(root),
  ::view-transition-new(root) {
    animation: none;
    mix-blend-mode: normal;
  }
  ```
- Use `clipPath` animation inside `theme-provider.tsx` to dynamically animate from `circle(0px at x y)` to `circle(endRadius at x y)` on `::view-transition-new(root)`.

---

## 🧪 Verification Plan
- Cycle skins in the settings menu and verify that the color transition ripples outward from the clicked swatch button.

# Step 1: Visual Refinement & Ambient Glows

This step targets the aesthetic polish, scrollbar clipping issues, and theme-specific backdrop glows.

---

## 🎯 Goal
Eliminate default browser scrollbars on rounded corners, design custom theme-conforming scrollbars for all skins, add smooth `@starting-style` transitions for popup menus, and implement unique ambient background glow orbs for all themes.

---

## 🏗️ Proposed Changes

### 1. Insetting Scrollbars in FilePreviewModal
#### [MODIFY] [FilePreviewModal.tsx](file:///lamp/www/ABRN-Drive/vaultdrive_client/src/components/vault/FilePreviewModal.tsx)
- Add `overflow-hidden` to the modal container `w-full max-w-5xl max-h-[90vh]`.
- Make the main body container `flex-1 overflow-y-auto pr-2 min-h-0` scrollable inside, preserving space for scrollbars so they do not clip the rounded border corners.

### 2. Custom Scrollbars per Skin
#### [MODIFY] [skins.css](file:///lamp/www/ABRN-Drive/vaultdrive_client/src/styles/skins.css)
- Add custom webkit scrollbar variables and selectors for `light` and `dark` themes.
- Implement standard CSS `scrollbar-color: hsl(var(--primary) / 0.3) transparent` and `scrollbar-width: thin` globally for all themes in [index.css](file:///lamp/www/ABRN-Drive/vaultdrive_client/src/index.css).
- Make scrollbar tracks transparent across all themes.

### 3. Ambient Background Glow Orbs
#### [MODIFY] [skins.css](file:///lamp/www/ABRN-Drive/vaultdrive_client/src/styles/skins.css)
- Define custom `background-image` radial gradients for `body` tags across the different skins:
  - **Elegant**: Warm champagne and gold soft radial backdrops.
  - **Business**: Soft steel blue and deep slate ambient backdrops.
  - **Light/Dark**: Refined and subtle background colors with extremely low opacity theme-tinted glow orbs.

### 4. Transition Animations
#### [MODIFY] [index.css](file:///lamp/www/ABRN-Drive/vaultdrive_client/src/index.css)
- Implement entry transition animations for modals, context menus, and tooltips using keyframes and transitions.

---

## 🧪 Verification Plan
- **Manual Verification**: Run the development server and verify the preview modal on different viewport sizes. Confirm scrollbar rendering, scrollbar colors, and presence of background ambient glows when switching skins on the settings page.

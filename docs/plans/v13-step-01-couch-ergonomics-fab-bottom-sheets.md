# Step 1: Ergonomía de Sillón — FAB Flotante, Bottom Sheets & Targets de 48px

> **Iron Law 2 (Ergonomía de Sillón)**: *"Designed for a human lying on a couch, holding a 6.7\" phone with one hand, eating tacos with the other, or carrying groceries. Bottom 40% rule, trucker touch targets $\ge 48\text{px}$, zero delicate micro-gestures."*

---

## 1. Problem Statement & Current Bottlenecks

1. **Top-Heavy Primary Actions**: In mobile viewports ($< 768\text{px}$), the buttons to upload files (`Upload`), create folders (`New Folder`), and switch views are located at the very top of `pages/files.tsx`, requiring an awkward two-handed stretch or hand readjustment that frequently leads to dropped devices or accidental taps.
2. **Desktop Modals on Phone Screens**: Actions like folder creation, file renaming, and share settings render centered desktop `Dialog` components that float awkwardly in the center of the mobile screen with small close buttons in the upper-right corner.
3. **Sub-48px Touch Targets**: The folder tree 3-dots action triggers and file card buttons use compact desktop sizing (`28\times 28\text{px}` to `32\times 32\text{px}`), causing mis-taps when operated with a thumb.

---

## 2. Proposed Architecture & Component Changes

```
+-----------------------------------------------------------------------------------+
|                   MOBILE VIEWPORT (< 768px) ERGONOMIC LAYOUT                      |
+-----------------------------------------------------------------------------------+
|  [Header & Search]                                                (Viewing zone)  |
|                                                                                   |
|  [File & Folder List (48px Row Height)]                                           |
|                                                                                   |
|  ...............................................................................  |
|  NATURAL THUMB SWEEP ZONE (BOTTOM 40%)                                            |
|                                                                                   |
|                                                     [ + FAB Flotante (56x56px) ]  |
|  [ Files ]               [ Shared ]                 [ Profile ]                   |
|  ================================== BOTTOM NAV =================================  |
+-----------------------------------------------------------------------------------+
```

### Files to Create / Modify
- **[NEW] `vaultdrive_client/src/components/mobile/bottom-sheet.tsx`**: Universal swipeable bottom sheet with gesture-down dismissal, backdrop blur, and touch drag pill.
- **[NEW] `vaultdrive_client/src/components/mobile/floating-action-button.tsx`**: High-contrast, tactile 56px FAB anchored in the bottom thumb zone with expandable quick-actions (`Subir Archivo`, `Nueva Carpeta`, `Escanear/Cámara`).
- **[MODIFY] `vaultdrive_client/src/pages/files.tsx`**: Mount the mobile FAB on viewports $< 768\text{px}$, route modal creation through `BottomSheet` on mobile, and expand row action hitboxes.
- **[MODIFY] `vaultdrive_client/src/components/folders/FolderTreeItem.tsx`**: Increase touch hit area of the 3-dots button on touch devices (`min-h-[44px] min-w-[44px]` with visual icon centered).
- **[MODIFY] `vaultdrive_client/src/components/files/FileWidget.tsx`**: Guarantee minimum 44–48px touch targets for mobile action buttons.

---

## 3. Step-by-Step Implementation Details

### A. Mobile Bottom Sheet Engine (`bottom-sheet.tsx`)
1. Create a responsive container using `createPortal` to `document.body`.
2. Responsive behavior:
   - On screens $\ge 768\text{px}$ (tablet/desktop): render standard centered glass dialog.
   - On screens $< 768\text{px}$ (mobile): render sliding bottom sheet pinned to `bottom-0`, rounded top corners (`rounded-t-2xl`), drag indicator handle (`w-12 h-1.5 bg-muted rounded-full mx-auto my-2`), and touch drag physics (`framer-motion` `drag="y"` with `dragConstraints={{ top: 0 }}` and dismissal threshold $> 100\text{px}$).
3. Integrated keyboard dismissal (`Escape`) and click-outside backdrop dismissal.

### B. Mobile Floating Action Button (`floating-action-button.tsx`)
1. Anchor position: `fixed bottom-20 right-5 z-40 md:hidden` (positioned safely above `BottomNav` and within standard thumb radius).
2. Sizing & Aesthetics: `h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-2xl shadow-primary/40 flex items-center justify-center active:scale-95 transition-transform`.
3. Press behavior:
   - Tapping expands a smooth radial or vertical speed-dial menu:
     - 📁 **Nueva Carpeta** (48px action pill)
     - 📄 **Subir Archivos** (48px action pill, triggers native file picker)
   - Soft backdrop blur when opened (`bg-background/60 backdrop-blur-xs`).

### C. Touch Hitbox Expansion ($\ge 48\text{px}$)
1. In `FolderTreeItem.tsx`, update the 3-dots trigger:
   ```tsx
   className="h-10 w-10 sm:h-7 sm:w-7 flex items-center justify-center p-0 cursor-pointer touch-manipulation"
   ```
2. In `FileWidget.tsx`, update mobile action buttons with `min-h-[44px] min-w-[44px]` touch targets.

---

## 4. Verification & Quality Gate (Law 2 Proof)

### Automated Tests
1. **Component Test (`bottom-sheet.test.tsx`)**:
   - Verify sheet renders at bottom on small viewports and supports touch dismiss triggers.
2. **FAB Test (`floating-action-button.test.tsx`)**:
   - Verify FAB expands speed-dial and invokes upload / create folder callbacks.
3. **Suite Validation**:
   - `npm test`
   - `npm run typecheck`

### Native Android 13 Verification (`filemon-remote-mobile`)
- Launch Waydroid Android 13, navigate to `https://abrndrive.filemonprime.net/abrn/files`.
- Verify FAB is positioned within thumb sweep range and clears `BottomNav`.
- Tap FAB with single touch, verify speed-dial expands instantly ($<150\text{ms}$).

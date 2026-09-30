# Step 04: DOM Virtualization & Fluid Vault Performance

- **Title**: DOM Virtualization & Fluid Vault Performance (Taming 3,400+ DOM Nodes)
- **Category**: `architecture / UX`
- **Owner**: Frontend Architecture / Performance
- **Affected Files**:
  - `vaultdrive_client/src/components/vault/FileGrid.tsx`
  - `vaultdrive_client/src/components/vault/FileTableRow.tsx`
  - `vaultdrive_client/src/pages/files.tsx`
  - `vaultdrive_client/src/pages/files.test.tsx`

---

## 1. Why It Matters Now

During live browser inspection of `/files`, our snapshot captured **over 3,480 DOM nodes** for a single folder holding 196 files. 

### The Root Cause: Per-Row Action Button Explosion
Inspecting the accessibility tree reveals that every single file row renders up to **10 distinct action buttons**:
- `Descargar`
- `Crear enlace`
- `Destacar`
- `¿Quién puede acceder?`
- `Ver recibo de seguridad`
- `Compartir con usuario`
- `Compartir rápido`
- `Administrar acceso`
- `Mover a carpeta`
- `Eliminar`

Multiplying 10 action buttons by 196 files equals **1,960 interactive elements** mounted simultaneously, each with event handlers, Lucide SVG icons, tooltip anchors, and ARIA attributes. 

On mobile devices (e.g., native Android 13 Chrome running on budget/mid-range chips) and laptops on battery saver mode, this causes:
- Noticeable stutter and scroll jitter.
- Sluggish touch response when opening menus.
- Excessive memory consumption (~40MB extra DOM tree memory).

---

## 2. What Exactly Should Be Done

### A. Consolidate Row Actions into the Unified Portaled Menu
1. On each row, eliminate the 8 hidden/hover buttons.
2. Retain only:
   - File selector checkbox (`min-h-[44px]`).
   - Clickable filename/icon (opens preview).
   - Desktop hover quick-action: Download button.
   - The unified 3-dots trigger button (`RowActionMenu`).
3. All other operations (Share, WhatsApp, Move, Star, Delete, Passport, Access Control) live inside the portaled `RowActionMenu`. When closed, the menu consumes **zero DOM nodes**.

### B. Implement CSS Rendering Containment (`content-visibility: auto`)
In `FileTableRow.tsx` and `FileGrid.tsx`:
1. Apply native CSS layout containment to file rows:
   ```css
   .file-row {
     content-visibility: auto;
     contain-intrinsic-size: 0 48px;
   }
   ```
2. The browser rendering engine automatically skips style calculation, layout, and painting for offscreen file rows until the user scrolls them into view.

### C. DOM Node Budget & Virtualization Boundary
- Establish an architectural budget: `< 1,000 DOM nodes` for a folder containing 200 files (a 71% reduction).
- If folders exceed 500 files, introduce `@tanstack/react-virtual` windowing to cap mounted rows at 20 regardless of folder size.

---

## 3. What Existing Work It Builds On
- Builds on `RowActionMenu.tsx` (the hardened 48px hitboxes and portaled architecture from v13).
- Builds on `FileGrid.tsx` selection and keyboard navigation hooks (`J`/`K` navigation).

---

## 4. What Risks It Avoids
- Avoids mobile browser out-of-memory crashes on large accounting archives.
- Prevents scroll stutter and accidental mis-taps caused by lagging layout re-renders.

---

## 5. Expected Payoff
- 70%+ reduction in total DOM nodes.
- Instantaneous 60fps scrolling on both desktop and native mobile browsers.
- Rapid instantaneous search filtering across hundreds of items.

---

## 6. Definition of Done & Testable Acceptance Criteria

1. **Automated Vitest Test**:
   - `FileGrid.test.tsx` renders a fixture of 200 files.
   - Evaluates total mounted `<button>` elements in the container; asserts count is $\le 450$ (instead of $\ge 2,000$).
2. **Strict TypeScript & Build**:
   - `npm run typecheck`: 0 errors.
   - `npm run build`: 0 errors.
3. **Live Browser Verification via `bsk`**:
   - Navigate to `/files` with 196 files; evaluate `document.querySelectorAll('*').length`.
   - Assert total DOM node count is $< 1,200$ (down from $3,480+$).
   - Verify smooth scrolling and flawless operation of the 3-dots action menu.

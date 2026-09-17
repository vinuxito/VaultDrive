# Step 4: Elastic Marquee Lasso Selection & Batch Action Surface

## Overview
Replicate native OS desktop file selection behavior. Users currently must click individual checkboxes one by one to assemble a batch of files. This step implements a high-performance pointer-drag rectangular lasso ("marquee selection") across the file grid/table, with sub-millisecond collision detection, additive modifier keys, and an executive bottom action bar.

---

## Detailed Technical Objectives

### 1. Marquee Selection Hook (`src/hooks/useMarqueeSelection.ts`)
* **State Machine**:
  ```typescript
  interface LassoBox {
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
    isSelecting: boolean;
  }
  ```
* **Pointer Down Trigger**:
  - Attached to main scrollable container (`fileContainerRef`).
  - Checks if event target is an interactive child:
    ```typescript
    if ((e.target as HTMLElement).closest("button, a, input, [data-interactive='true'], [role='menuitem']")) {
      return;
    }
    ```
  - Starts lasso tracking if left mouse button (`e.button === 0`) is held and moves > 5px.

### 2. High-Performance Collision Geometry (Reflow-Free)
* **Pre-computation Phase (`onMouseDown`)**:
  - Caches `getBoundingClientRect()` of all visible item elements marked with `data-file-row-id`:
    ```typescript
    const itemRects = Array.from(container.querySelectorAll<HTMLElement>("[data-file-row-id]")).map(el => ({
      id: el.getAttribute("data-file-row-id")!,
      rect: el.getBoundingClientRect(),
    }));
    ```
* **Collision Detection Phase (`onMouseMove` via RAF)**:
  - Derives normalized lasso box:
    ```typescript
    const lassoLeft = Math.min(box.startX, box.currentX);
    const lassoTop = Math.min(box.startY, box.currentY);
    const lassoRight = Math.max(box.startX, box.currentX);
    const lassoBottom = Math.max(box.startY, box.currentY);
    ```
  - Performs pure arithmetic 2D Axis-Aligned Bounding Box (AABB) intersection:
    ```typescript
    const intersects = !(
      item.rect.left > lassoRight ||
      item.rect.right < lassoLeft ||
      item.rect.top > lassoBottom ||
      item.rect.bottom < lassoTop
    );
    ```
  - Dispatches updated `Set<string>` of selected IDs directly to parent state without layout thrashing.

### 3. Visual Render & Interaction Feedback
* **Marquee Box Overlay**:
  ```tsx
  {isSelecting && (
    <div
      className="fixed pointer-events-none z-40 border border-primary/70 bg-primary/15 rounded-xs backdrop-blur-[1px] shadow-sm"
      style={{
        left: `${lassoLeft}px`,
        top: `${lassoTop}px`,
        width: `${lassoRight - lassoLeft}px`,
        height: `${lassoBottom - lassoTop}px`,
      }}
    />
  )}
  ```
* **Modifier Key Rules**:
  - `Shift + Lasso`: Union selection (adds lassoed items to currently selected set).
  - `Alt + Lasso`: Subtraction selection (removes lassoed items from current set).
  - Regular Lasso: Replaces current selection.

### 4. Floating Batch Action Bar (`src/components/vault/BulkActionBar.tsx` Polish)
* When `selectedFileIds.size >= 2`:
  - Animate in an executive floating action pill at bottom center (`fixed bottom-6 left-1/2 -translate-x-1/2 z-30`):
    - Count pill: `X archivos seleccionados`
    - Quick actions:
      - 📥 **Descargar Lote (Zip)** (`⌘D`)
      - 🚚 **Mover a Carpeta** (`M`)
      - 📦 **Enviar al Staging Dock** (`X`)
      - 🗑️ **Eliminar** (`Supr`)
      - ✕ **Deseleccionar** (`Esc`)
  - Frosted dark styling: `bg-card/95 backdrop-blur-xl border border-primary/30 shadow-2xl rounded-full px-4 py-2 flex items-center gap-3`.

---

## Verification Plan

1. **Unit Tests (`useMarqueeSelection.test.ts`)**:
   - Verify AABB collision intersection returns true for overlapping coordinates.
   - Verify non-overlapping coordinates return false.
   - Verify `Shift` modifier produces union set.
2. **Interactive Proof**:
   - Drag pointer across 5 files: verify all 5 become highlighted with checkboxes checked.
   - Press `Esc`: verify all selections clear and batch bar animates out.

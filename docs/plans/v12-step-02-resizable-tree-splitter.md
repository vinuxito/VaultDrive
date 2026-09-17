# Step 2: Interactive Draggable Tree Splitter with Auto-Fit & Magnetic Snap

## Overview
Eliminate text truncation in the folder hierarchy navigation. Currently, the tree sidebar in `vaultdrive_client/src/pages/files.tsx` has a hardcoded static width of 240px (`w-60 shrink-0`). Folder names such as `MAX_PRIME_S.A._DE_C.V.` or `RGC_PIPC_WEB_PILOTO` are truncated into illegible ellipses. This step implements an interactive draggable splitter with memory, boundary clamping, magnetic collapse, and double-click auto-fit.

---

## Detailed Technical Objectives

### 1. Resizable Container Architecture
* **Location**: `vaultdrive_client/src/pages/files.tsx` between the `<aside>` (containing `<VaultTree />`) and the `<main>` (containing file list).
* **State & Persistence**:
  ```typescript
  const DEFAULT_TREE_WIDTH = 260;
  const MIN_TREE_WIDTH = 180;
  const MAX_TREE_WIDTH = 520;
  const SNAP_COLLAPSE_THRESHOLD = 150;

  const [treePaneWidth, setTreePaneWidth] = useState<number>(() => {
    const saved = localStorage.getItem("abrndrive_tree_pane_width");
    if (!saved) return DEFAULT_TREE_WIDTH;
    const parsed = parseInt(saved, 10);
    return !isNaN(parsed) && parsed >= MIN_TREE_WIDTH && parsed <= MAX_TREE_WIDTH
      ? parsed
      : DEFAULT_TREE_WIDTH;
  });
  const [isTreeCollapsed, setIsTreeCollapsed] = useState(false);
  const [isDraggingSplitter, setIsDraggingSplitter] = useState(false);
  ```

### 2. Draggable Handle Component (`PaneSplitter`)
* Render an interactive vertical divider:
  ```tsx
  <div
    role="separator"
    aria-orientation="vertical"
    aria-valuenow={treePaneWidth}
    aria-valuemin={MIN_TREE_WIDTH}
    aria-valuemax={MAX_TREE_WIDTH}
    tabIndex={0}
    onMouseDown={handleSplitterMouseDown}
    onDoubleClick={handleAutoFitWidth}
    onKeyDown={handleSplitterKeyDown}
    className={cn(
      "w-1 relative z-20 cursor-col-resize select-none transition-colors duration-150 group",
      "hover:bg-primary/50 active:bg-primary",
      isDraggingSplitter ? "bg-primary" : "bg-border/60"
    )}
  >
    {/* Visual grab pill on hover */}
    <div className="absolute top-1/2 -translate-y-1/2 -left-1 w-3 h-8 rounded-full bg-primary/20 border border-primary/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
      <div className="w-0.5 h-3 bg-primary rounded-full" />
    </div>
  </div>
  ```

### 3. Pointer Event Lifecycle & Frictionless Drag
* `onMouseDown`:
  - Attach `mousemove` and `mouseup` listeners to `window`.
  - Set `document.body.style.cursor = "col-resize"`.
  - Set `document.body.style.userSelect = "none"`.
  - On `mousemove`: calculate delta from initial clientX. Clamped to `[MIN_TREE_WIDTH, MAX_TREE_WIDTH]`.
  - Magnetic Collapse: If client position drops below `SNAP_COLLAPSE_THRESHOLD` (150px), snap to `isTreeCollapsed = true` (width 0).
  - On `mouseup`: remove listeners, restore body cursor/selection, and commit final width to `localStorage.setItem("abrndrive_tree_pane_width", String(newWidth))`.

### 4. Double-Click Auto-Fit Intelligence
* `onDoubleClick`:
  - Measures the longest visible folder label:
    ```typescript
    const labels = treeContainerRef.current?.querySelectorAll(".vault-tree-node-label");
    if (labels && labels.length > 0) {
      let maxTextWidth = 0;
      labels.forEach((el) => {
        maxTextWidth = Math.max(maxTextWidth, el.scrollWidth);
      });
      // Add indentation hierarchy padding + icon + count badge allowance (approx 90px)
      const optimalWidth = Math.min(MAX_TREE_WIDTH, Math.max(MIN_TREE_WIDTH, maxTextWidth + 90));
      setTreePaneWidth(optimalWidth);
      localStorage.setItem("abrndrive_tree_pane_width", String(optimalWidth));
    }
    ```

### 5. Keyboard Accessibility for Splitter
* Left/Right arrows on focused separator adjust width by ±16px (`Shift + Left/Right` by ±48px).
* `Enter` or `Space` toggles collapse.

---

## Verification Plan

1. **Unit Tests (`files.test.tsx`, `VaultTree.test.tsx`)**:
   - Verify initial style `style={{ width: \`${treePaneWidth}px\` }}` renders on desktop `<aside>`.
   - Verify mouse drag updates `treePaneWidth` and writes to `localStorage`.
   - Verify double-click triggers auto-fit calculation.
2. **Visual Check**:
   - Verify long folder names (`MAX_PRIME_S.A._DE_C.V.`) display fully without truncation at 320px+.
   - Verify dragging feels fluid at 60 FPS without layout thrashing.

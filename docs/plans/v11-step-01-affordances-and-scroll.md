# Step 1: Universal Affordances, Cursor Contract & Viewport Scroll Intelligence

## Overview
This step implements the foundational tactile hygiene and navigation physics across ABRN Drive. It guarantees that every interactive element signals affordance with a pointer cursor, eliminates jarring scroll offsets when navigating folders, and preserves visual orientation when closing overlays.

---

## Detailed Objectives

### 1. Global Cursor Contract
* **Rule**: Any element with an `onClick`, `onKeyDown`, or action trigger MUST render `cursor-pointer`.
* **Components to Audit & Update**:
  - `FileGrid.tsx` / `files.tsx` table rows: clicking a row triggers preview, so the entire row container must have `cursor-pointer select-none`.
  - `VaultTree.tsx`: tree branch and leaf nodes must show `cursor-pointer` across their entire width, not just the folder name text.
  - Tag chips, origin badges (`Drop: ...`, `Shared: ...`), sortable table headers (`NAME`, `ORIGIN`, `SIZE`, `DATE`), and breadcrumb items.
  - Action buttons inside modal dialogs and dropdown menus.

### 2. Viewport Scroll Intelligence (Auto-Scroll to Top)
* **Problem**: When a user scrolls down 50 items in one folder and clicks another folder in the sidebar/tree, the main file pane retains the old `scrollTop`, leaving the user staring at an empty area or middle of the list.
* **Implementation**:
  - In `vaultdrive_client/src/pages/files.tsx`, create a ref for the scrollable main container (`fileContainerRef`).
  - Add an effect triggered on `selectedNode`:
    ```typescript
    useEffect(() => {
      if (fileContainerRef.current) {
        fileContainerRef.current.scrollTo({ top: 0, behavior: "smooth" });
      }
    }, [selectedNode]);
    ```
  - Ensure tree selection, breadcrumb clicks, and back-navigation smoothly reset the viewport to top instantly.

### 3. Return-Scroll Anchoring
* When dismissing `FilePreviewModal`, `AccessPanel`, or `ShareModal`, the previously focused file row must remain visible in view.
* If the user opened item #45, closing the modal retains focus on item #45 and scroll position remains anchored, with a brief, subtle highlight ring (`ring-1 ring-primary/40 transition-all duration-700`).

### 4. Sub-Pixel Tactility & Micro-Interactions
* Add active press state to file rows: `active:scale-[0.999] transition-transform duration-75`.
* Refined hover wash: replace flat gray backgrounds with subtle translucent accents matching the brand theme (`hover:bg-primary/5 dark:hover:bg-primary/10`).
* Ensure text selection is disabled on single-click row navigation (`select-none`) to prevent accidental blue text highlighting during rapid browsing.

---

## Verification Plan
1. **Visual Proof**: Navigate to deep folder, scroll down, switch folders; verify right pane scrolls to top.
2. **Hover Proof**: Verify pointer cursor appears on entire row width, folder nodes, and column headers.
3. **Automated Unit Tests**: Vitest suite asserting `cursor-pointer` classes and scroll invocation on folder transition in `files.test.tsx`.

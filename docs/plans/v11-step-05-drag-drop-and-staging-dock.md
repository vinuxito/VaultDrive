# Step 5: Tactile Drag-and-Drop Canvas & Executive Staging Dock

## Overview
This step introduces desktop-grade spatial manipulation to ABRN Drive. Moving, organizing, and bulk-sharing encrypted assets should feel like handling physical documents on a clean executive desk, complete with a floating staging dock and a 10-second transactional undo stack (`⌘Z`).

---

## Detailed Objectives

### 1. Full-Window Drop Aura & Holographic Targets
* When files are dragged from the desktop into the browser window:
  - The entire interface transforms into an illuminated drop canvas with a subtle neon/emerald perimeter glow.
  - Clear holographic drop zones dynamically appear over the main list ("Drop to root of [Current Folder]") and over sidebar folders.
  - The drop target explicitly displays: *"Files will be AES-256 encrypted in your browser before upload"*.

### 2. Hover-to-Expand Folder Navigation During Drag
* When dragging a file or multiple files internally:
  - Hovering over any folder in the tree view or table for 500ms automatically expands that folder.
  - Enables effortless file relocation into deep hierarchies in a single uninterrupted drag gesture.

### 3. The Executive Staging Dock
* Instead of clumsy checkbox selections that get accidentally deselected:
  - Users can press `X` or drag files to the bottom of the screen to park them in a sleek, floating **Staging Dock**.
  - The Staging Dock displays thumbnail pills of docked files with total aggregated size.
  - Action pills on the dock:
    - **Batch Download**: Stream-decrypts all docked files into a single client-side `.zip`.
    - **Combined Share Link**: Creates an authenticated multi-file drop/share package in one step.
    - **Batch Sever**: Revokes external access for all docked files simultaneously.
  - Press `Esc` or click "Clear Dock" to dismiss.

### 4. Transactional Undo Stack (`⌘Z`)
* Actions like file moves, renames, and folder reorganization should not cause anxiety:
  - Every destructive or relocation action triggers a floating 10-second toast with an animated progress bar: *"Moved 3 files to [Folder] · Undo (⌘Z)"*.
  - Pressing `⌘Z` triggers an immediate reversal transaction via the backend, moving the files back to their original state with zero data loss.

---

## Verification Plan
1. **Drag-and-Drop E2E**: Test dragging desktop files onto folder tree target, verify drop aura and encrypted upload completion.
2. **Staging Dock Flow**: Select 3 files with `X`, verify dock appears, click "Batch Download", verify client-side ZIP builds and downloads.
3. **Undo Proof**: Move file to folder, press `⌘Z`, verify file returns to original folder and UI updates optimistically.

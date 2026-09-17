# Step 3: Desktop-Grade Context Menu Engine (Right-Click & Long-Press Surface)

## Overview
Elevate file operations to native desktop velocity. Currently, users must click diminutive action icons at the extreme right edge of each table row. This step introduces a high-performance, theme-aware floating context menu system (`VaultContextMenu`) triggered by standard secondary click (`contextmenu` event) and mobile long-press, featuring hotkey shortcuts and contextual awareness.

---

## Detailed Technical Objectives

### 1. Unified Context Menu Component (`src/components/vault/VaultContextMenu.tsx`)
* **Trigger Types**:
  - `file`: Triggered on single file row or grid card.
  - `multi-file`: Triggered when 2+ files are selected.
  - `folder`: Triggered on folder items in the tree or folder chips.
  - `canvas`: Triggered on whitespace within the main explorer container.
* **Coordinate Clamping Engine**:
  - Menu positions dynamically at `(x, y)` of pointer event.
  - Clamping logic prevents off-screen rendering on bottom and right viewport borders:
    ```typescript
    const clampedX = Math.min(x, window.innerWidth - MENU_WIDTH - 12);
    const clampedY = Math.min(y, window.innerHeight - menuHeight - 12);
    ```
* **Styling Contract**:
  - Frosted obsidian glass: `bg-card/95 backdrop-blur-xl border border-border/80 shadow-2xl rounded-xl py-1.5 min-w-[220px] z-50 text-sm`.
  - Item styling: `flex items-center justify-between px-3 py-1.5 mx-1 rounded-lg hover:bg-primary/10 hover:text-primary transition-colors cursor-pointer select-none`.
  - Monospaced hotkey badges: `text-xs font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded`.

### 2. Contextual Action Matrix

| Target Context | Available Actions | Hotkey Hint | Action Handler |
|---|---|:---:|---|
| **Single File** | **Quick Look Preview** | `Space` | `handlePreviewFile(file)` |
| | **Download Decrypted** | `⌘D` | `handleDownload(file)` |
| | **Create Share Link** | `L` | `openShareModal(file)` |
| | **Cryptographic Passport** | `P` | `openPassportDrawer(file)` |
| | **Move to Folder...** | `M` | `openMoveModal(file)` |
| | **Star / Unstar** | `S` | `handleToggleStar(file.id)` |
| | **Copy SHA-256 Hash** | `C` | `copyFileHash(file)` |
| | *— Divider —* | | |
| | **Revoke / Delete** | `Del` | `openDeleteModal(file)` |
| **Multi-File Selection** | **Download Selected (Zip)** | `⌘D` | `handleBatchDownload(selectedFiles)` |
| | **Move Selected...** | `M` | `openBatchMoveModal(selectedFiles)` |
| | **Send to Staging Dock** | `X` | `stageSelectedFiles(selectedFiles)` |
| | **Delete Selected** | `Del` | `openBatchDeleteModal(selectedFiles)` |
| **Folder Node** | **New Subfolder** | `N` | `onCreateSubfolder(folderId)` |
| | **Upload Here** | `U` | `triggerUploadForFolder(folderId)` |
| | **Rename Folder** | `F2` | `onRenameFolder(folderId)` |
| | **Share Folder** | `L` | `onShareFolder(folderId)` |
| | **Delete Folder** | `Del` | `onDeleteFolder(folderId)` |
| **Canvas / Empty Space** | **New Folder** | `N` | `openCreateFolderModal()` |
| | **Upload Files** | `U` | `fileInputRef.current?.click()` |
| | **Refresh Vault** | `⌘R` | `mutateFiles()` |

### 3. Integration into `files.tsx` and `FileGrid.tsx`
* Intercept `onContextMenu` on table rows and grid cards:
  ```typescript
  const handleRowContextMenu = (e: React.MouseEvent, file: FileItem) => {
    e.preventDefault();
    e.stopPropagation();
    // If target file is not currently selected, select it
    if (!selectedFileIds.has(file.id)) {
      setSelectedFileIds(new Set([file.id]));
    }
    setContextMenu({
      isOpen: true,
      x: e.clientX,
      y: e.clientY,
      targetType: selectedFileIds.size > 1 ? "multi-file" : "file",
      targetData: file,
    });
  };
  ```
* Intercept `onContextMenu` on main container background:
  ```typescript
  const handleCanvasContextMenu = (e: React.MouseEvent) => {
    // Only trigger if clicking empty container area, not interactive child
    if ((e.target as HTMLElement).closest("[data-context-target]")) return;
    e.preventDefault();
    setContextMenu({
      isOpen: true,
      x: e.clientX,
      y: e.clientY,
      targetType: "canvas",
      targetData: null,
    });
  };
  ```

### 4. Dismissal & Keyboard Navigation
* Global click listener and `Escape` key close the menu cleanly.
* Arrow `↑`/`↓` keys rove active item focus; `Enter` executes selected menu item.

---

## Verification Plan

1. **Unit Tests (`VaultContextMenu.test.tsx`)**:
   - Verify context menu renders at specified coordinates.
   - Verify boundary clamping when `x` or `y` exceed viewport bounds.
   - Verify clicking action triggers correct callback (`handleDownload`, `openPassportDrawer`, etc.).
2. **Integration Verification**:
   - Right-click row ➔ select "Download" ➔ verifies download initiation.
   - Right-click canvas ➔ select "New Folder" ➔ opens folder modal.

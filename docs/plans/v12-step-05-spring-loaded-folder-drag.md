# Step 5: Spring-Loaded Folders & Deep Drag-Drop Organization

## Overview
Enable fluid hierarchical file organization via drag-and-drop. Moving files into nested subfolders currently requires manual expansion of the entire tree before starting a drag operation. This step implements "spring-loaded" folders: hovering dragged items over any collapsed folder node in `VaultTree.tsx` for 400ms automatically springs the folder open, allowing deep drops into arbitrary hierarchy depth.

---

## Detailed Technical Objectives

### 1. Spring-Loaded Timer Hook (`useSpringLoadedFolder`)
* **Hover Detection Lifecycle**:
  ```typescript
  const SPRING_LOAD_DELAY_MS = 400;
  const hoverTimerRef = useRef<NodeJS.Timeout | null>(null);
  const activeHoverFolderIdRef = useRef<string | null>(null);

  const handleFolderDragEnter = (folderId: string, isExpanded: boolean) => {
    if (isExpanded) return;
    if (activeHoverFolderIdRef.current === folderId) return;

    activeHoverFolderIdRef.current = folderId;
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);

    hoverTimerRef.current = setTimeout(() => {
      onToggleFolder(folderId, true); // spring open!
      playAudioHaptic("focusAperture"); // subtle physical spring feedback
    }, SPRING_LOAD_DELAY_MS);
  };

  const handleFolderDragLeave = (folderId: string) => {
    if (activeHoverFolderIdRef.current === folderId) {
      if (hoverTimerRef.current) {
        clearTimeout(hoverTimerRef.current);
        hoverTimerRef.current = null;
      }
      activeHoverFolderIdRef.current = null;
    }
  };
  ```

### 2. High-Visibility Drop Target Indicators in `VaultTree.tsx`
* When dragged item enters a folder drop zone:
  - Active folder container receives distinct luminous outline:
    `ring-2 ring-primary/80 bg-primary/15 scale-[1.01] transition-all duration-150`.
  - Folder icon switches to open state: `<FolderOpen className="text-primary animate-pulse" />`.
  - Floating tooltip indicates destination: `"Soltar en [Nombre de Carpeta]"`.

### 3. Atomic Multi-File Relocation & Optimistic Pipeline
* On `onDrop`:
  - Collects dropped file IDs (single file or entire active selection from Step 4 / Staging Dock).
  - Fires optimistic client-side transfer:
    1. Removes moved files from current folder view instantly.
    2. Increments target folder badge count (`fileCountsByFolderId[targetFolderId] + N`).
  - Calls backend relocation API (`moveFile` utility).
  - Displays executive toast with 8-second undo action:
    ```typescript
    addToast({
      title: t("drive:toast.filesMoved", { count: fileIds.length, folder: targetFolderName }),
      actionLabel: t("common:actions.undo"),
      onAction: () => handleUndoFileMove(fileIds, originalFolderId),
      duration: 8000,
    });
    ```

### 4. Safety Guardrails & Cycle Prevention
* Prevent dropping a folder into itself or its own subdirectories.
* Reject moves if user does not possess write permission on destination folder.
* Cancellation on `Escape` key while dragging resets all hover timers and drop zones.

---

## Verification Plan

1. **Unit Tests (`VaultTree.test.tsx`, `file-move.test.ts`)**:
   - Verify `dragEnter` starts 400ms timer; timer triggers `onToggleFolder(id, true)`.
   - Verify `dragLeave` before 400ms clears timer without expanding folder.
   - Verify drop payload dispatches move operation with target folder ID.
2. **Interactive Proof**:
   - Drag file over closed folder: verify folder springs open after brief pause.
   - Drop file: verify file leaves current list and arrives in target folder.

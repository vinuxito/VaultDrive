# Step 3: Velocidad Telepática — UI Optimista y Transiciones Espaciales

> **Iron Law 1 (Velocidad Perceptual)**: *"0ms perceptual latency. Maximum system capability converted into minimum human effort. The interface reacts before the network packet travels."*

---

## 1. Problem Statement & Current Bottlenecks

1. **Wait Spinners on Simple Operations**: When a user renames a file, stars an item, or moves a file to a folder, the interface currently awaits the HTTP roundtrip from `/api/files/...` before updating the local list, causing a 100–300ms perceptual lag.
2. **Abrupt Spatial Navigation**: Clicking a folder causes an instant DOM wipe and re-render. There is no spatial continuity showing the folder expanding into the workspace or the breadcrumb popping back.
3. **Silent Desktop-Like Touch**: Mobile touch interactions feel dead or inert without haptic affirmation when performing critical actions (dropping into a folder, deleting, or pinning).

---

## 2. Proposed Architecture & Component Changes

```
+-----------------------------------------------------------------------------------+
|                        OPTIMISTIC MUTATION ENGINE (0ms LAG)                       |
+-----------------------------------------------------------------------------------+
|                                                                                   |
|  [ User Renames / Moves / Stars / Deletes ]                                        |
|             │                                                                     |
|             ├──► [ FRAME 0: Visual State Mutates Instantly in React Tree ]        |
|             │    - Name changes / Item moves to target folder / Star lights up    |
|             │    - Micro-haptic click dispatched to device motor                  |
|             │                                                                     |
|             └──► [ BACKGROUND: Async HTTP request dispatched to Go backend ]      |
|                      │                                                            |
|                      ├──► Success: Silent confirmation, receipt recorded          |
|                      └──► Error: Smooth rollback + contextual retry toast         |
+-----------------------------------------------------------------------------------+
```

### Files to Create / Modify
- **[NEW] `vaultdrive_client/src/hooks/use-optimistic-vault.ts`**: High-performance hook managing optimistic state trees with automatic reconciliation and transactional rollback.
- **[MODIFY] `vaultdrive_client/src/pages/files.tsx`**: Wire file renaming, starring, moving, and deletion to `useOptimisticVault`.
- **[MODIFY] `vaultdrive_client/src/utils/audioHaptics.ts`**: Expand Web Audio synthesizers with tactile acoustic profiles (woodblock snap on folder open, glass tap on star, soft chime on save).
- **[MODIFY] `vaultdrive_client/src/index.css`**: Add CSS `@view-transition` rules for seamless spatial cross-fades during folder hierarchy navigation.

---

## 3. Step-by-Step Implementation Details

### A. Optimistic Mutation Engine (`use-optimistic-vault.ts`)
1. Wrap the active files collection in an optimistic reducer:
   - `OPTIMISTIC_RENAME`: updates filename locally and stores previous name in rollback ledger.
   - `OPTIMISTIC_STAR`: flips `is_favorite` boolean instantly.
   - `OPTIMISTIC_DELETE`: removes item from visible array with a 5-second "Deshacer" (Undo) floating bar.
   - `OPTIMISTIC_MOVE`: transfers item to destination folder array immediately.
2. Background synchronization:
   - Dispatches API call with current auth token.
   - On HTTP failure: restores previous state from ledger and displays a non-blocking toast: *"No pudimos renombrar el archivo en el servidor. [ Reintentar ]"*.

### B. View Transitions API Spatial Expansion
1. In folder navigation handlers:
   ```ts
   if (document.startViewTransition) {
     document.startViewTransition(() => {
       setSelectedFolder(targetFolder);
     });
   } else {
     setSelectedFolder(targetFolder);
   }
   ```
2. CSS View Transition animations:
   - Shared element transition for folder icons (`view-transition-name: folder-active`).
   - Smooth 180ms ease-out morphing between folder grid/list states.

### C. Tactile Audio & Haptic System (`audioHaptics.ts`)
1. Add crisp, physical sound effects synthesized on-the-fly via Web Audio API (zero external mp3 assets, 0kb network footprint):
   - `playTactileClick()`: 10ms decaying sine burst at 1200Hz.
   - `playSuccessChime()`: Pentatonic two-tone chord (800Hz -> 1200Hz).
   - `playUndoPop()`: Frequency sweep downwards (600Hz -> 200Hz).
2. Integrate native vibration patterns (`navigator.vibrate([15])` for selections, `navigator.vibrate([25, 40, 25])` for completions).

---

## 4. Verification & Quality Gate (Law 1 Proof)

### Automated Tests
1. **Unit Test (`use-optimistic-vault.test.ts`)**:
   - Verify immediate optimistic update on rename action.
   - Verify rollback mechanism when API mock rejects with network error.
2. **Audio/Haptics Test (`audioHaptics.test.ts`)**:
   - Verify Web Audio context creation and silence guards when audio is muted by browser policy.

### Performance Verification
- Measure interaction latency: frame dispatch time $< 16\text{ms}$ (60fps guaranteed).
- Run full suite: `npm test && npm run typecheck`.

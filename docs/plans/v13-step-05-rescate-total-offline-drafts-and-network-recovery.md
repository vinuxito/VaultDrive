# Step 5: Rescate Total — Borradores Indestructibles y Reintento de Red con 1 Toque

> **Iron Law 4 (Rescate Sobre Disculpa)**: *"Never punish the user for server or network fragility. User work survives in IndexedDB / localStorage. Provide an explicit 1-tap retry lever instead of form-clearing error 500s."*

---

## 1. Problem Statement & Current Bottlenecks

1. **Wiped Work on Interrupted Uploads**: If a user is uploading multiple large documents or setting up a secure drop route and accidentally switches apps, closes the tab, or passes through an elevator with no Wi-Fi, the upload aborts with an unhelpful error message and the staging list is wiped.
2. **Generic Error 500 / Network Failures**: When the server or mobile carrier resets a socket, traditional SPAs display `NetworkError: Failed to fetch` and expect the user to re-select all files from scratch.
3. **Missing Pause / Resume Mechanics**: Large encrypted file uploads have no physical suspension state when network connectivity degrades.

---

## 2. Proposed Architecture & Offline Resilience Engine

```
+-----------------------------------------------------------------------------------+
|                        INDESTRUCTIBLE RESCUE ENGINE                               |
+-----------------------------------------------------------------------------------+
|                                                                                   |
|  [ User selects files / fills drop form ]                                         |
|             │                                                                     |
|             ▼                                                                     |
|  [ IndexedDB Staging Ledger persists files & metadata in local browser storage ]  |
|             │                                                                     |
|             ▼                                                                     |
|  [ NETWORK DROPS / TAB CRASHES / OFFLINE ]                                        |
|             │                                                                     |
|             ▼                                                                     |
|  [ User returns to ABRN Drive ]                                                   |
|     - Bóveda detects unsynced staged files in IndexedDB                           |
|     - Shows friendly, non-panicking Rescue Card:                                  |
|       "🌾 Se nos cortó la señal hace un momento.                                  |
|        Tus 3 archivos están a salvo en tu teléfono.                               |
|        [ Continuar Subida (1 Toque) ]    [ Cancelar ]"                            |
+-----------------------------------------------------------------------------------+
```

### Files to Create / Modify
- **[NEW] `vaultdrive_client/src/utils/rescue-ledger.ts`**: Lightweight `IndexedDB` key-value wrapper to persist active upload sessions, encrypted blobs, and staging metadata.
- **[NEW] `vaultdrive_client/src/components/rescue/network-rescue-banner.tsx`**: Warm, conversational recovery banner displaying exact survivor count and 1-tap resume lever.
- **[MODIFY] `vaultdrive_client/src/pages/files.tsx`**: Wire file staging and upload queue to `rescue-ledger.ts`; listen to `window.addEventListener('online')` and `window.addEventListener('offline')` to automatically suspend/resume chunk streaming.

---

## 3. Step-by-Step Implementation Details

### A. IndexedDB Staging Ledger (`rescue-ledger.ts`)
1. Database Name: `abrndrive_rescue_db`, Store: `staged_transfers`.
2. Lifecycle:
   - When files are selected or drop metadata is configured, record:
     `{ id, filename, size, mimeType, folderId, encryptedBlob, status: 'staged' | 'uploading' | 'paused' }`.
   - As each file completes and is verified on the Go backend, remove it cleanly from the ledger.
   - If files remain in the ledger when the application mounts, trigger the `NetworkRescueBanner`.

### B. Network Loss Detection & Auto-Suspension
1. Monitor connection state using `navigator.onLine` and `online`/`offline` window events.
2. When offline is detected during active chunk upload:
   - Do NOT throw an uncaught error.
   - Transition upload state to `PAUSED_OFFLINE`.
   - Update UI pill: *"Pausado por falta de internet · Esperando señal..."*.
3. When network returns (`online` event):
   - Automatically probe `/api/healthz` to confirm server reachability.
   - If reachable, resume upload from the current chunk without starting over.

### C. The 1-Tap Recovery Lever (`network-rescue-banner.tsx`)
1. Language contract:
   - ❌ *"Error 504 Gateway Timeout. Re-upload your files."*
   - ✅ *"Se nos fue el internet tantito, pero tranquilo: tus archivos siguen completitos en tu cel. Pícale aquí para terminarlos de subir."*
2. Primary button: `[ Reanudar Subida ]` (48px height, emerald focus ring).

---

## 4. Verification & Quality Gate (Law 4 Proof)

### Automated Tests
1. **Unit Test (`rescue-ledger.test.ts`)**:
   - Verify ledger correctly stores, retrieves, and purges staged transfers.
2. **Network Offline Simulation Test (`network-recovery.test.tsx`)**:
   - Simulate `window.dispatchEvent(new Event('offline'))` during mock upload; assert state transitions to paused without data loss.
   - Simulate `online` event; assert automatic resumption.

### Cold Verification Execution
- `npm test`
- `npm run typecheck`
- `npm run build`

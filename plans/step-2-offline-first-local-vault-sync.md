# Step 2 — Offline-First Local Vault Sync (Service Worker & IndexedDB Caching)

## 1. Technical Concept
Enable browsing, local decryption, and queued uploads/deletions while completely disconnected from the network. Uses a browser Service Worker to intercept API requests and serve vault structures cached in IndexedDB.

```
[UI Component] ◀──▶ [Service Worker] ◀──(Intercept)──▶ [IndexedDB Cache]
                            │
                    (Network Restored)
                            │
                            ▼
                    [Go API Endpoint] (Replay Actions & Resolve Conflicts)
```

---

## 2. Cryptographic Architecture
1. **Local Master Key Cache:**
   - The user's derived master private key envelope is cached in memory (`sessionStorage`) while the tab is active.
   - Decrypted file list metadata is stored in IndexedDB, encrypted with a secondary database key derived from the user's PIN using PBKDF2.
2. **Offline Actions Queue:**
   - Queued uploads are stored as encrypted blobs in IndexedDB.
   - Actions (create folder, rename, delete) are appended to a local JSON conflict log.
3. **Conflict Resolution:**
   - Each file version is signed with a SHA-256 hash of its ciphertext. When syncing back online, the client matches parent hash logs to determine edit branches.

---

## 3. Implementation Plan

### Go Backend (Version Auditing)
- **Database Schema Updates:**
  - Add `parent_hash VARCHAR(64)` column to `files` table to maintain ancestor history.
- **API Endpoints:**
  - `POST /api/v1/files/sync` — Accepts a batch of actions from the offline queue. Compares parent hashes and rejects/auto-merges conflicts.

### React Frontend (Sync Engine)
- **Service Worker (`sw.js`):**
  - Intercepts `/api/files` requests. If offline, returns the latest JSON structure cached in IndexedDB.
- **IndexedDB Coordinator:**
  - Integrates a store queue manager for encrypted offline file blobs.
- **Offline UX Banner:**
  - Glassmorphic top-banner (yellow/amber glow) indicating "Offline Mode — Changes will sync when connection is restored."
  - "Syncing..." micro-animations using Framer Motion when connection returns.

---

## 4. Downstream Branding Adaptation
- **QuantiX:** Cyan neon offline banner. Pulse glows yellow when sync runs.
- **ABRN:** High-contrast clean white and burgundy offline indicator badge inside the navigation bar.

---

## 5. Verification & Test Plan
- **Service Worker Intercept Test:** A Vitest simulation verifying that the client IndexedDB correctly falls back and returns file lists when network fetch rejects.
- **Offline Upload Playwright Test:**
  1. Boot E2E test.
  2. Simulate network disconnect (using Playwright network throttling/offline mode).
  3. Drag-and-drop a file to upload. Verify it shows in the files list with a "Pending Sync" badge.
  4. Restore network.
  5. Verify the file uploads automatically and changes status to "Synched".

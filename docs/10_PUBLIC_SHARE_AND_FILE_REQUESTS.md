# Public Share + File Requests — Feature Documentation

**Date:** March 15, 2026  
**Commit:** `e8033a4`  
**Status:** Complete and deployed

---

## Overview

Two features shipped in this session:
1. **Public file share** — already existed but had critical UX and security gaps, now fully polished
2. **Inbound file requests** — schema existed since migration 011, now fully built end-to-end

---

## 1. Public Share Links

### What It Does

The owner generates a public share link for any file in their vault. Anyone with the link can download and decrypt the file directly in their browser, with no account required. The link expires after 7 days by default.

### How It Works (full flow)

**Generating the link:**
1. Owner clicks "Create Share Link" on a file → `CreateShareLinkModal` opens
2. Owner selects expiry (1 day / 3 days / 7 days / 30 days / custom date — default 7 days)
3. Owner enters PIN (or password for password-encrypted files)
4. Modal decrypts the file's AES key client-side using the PIN/password
5. Exports AES key as base64, POSTs `{ expires_at }` to `POST /api/files/{id}/share-link`
6. Backend creates a record in `public_share_links` with a 64-char random token
7. Modal displays the full URL: `https://<domain>/share/<token>#<base64AESkey>`
8. Key is embedded in the URL fragment — never reaches any server

**Downloading (recipient flow):**
1. Recipient opens the URL — `PublicSharePage.tsx` at `/share/:token`
2. Page loads `GET /api/share/{token}/info` → receives `{ filename, file_size, expires_at, owner_display_name, owner_organization }` — **no file bytes served**
3. Page shows a file info card: name, size, expiry date, "Shared by [Name] · [Organization]"
4. Recipient clicks **Download File**
5. Page fetches `GET /api/share/{token}` — receives the encrypted bytes
6. Page reads the AES key from `window.location.hash`
7. Decrypts with AES-256-GCM in the browser's SubtleCrypto
8. Triggers file download — owner's plaintext file is saved

### Security Properties

| Property | Detail |
|----------|--------|
| Key never on server | AES key lives only in URL fragment and browser memory |
| Time-limited | Links expire after 7 days (or custom — as low as 1 day) |
| Revocable | Owner can revoke any active share link at any time |
| Access-tracked | `access_count` and `last_accessed_at` updated on every download |
| Zero server knowledge | Server serves encrypted bytes; key is never transmitted to it |

### Backend Endpoints

| Endpoint | Auth | Purpose |
|----------|------|---------|
| `POST /api/files/{fileId}/share-link` | JWT | Create share link |
| `GET /api/share/{token}/info` | None | Get file metadata (no bytes) |
| `GET /api/share/{token}` | None | Download encrypted file |
| `GET /api/files/{fileId}/share-links` | JWT | List links for a file |
| `DELETE /api/share-links/{linkId}` | JWT | Revoke link |

### Files Changed

| File | Change |
|------|--------|
| `handle_public_share_links.go` | Added `handlerGetPublicShareLinkInfo` |
| `main.go` | Registered `GET /api/share/{token}/info` route |
| `vaultdrive_client/src/pages/PublicSharePage.tsx` | Full redesign: info-first, explicit download button, 6 states |
| `vaultdrive_client/src/components/vault/CreateShareLinkModal.tsx` | Fixed hardcoded URL; added expiry picker; pass expires_at |

---

## 2. File Requests (Inbound File Collection)

### What It Does

The owner creates a "file request" — a link they can send to anyone asking them to upload specific files. The requester opens the link, sets a download passphrase, selects files, and they are encrypted and uploaded. The owner finds the files in their vault.

### How It Works (full flow)

**Creating a request (owner):**
1. Owner opens "File Requests" in the vault sidebar (VaultTree → "Manage")
2. `FileRequestsSection` shows existing requests and a "Create New Request" button
3. Owner enters optional description ("Please send Q1 reports"), selects expiry (default: 7 days)
4. POSTs `{ description, expires_at }` to `POST /api/file-requests`
5. Backend creates a record in `file_requests` table with a 48-byte random token
6. Section shows the request URL: `https://<domain>/request/<token>`
7. Owner copies and sends this URL to whoever needs to send files

**Uploading (requester flow):**
1. Requester opens `/request/<token>` — `FileRequestPage.tsx`
2. Page loads `GET /api/file-requests/{token}/info` → shows owner identity + description
3. Requester enters a download passphrase (this must be communicated to owner separately)
4. Requester selects files (drag/drop or click)
5. For each file:
   - `generateSalt()` → 16 random bytes
   - `deriveKeyFromPassword(passphrase, salt, 100000)` → AES-256-GCM key
   - Encrypt file with AES-GCM, random IV
   - POST multipart to `POST /api/file-requests/{token}/upload`:
     - `file` — encrypted bytes
     - `iv` — base64 IV
     - `algorithm` — encryption algorithm metadata
     - `pin_wrapped_key` — base64(salt) — lets owner reconstruct key from passphrase
6. Backend: saves to `uploads/` directory, creates `files` table record (owner_id = request owner), updates `file_requests.uploaded_files` JSONB, logs activity
7. Requester sees receipt with file list, timestamp, "Remember your download password" reminder

**Owner accessing uploaded files:**
- Files appear in the owner's vault (Files section) with the passphrase in `pin_wrapped_key` encoded as salt
- Owner opens file → enters the passphrase communicated by requester → file decrypts

### Encryption Design

Files uploaded via requests use passphrase-derived encryption (PBKDF2, 100,000 iterations, AES-256-GCM). The `pin_wrapped_key` field stores the base64-encoded salt. To decrypt:
1. Owner enters the shared passphrase
2. System reads salt from `pin_wrapped_key`
3. Derives same AES key: `PBKDF2(passphrase, salt, 100000)`
4. Decrypts file

This matches the existing salt-based encryption path in the vault's file download handler.

### Backend Endpoints

| Endpoint | Auth | Purpose |
|----------|------|---------|
| `POST /api/file-requests` | JWT | Create request |
| `GET /api/file-requests` | JWT | List owner's requests |
| `DELETE /api/file-requests/{id}` | JWT | Revoke request |
| `GET /api/file-requests/{token}/info` | None | Public metadata |
| `POST /api/file-requests/{token}/upload` | None | Public upload |

### Files Created/Changed

| File | Change |
|------|--------|
| `handle_file_requests.go` | New file — full CRUD + public upload handler |
| `main.go` | 5 new routes registered |
| `vaultdrive_client/src/pages/FileRequestPage.tsx` | New — public upload page at `/request/:token` |
| `vaultdrive_client/src/components/vault/FileRequestsSection.tsx` | New — management panel |
| `vaultdrive_client/src/components/vault/VaultTree.tsx` | Added "File Requests" section |
| `vaultdrive_client/src/pages/files.tsx` | Handle `manage-requests` tree node |
| `vaultdrive_client/src/App.tsx` | Added `/request/:token` public route |

---

## DB State

The `file_requests` table (migration 011) and all supporting sqlc-generated code was already present. No new migrations were needed for this session.

---

## Known Limitations

1. **Passphrase must be communicated out-of-band** — There is no server-side mechanism to deliver the decryption passphrase to the owner. Owner must share passphrase with the requester before they upload (e.g., "use password: summer2026").

2. **No file_requests folder targeting** — Uploaded files land in the owner's root file list (no `folder_id` in the files schema). The owner sees them in "All Files."

3. **One passphrase per request session** — All files in a single upload session share the same passphrase. Requester can't use different passwords per file.

# TICKET-2026-11-15-AGENT-ZK-CRYPTO-PARITY — End-to-End Zero-Knowledge Crypto Parity for Agents & Programs (`v25-agent-zk-crypto-parity`)

- **Ticket ID:** `TICKET-2026-11-15-AGENT-ZK-CRYPTO-PARITY`
- **Build ID:** `v25-agent-zk-crypto-parity`
- **Status:** `COMPLETED (VERIFIED)`
- **Date Opened:** `2026-11-15`
- **Target Scope:** `/lamp/www/ABRN-Drive` (Go backend `/api/v1/` + React/WebCrypto client `vaultdrive_client/src/`)
- **Service Boundary:** Zero edits/restarts to `abrndrive.service`; all DB tests run against isolated `abrn_coherence_test`.

---

## 1. Problem Statement & Recon Evidence

Today an external AI agent or automation script cannot cleanly perform end-to-end zero-knowledge encryption/decryption with ABRN Drive:

1. **No `/api/v1/` public-key lookup:** Only JWT routes `/api/auth/public-key` and `/api/users/{id}/public-key` exist (`main.go`). Programmatic callers with `abrnak_` keys cannot fetch the vault owner's RSA-OAEP SPKI public key or verify collaborator public keys.
2. **`handlerV1CreateFile` (`handle_v1_core.go:71-148`) crypto & upload gaps:**
   - Hardcodes `FolderID: uuid.NullUUID{}` even when `folder_id` is passed.
   - Caps `ParseMultipartForm` at `10 << 20` (10 MB) instead of streaming larger encrypted blobs cleanly.
   - Always writes `file_access_keys` with `UserID: user.ID` even when `credential_scheme == "folder"`, breaking folder-key access.
   - Does not validate `iv` / `algorithm` / `wrapped_key` coherence when an external agent uploads encrypted bytes.
3. **`handlerV1DownloadFile` (`handle_v1_core.go:182-208`) broken key & collaborator parity:**
   - Unlike legacy `handlerDownloadFile` (`handle_file_download.go:64-90`), `/api/v1/files/{id}/download` does NOT check `GetFolderShare` for shared folders and does NOT fall back to the folder's wrapped key in `file_access_keys`.
   - Collaborators receive `403`, and owners of `credential_scheme: "folder"` files receive an empty `X-Wrapped-Key` header.
4. **No `/api/v1/files/shared` endpoint:** Dedicated bot accounts that are shared into someone else's files cannot list those shared files over `/api/v1/`.
5. **Web Client breaks when an agent uploads with `credential_scheme: "rsa"`:**
   - `files.tsx:2233` (`handleDownloadFile`) and `preview.worker.ts:227-257` only run `unwrapKeyWithRSA` when `file.is_owner === false`. When an external agent encrypts with the owner's public key and uploads (`credential_scheme: "rsa"`), `file.is_owner` is `true`, so the web UI falls into password/PBKDF2 decryption and fails!
   - `file-credential.ts` treats `rsa` only for non-owners instead of respecting explicit `metadata.credential_scheme === "rsa"`.

---

## 2. Requirements (`REQ-01` .. `REQ-05`)

1. **`REQ-01-V1-PUBLIC-KEY-DISCOVERY`:**
   - Add `GET /api/v1/users/me/public-key` (requires `files:upload_ciphertext` or `files:read_metadata`) returning `{ user_id, email, public_key, kek_envelope_version }`.
   - Add `GET /api/v1/users/{id}/public-key` (requires `shares:create` or `files:read_metadata`) returning `{ user_id, email, public_key }`.
   - Include owner `public_key` inside `GET /api/v1/agent/auth/introspect`.
2. **`REQ-02-V1-UPLOAD-CRYPTO-PARITY`:**
   - Update `handlerV1CreateFile` (`POST /api/v1/files/upload`):
     - Support `folder_id` ownership verification & attachment.
     - Accept explicit `credential_scheme` (`"rsa"`, `"folder"`, `"pin"`, `"password"`); validate required `iv`, `algorithm`, and `wrapped_key` when `wrapped_key` or `credential_scheme: "rsa"` / `"folder"` is supplied; store normalized metadata JSON consistently with legacy `handlerCreateFiles`.
     - Route `file_access_keys` target to `folderID` when `credential_scheme == "folder"` and `user.ID` otherwise.
     - Raise multipart memory threshold cleanly (`32 << 20`, spooling larger streams to disk without corrupting ciphertext).
3. **`REQ-03-V1-DOWNLOAD-SHARED-KEY-PARITY`:**
   - Fix `handlerV1DownloadFile` (`GET /api/v1/files/{id}/download`):
     - Authorize owner OR explicit `GetFileShare` OR `GetFolderShare` collaborator.
     - Lookup wrapped key by requester ID first, then owner ID / folder ID fallback matching `handle_file_download.go`.
   - Add `GET /api/v1/files/shared` (requires `files:list`) returning files shared with the caller (via direct share or folder share) with pagination & wrapped keys.
4. **`REQ-04-WEB-CLIENT-OWNER-RSA-DECRYPT`:**
   - Update `vaultdrive_client/src/utils/file-credential.ts`, `pages/files.tsx`, `workers/preview.worker.ts`, `utils/access-link-recovery.ts`, and `utils/folder-share.ts`:
     - When `metadata.credential_scheme === "rsa"`, classify the credential scheme accurately and unwrap the DEK via the user's RSA private key (`sessionVault.getPrivateKey()` or unlocking `private_key_pin_encrypted` / `encrypted_private_key`) even when `is_owner === true`.
5. **`REQ-05-AUTOMATED-VERIFICATION`:**
   - Go integration tests verifying: public-key discovery -> client-side RSA-OAEP + AES-256-GCM simulated agent upload (`credential_scheme: "rsa"`) -> download header parity -> RSA private-key unwrap; folder-scheme upload/download; shared-folder collaborator download + `/api/v1/files/shared`.
   - Frontend Vitest tests verifying `getFileCredentialScheme`, owner-RSA decryption classification, and zero regressions across all existing suites.

---

## 3. Acceptance Criteria

- Agent uploads file encrypted with owner's RSA public key (`credential_scheme: "rsa"`), receives valid v1 response with `folder_id`, and both agent (with private key) and human web UI (with PIN/SessionVault unlock) decrypt the exact plaintext SHA-256.
- Collaborator agent on a shared folder downloads ciphertext + valid `X-Wrapped-Key` via `/api/v1/files/{id}/download`.
- All Go tests and Vitest suites pass cleanly.

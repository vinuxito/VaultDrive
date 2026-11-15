# TICKET-2026-11-15-ZK-TYPESCRIPT-SDK-PORTAL-DOCS-SYNC — Zero-Knowledge TypeScript SDK, WebCrypto Helpers & Portal/Docs Sync (`v29-zk-typescript-sdk-portal-docs-sync`)

- **Ticket ID:** `TICKET-2026-11-15-ZK-TYPESCRIPT-SDK-PORTAL-DOCS-SYNC`
- **Build ID:** `v29-zk-typescript-sdk-portal-docs-sync`
- **Status:** `COMPLETED (VERIFIED)`
- **Date Opened:** `2026-11-15`
- **Target Scope:** `/lamp/www/ABRN-Drive` (`sdk/`, `docs/agent-api.md`, `vaultdrive_client/src/components/settings/{AgentDeveloperPortalSection,ApiSimulationSection}.tsx`)

---

## 1. Problem Statement & Recon Evidence

1. **`sdk/client.ts` bugs & missing capabilities:**
   - Types `error?: string`, whereas `json_v1.go` emits `error: { code?, message }` -> errors stringify as `[object Object]`.
   - Still branded purely `QuantixClient` with QuantiX URLs and covers only ~8 endpoints (no uploads, folder creation/listing, folder move, shared files/folders, share links, file requests/drops, soft-delete, public-key lookup, idempotency keys, or 429 retry-after handling).
   - Zero client-side WebCrypto helpers -> developers/bots have to hand-roll AES-256-GCM + RSA-OAEP SPKI/PKCS8 wrapping, IV encoding, and header serialization from scratch.
2. **Portal & Documentation Drift:**
   - `docs/agent-api.md` still shows legacy QuantiX branding and omits RSA owner encryption, Special Delete-Only keys, folder jailing, and new endpoints.
   - `AgentDeveloperPortalSection.tsx` and `ApiSimulationSection.tsx` must match live ABRN Drive endpoints, scopes (`abrnak_`, `abrnak_del_`), and SDK usage.

---

## 2. Requirements (`REQ-01` .. `REQ-04`)

1. **`REQ-01-SDK-CLIENT-V2`:**
   - Upgrade `sdk/client.ts` exporting `AbrnDriveClient` (with backward-compatible `QuantixClient` alias), typed `AbrnApiError` (`status`, `code`, `message`, `requestId`), `Idempotency-Key` helper option, automatic `429` `Retry-After` backoff option, and complete methods for all `/api/v1/` endpoints (including public keys, shared files/folders, move, share links, file requests, drops, templates, child keys, audit, and `softDeleteFile`/`softDeleteFolder` for delete-only keys).
2. **`REQ-02-SDK-WEBCRYPTO-MODULE`:**
   - Add `sdk/crypto.ts` (standard WebCrypto `globalThis.crypto.subtle`, zero external crypto deps, runs identically in Node 20+/22+ and browsers):
     - `generateBotRsaKeyPair`, `importRsaPublicKeySpki`, `importRsaPrivateKeyPkcs8`
     - `encryptBytesAesGcm`, `decryptBytesAesGcm`, `wrapKeyRsaOaep`, `unwrapKeyRsaOaep`
     - High-level workflows:
       - `encryptAndUploadForOwner(client, { filename, data, folderId, mimeType })`
       - `downloadAndDecryptWithPrivateKey(client, fileId, privateKey)`
       - `decryptFolderKeyWithPrivateKey` & `encryptAndUploadWithFolderKey`
       - SHA-256 helpers (`sha256Hex`)
   - Update `sdk/index.ts` and `sdk/example.ts`.
3. **`REQ-03-SDK-E2E-TEST-SUITE`:**
   - Add runnable Vitest/Node test suite verifying SDK error parsing, 429 backoff, Idempotency-Key propagation, and live roundtrip against a real Go `httptest` / test backend (RSA encrypt+upload -> download+decrypt bit-for-bit match, standard-key delete blocked, `abrnak_del_` soft-delete + human JWT restore).
4. **`REQ-04-PORTAL-AND-DOCS-SYNC`:**
   - Update `docs/agent-api.md`, `AgentDeveloperPortalSection.tsx`, and `ApiSimulationSection.tsx` cleanly to reflect ABRN Drive URLs, Special Delete-Only Key workflow, Folder Jailing, and WebCrypto SDK snippets.

---

## 3. Acceptance Criteria

- SDK cleanly parses `{ error: { code, message } }` into readable `AbrnApiError` instances (never `[object Object]`).
- Full WebCrypto upload->download roundtrip in automated tests matches plaintext SHA-256 100%.
- `docs/agent-api.md`, Portal, and Simulator match the actual running `/api/v1/` surface.

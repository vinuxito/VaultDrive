# ABRN Drive `/api/v1/*` Agent Contract Findings (from RGC PIPC SafeVault Integration)

**Date:** 2026-11-15  
**Observer:** External Zero-Knowledge Companion integration (`/lamp/www/rgconsulting/pipc`)  
**Type:** Contract & OpenAPI parity audit  
**Status:** Resolved (`2026-11-16` · Cuaderno `#29841`–`#29845`; verified in [`2026-11-16-v1-agent-contract-parity-verification.md`](../reports/2026-11-16-v1-agent-contract-parity-verification.md))

---

## 1. `GET /api/v1/auth/introspect`: `public_key` vs `owner_public_key` mismatch

* **Observed in Go server (`handle_agent_api_keys.go:328-330`):**
  ```go
  if publicKey != "" {
      data["public_key"] = publicKey
  }
  ```
* **Observed in SDK (`sdk/client.ts:123`):**
  ```ts
  export interface IntrospectResult {
    ...
    owner_public_key?: string;
  }
  ```
* **Impact:** SDK/external callers reading `data.owner_public_key` from `introspect` receive `undefined` and must either fall back to `GET /api/v1/users/me/public-key` or read `data.public_key`.
* **Suggested Fix:** Emit `"owner_public_key": publicKey` (optionally alongside `"public_key"` during transition) in `handlerAgentAuthIntrospect` so runtime matches `IntrospectResult` and integration docs.

---

## 2. `POST /api/v1/folders` & `PUT /api/v1/folders/{id}`: `parentId` vs `parent_id` OpenAPI discrepancy

* **Observed in Go handlers (`handle_v1_core.go:442-445`, `491-494`) and response struct (`handle_folders.go:12-17`):**
  ```go
  var req struct {
      Name     string `json:"name"`
      ParentID string `json:"parentId,omitempty"`
  }
  ```
  `FolderResponse` likewise serializes `"parentId"` and `"createdAt"` (whereas `handle_v1_trash_and_dataplane.go:416` uses `"parent_id"`).
* **Observed in OpenAPI generator (`docs_api.go:69`):**
  `"Requires folders:write. Supports optional parent_id and Idempotency-Key."`
* **Impact:** Any client generated from OpenAPI/Swagger that sends `{"name": "...", "parent_id": "<uuid>"}` has `ParentID` silently ignored (`""`), causing `POST /api/v1/folders` to target root (`403 folder_scope_denied` under a jailed key, or unexpected root creation under unjailed keys).
* **Suggested Fix:** Accept both `parentId` and `parent_id` when binding `POST/PUT /api/v1/folders` (preferring non-empty value if either is supplied) and align `docs_api.go` with the accepted field name.

---

## 3. `POST /api/v1/files/upload`: `Idempotency-Key` middleware is not attached

* **Observed in router wiring (`main.go:225-227`):**
  `POST /api/v1/files/upload` runs `middlewareActor("files:upload_ciphertext")(handlerV1CreateFile)` without `withV1Idempotency`, unlike `POST /api/v1/folders`, `PUT /api/v1/folders/{id}`, and `POST /api/v1/drop/create`.
* **Root constraint noted in `guardrails_v1.go:357`:** `withV1Idempotency` currently buffers up to `2 MiB` of raw `r.Body`, which would break/truncate multipart encrypted file uploads larger than 2 MiB if naively wrapped as-is.
* **Impact:** Retrying an ambiguous network timeout on `POST /api/v1/files/upload` with the same `Idempotency-Key` creates a second duplicate file row instead of replaying `X-Idempotency-Replayed: true`. Clients must reconcile `folder_id` contents / plaintext `sha256` metadata before retrying ambiguous upload timeouts.
* **Suggested Fix:** Add header/metadata-aware idempotency handling for `POST /api/v1/files/upload` (keyed on `(key_scope, idempotency_key)` + deterministic upload metadata digest / size rather than buffering multi-megabyte ciphertext in memory), or explicitly document in `docs_api.md` / `agent-api.md` which `/api/v1/*` endpoints participate in idempotency replay.

---

## 4. Cryptographic Cross-Parity Confirmed (`AES-256-GCM` + `RSA-OAEP SHA-256`)

* Verified live bidirectional compatibility between Python (`cryptography` 50.0.2 `AESGCM` + `OAEP(MGF1(SHA256()), SHA256())`) and `@abrn-drive/sdk` (`sdk/crypto.ts` on Node `v22.23.1` WebCrypto via `encryptAndUploadForOwner` and `downloadAndDecryptWithPrivateKey`), including PKCS#8 and PKCS#1 private key unwrapping and plaintext SHA-256 verification.

---

## 5. `POST /api/v1/drop/create`: Raw `sql.NullTime`/`sql.NullInt32` JSON & Relative `upload_url`

* **Observed in Go handler (`handle_drop.go:748-760`):**
  ```go
  uploadURL := fmt.Sprintf("%sdrop/%s#key=%s", cfg.Product.BasePath, dropToken, randomKey)
  ...
  "expires_at": uploadToken.ExpiresAt,
  "max_files":  uploadToken.MaxFiles,
  "upload_url": uploadURL,
  ```
* **Impact:**
  1. `uploadToken.ExpiresAt` and `uploadToken.MaxFiles` serialize Go's `database/sql` structs (`{"Time": "...", "Valid": bool}` and `{"Int32": N, "Valid": bool}`) inside `data` rather than clean RFC3339 `string | null` and `integer | null`.
  2. When `cfg.Product.BasePath` is configured as a relative path prefix (e.g., `"/abrn/"` or `"/"`), `upload_url` lacks scheme/host unless resolved against the caller's origin.
* **Suggested Fix:** Emit plain `*string` (RFC3339 or `null`) and `*int32` (`number` or `null`) in the v1 `data` payload, and document whether `upload_url` may be relative to the public web root.

---

## 6. `POST /api/v1/drop/create`: `pin` Field Validates Owner's Account Master PIN & Triggers Lockout (Confirmed Live)

* **Confirmed live against `https://abrndrive.filemonprime.net/abrn/api` on 2026-11-15:**
  - Sending `"pin": "4821"` with a valid `agent_api_key` returned **`HTTP 401 unauthorized: Incorrect PIN`**.
  - Sending the request **without `pin`** returned **`HTTP 201 Created`** (`"pin_protected": false`, valid `#key=` drop URL returning `HTTP 200 OK`).
  - Live `POST /api/v1/files/upload` also confirmed Finding #3 in production: retrying the same `Idempotency-Key` produced two distinct file UUIDs (`replayed = false`) because `withV1Idempotency` is omitted on that route.
* **Observed in Go handler (`handle_drop.go:652-701`) vs SDK (`sdk/client.ts:567`) vs MCP (`mcp/server.ts:267-283`):**
  - `handlerCreateDropTokenWithUser` validates `req.Pin` against `owner.PinHash` (the vault owner's personal 4-digit master PIN) and increments `users.pin_failed_attempts` (5 strikes = 15-minute `pin_locked_until` lockout).
  - `mcp/server.ts` already omits `pin` from `abrn_create_drop_token`, whereas `sdk/client.ts:567` (`pin?: string`) still exposes it without warning.
* **Impact:** Any downstream integration mistaking `pin` for a *per-drop uploader passcode* sends a client PIN, receives `401 Incorrect PIN`, and risks locking out the vault owner's account while tempting automation UIs to ask for the user's master PIN.
* **Suggested Fix:** Explicitly forbid/reject `pin` on `agent_api_key` calls in `handle_drop.go` (matching the human-credential boundary) or deprecate/remove `pin` from `sdk/client.ts` `createDropToken` and document in `agent-api.md` that agent-created Secure Drop links are protected via cryptographic `#key=` fragment without master PINs.



# Session Memory — 2026-11-15 (`v25-v30-agent-api`: Zero-Knowledge Agent API, Recoverable Trash, Guardrails, SDK & MCP Server)

- **Date:** `2026-11-15`
- **Mission:** Implement, verify end-to-end, audit, and close out the 6-ticket AI & programmatic vault ecosystem roadmap ([`v25`](../../docs/tickets/archived/2026-11-15-ticket-v25-agent-zk-crypto-parity.md) through [`v30`](../../docs/tickets/archived/2026-11-15-ticket-v30-abrn-drive-mcp-server.md)) inside `/lamp/www/ABRN-Drive`, preserving strict zero-knowledge guarantees, human-JWT-only Governance, non-destructive Special Delete-Only (`abrnak_del_`) Recoverable Trash, recursive Folder Jails, IP/CIDR allowlists, per-key rate limits, idempotent retries, the `@abrn-drive/sdk` WebCrypto SDK, and the `@abrn-drive/mcp` stdio MCP server.
- **Starting State:** Clean `v24-la-viejita-human-reality` checkpoint on `main`; production `abrndrive.service` active and isolated from dev/test databases.
- **Service Safety Invariant:** Zero edits, reloads, or restarts to production `abrndrive.service`, and zero mutations to production PostgreSQL database `vaultdrive`. All Go, SDK, MCP, and browser E2E runs executed strictly against isolated database `abrn_coherence_test` and an ephemeral verification server (`127.0.0.1:18082/abrn`) that was stopped and cleaned up (`/tmp/abrn-verify-*` deleted) after capture.

---

## 1. Security & Product Mandates Enforced

1. **Governance Remains Human-JWT-Only:** `GET/PUT /api/v1/governance/settings` rejects agent API keys with `403 human_jwt_required`.
2. **Standard Agent Keys (`abrnak_`) Cannot Delete:** `DELETE /api/v1/files/{id}`, `DELETE /api/v1/folders/{id}`, and `delete` actions inside `POST /api/v1/files/sync` reject standard keys with `403 delete_key_required`.
3. **Special Delete-Only Key (`abrnak_del_`) + 100% App-Controlled Recoverable Trash:**
   - Only a human JWT session can mint or revoke a `key_kind = 'delete_only'` key carrying exclusive scope `files:soft_delete`.
   - `abrnak_del_` keys cannot read, list, upload, download, share, or mint child keys (`api_keys:write` denied), and never remove ciphertext files from disk (`handlerFileDelete` remains unchanged for Trash hard purge only).
   - Every agent deletion marks `deleted_at = NOW()` (`deleted_by_actor_type = 'agent_delete_key'`, `deleted_by_key_id`, `deleted_reason`) so ciphertext and `file_access_keys` remain intact. Only the human vault owner via JWT can view `/api/trash`, restore items (`POST /api/trash/{files,folders}/{id}/restore`), or permanently purge (`DELETE /api/trash/{files,folders}/{id}`).
4. **No Passwords/PINs in `@abrn-drive/mcp`:** Fails fast without echoing secrets if `ABRN_PASSWORD` or `ABRN_PIN` is set, and strictly routes destructive tools (`abrn_soft_delete_file`, `abrn_soft_delete_folder`) to a separate `ABRN_DELETE_API_KEY`.

---

## 2. Files Added & Modified

### Database Schema & SQLC Queries
- [`sql/schema/051_agent_keys_and_recoverable_trash.sql`](/lamp/www/ABRN-Drive/sql/schema/051_agent_keys_and_recoverable_trash.sql): Adds `key_kind` (`'standard' | 'delete_only'`) on `agent_api_keys` and `deleted_at`, `deleted_by_actor_type`, `deleted_by_key_id`, `deleted_reason` on `files` and `folders`.
- [`sql/schema/052_agent_key_guardrails.sql`](/lamp/www/ABRN-Drive/sql/schema/052_agent_key_guardrails.sql): Adds `allowed_folder_ids`, `allowed_ips`, `rate_limit_rpm` on `agent_api_keys`, plus `agent_idempotency_records`.
- `sql/queries/{agent_api_keys,files,files_drop_source,files_with_drop_source,file_tags,folder_shares,folders,groups,shares,upload_tokens,idempotency,trash}.sql` & generated `internal/database/*.go`.

### Go Backend (`/api/v1/`, Middleware, OpenAPI, Tests)
- [`handle_v1_crypto.go`](/lamp/www/ABRN-Drive/handle_v1_crypto.go) & [`handle_v1_core.go`](/lamp/www/ABRN-Drive/handle_v1_core.go): `GET /api/v1/users/me/public-key`, `GET /api/v1/users/{id}/public-key`, owner public key in `/api/v1/agent/auth/introspect`, folder attachment & `credential_scheme` validation (`rsa`, `folder`, `pin`, `password`) on upload, collaborator + folder fallback key lookup on download, `GET /api/v1/files/shared`.
- [`json_v1.go`](/lamp/www/ABRN-Drive/json_v1.go), [`main.go`](/lamp/www/ABRN-Drive/main.go), & [`docs_api.go`](/lamp/www/ABRN-Drive/docs_api.go): Structured `error: { code, message }` envelope (`respondWithV1ErrorCode`), wrapped `/api/v1/` compatibility routes, CORS `Idempotency-Key`, OpenAPI 3.0.3 spec across all 52 documented operations + `/api/v1/docs` & `/api/v1/openapi.json` aliases, and self-contained CSP-safe interactive OpenAPI explorer (replacing blocked external `unpkg.com` Swagger UI CDN).
- [`agent_api_keys.go`](/lamp/www/ABRN-Drive/agent_api_keys.go), [`handle_agent_api_keys.go`](/lamp/www/ABRN-Drive/handle_agent_api_keys.go), [`middleware_actor.go`](/lamp/www/ABRN-Drive/middleware_actor.go), & [`guardrails_v1.go`](/lamp/www/ABRN-Drive/guardrails_v1.go): 18 `allowedAgentScopes` (17 standard + exclusive `files:soft_delete`), `abrnak_` / `abrnak_del_` key minting & child attenuation, recursive folder jail, CIDR/IP allowlist, per-key RPM limiter (`1..600`), and `Idempotency-Key` replay / `409` conflict protection.
- [`handle_v1_trash_and_dataplane.go`](/lamp/www/ABRN-Drive/handle_v1_trash_and_dataplane.go) & legacy query callers: Agent soft-delete endpoints, human-JWT-only Trash list/restore/purge endpoints, folder share links, file move, file shares & revoke, `/api/v1/files/sync`, and Drop endpoints (`requests:create`, `requests:list`).
- [`agent_v1_crypto_test.go`](/lamp/www/ABRN-Drive/agent_v1_crypto_test.go), [`agent_v1_wire_openapi_test.go`](/lamp/www/ABRN-Drive/agent_v1_wire_openapi_test.go), [`agent_v1_trash_dataplane_test.go`](/lamp/www/ABRN-Drive/agent_v1_trash_dataplane_test.go), & [`agent_v1_guardrails_test.go`](/lamp/www/ABRN-Drive/agent_v1_guardrails_test.go).

### Frontend UI & WebCrypto Client (`vaultdrive_client/`)
- `vaultdrive_client/src/utils/{file-credential.ts,file-credential.test.ts,access-link-recovery.ts}`, `vaultdrive_client/src/pages/files.tsx`, & `vaultdrive_client/src/workers/preview.worker.ts`: Owner RSA-OAEP decryption parity when bots upload files with `credential_scheme: "rsa"`.
- [`TrashSection.tsx`](/lamp/www/ABRN-Drive/vaultdrive_client/src/components/vault/TrashSection.tsx) & [`TrashSection.test.tsx`](/lamp/www/ABRN-Drive/vaultdrive_client/src/components/vault/TrashSection.test.tsx): Human-controlled *Papelera recuperable* tab inside `/files` showing soft-deleted files/folders, deleting agent key badge + reason, Restore, and explicit Permanent Purge.
- `vaultdrive_client/src/components/settings/{AgentApiKeysSection.tsx,AgentApiKeysSection.test.tsx,AgentDeveloperPortalSection.tsx,AgentOperationsSection.tsx,agent-operations.ts,agent-operations.test.ts,ApiSimulationSection.tsx}`: Clear separation of standard automation keys (`abrnak_`) vs Special Delete-Only keys (`abrnak_del_`), folder jail / CIDR / RPM controls, live guardrail pills, denial telemetry badges, and updated developer portal/simulator.

### TypeScript SDK (`sdk/`), Official MCP Server (`mcp/`), Docs & Tickets
- [`sdk/package.json`](/lamp/www/ABRN-Drive/sdk/package.json), [`sdk/index.ts`](/lamp/www/ABRN-Drive/sdk/index.ts), [`sdk/client.ts`](/lamp/www/ABRN-Drive/sdk/client.ts), [`sdk/crypto.ts`](/lamp/www/ABRN-Drive/sdk/crypto.ts), [`sdk/example.ts`](/lamp/www/ABRN-Drive/sdk/example.ts), & [`sdk/sdk.test.ts`](/lamp/www/ABRN-Drive/sdk/sdk.test.ts): `@abrn-drive/sdk` v2.0.0 with `AbrnDriveClient` (`QuantixClient` alias), `AbrnApiError`, `Idempotency-Key` + `429 Retry-After` handling, native WebCrypto AES-256-GCM + RSA-OAEP helpers, and PKCS#1 `BEGIN RSA PRIVATE KEY` ASN.1 DER -> PKCS#8 wrapping.
- [`mcp/package.json`](/lamp/www/ABRN-Drive/mcp/package.json), [`mcp/server.ts`](/lamp/www/ABRN-Drive/mcp/server.ts), [`mcp/bin.ts`](/lamp/www/ABRN-Drive/mcp/bin.ts), [`mcp/README.md`](/lamp/www/ABRN-Drive/mcp/README.md), & [`mcp/mcp.test.ts`](/lamp/www/ABRN-Drive/mcp/mcp.test.ts): `@abrn-drive/mcp` v2.0.0 exposing 17 `abrn_*` stdio MCP tools (`Content-Length` and NDJSON framing).
- [`docs/agent-api.md`](/lamp/www/ABRN-Drive/docs/agent-api.md), archived tickets [`v25`–`v30`](../tickets/archived/2026-11-15-ticket-v25-agent-zk-crypto-parity.md), and 6 Chromium verification captures [`docs/tickets/evidence/01..06-*.png`](../tickets/evidence/01-vault-agent-decrypt.png).

---

## 3. Verification Outcomes

1. **Go Backend & OpenAPI Parity Suite:**
   - Command: `DB_URL="postgres://abrn_test:abrn_test_local@127.0.0.1:5432/abrn_coherence_test?sslmode=disable" /home/vinuxito/.cache/abrndrive-recovery/go/bin/go test -count=1 ./... && /home/vinuxito/.cache/abrndrive-recovery/go/bin/go vet ./...`
   - Outcome: **Exit `0`** (`ok github.com/vinuxito/VaultDrive 10.479s`), `go vet` clean.
2. **Frontend TypeScript, Vitest & Vite `/abrn/` Production Bundle:**
   - `cd vaultdrive_client && npm run typecheck`: **Exit `0`** (`0` errors).
   - `cd vaultdrive_client && npx vitest run --maxWorkers=2`: **Exit `0`** — **`Test Files 130 passed (130), Tests 613 passed (613)`** (`170.97s`). *(Note: unconstrained default workers previously caused 15ms microbenchmark timing jitter in pre-existing `src/utils/vault-search-index.test.ts:142`; runs cleanly under `--maxWorkers=2`.)*
   - `make build-frontend`: **Exit `0`** (`12.66s`, `frontend base verified: /abrn/`, `vaultdrive_client/dist/index.html` SHA-256: `ca0ec71dba8bef7833c5535f2c6e646c010fab7bf8d0724f2f7470c008b42f5a`).
3. **SDK & MCP Strict Compiler + Unit Tests:**
   - Strict `tsc --noEmit ... sdk/*.ts mcp/*.ts`: **Exit `0`**.
   - `npm --prefix sdk test`: **Exit `0`** (`4 tests, 3 passed, 0 failed, 1 skipped` when live-server env vars absent; `1451.50ms`).
   - `npm --prefix mcp test`: **Exit `0`** (`4 tests, 3 passed, 0 failed, 1 skipped` when live-server env vars absent; `2269.22ms`).
4. **Live Ephemeral Go Server E2E + Desktop Chromium (`bsk`) Browser Proof:**
   - Live SDK E2E against `127.0.0.1:18082/abrn/api`: **4/4 PASS** (`1633.78ms`) covering `auth_type="agent_api_key"`, `Idempotency-Key` replay, PKCS#1 RSA WebCrypto roundtrip, `403 delete_key_required`, `abrnak_del_` Trash soft-delete, `403 folder_scope_denied`, and `403 human_jwt_required` on Governance.
   - Live MCP subprocess E2E (`mcp/bin.ts` stdio): **4/4 PASS** (`3190.88ms`) covering `initialize`, `abrn_whoami`, `abrn_create_folder`, `abrn_upload_encrypted_file`, `abrn_download_and_decrypt_file`, `abrn_create_drop_token`, and `abrn_soft_delete_file`.
   - Desktop Chromium (`bsk` extension `0.5.0`, Chrome `157.0.0.0`) verified live browser RAM decryption of agent-uploaded file (`SHA-256: 9680ab4743ae6f5602868658c861c0d9d7e616c189fee81fc929b8a254a9f6a0`), *Papelera recuperable* restore flow, Settings `Advanced` Guardrail badges & denial telemetry, Developer Portal, and rebuilt `/abrn/api/v1/docs` OpenAPI explorer (`52 of 52 documented operations`, 3 component schemas) across screenshots [`01`–`06`](../tickets/evidence/06-swagger-docs.png).
5. **Post-Build Audit Manifest Validator:**
   - `python3 .agents/skills/resolucion-de-tickets-nivel-dios/scripts/check-post-build-audit.py docs/reports/2026-11-15-v25-v30-agent-api-audit.json --project /lamp/www/ABRN-Drive --build-id v25-v30-agent-api` verified cleanly (`PASS`).

---

## 4. Fixes Resolved During Verification & Final Verdict

1. **Swagger CDN Blocked by OWASP CSP & Missing `/api/v1/docs` Alias (`docs_api.go`, `main.go`):** `https://unpkg.com/swagger-ui-dist@5/...` was blocked by `script-src 'self' 'unsafe-inline'` in `middleware_security.go:17` and `/api/v1/docs` returned `404`. Replaced CDN scripts with a self-contained CSP-compliant OpenAPI 3.0.3 explorer and registered `/api/v1/docs` + `/api/v1/openapi.json` aliases.
2. **Server PKCS#1 RSA Private Key Import Failure in WebCrypto (`sdk/crypto.ts`):** `handle_user_create.go` mints `BEGIN RSA PRIVATE KEY` (PKCS#1) keys; WebCrypto `subtle.importKey('pkcs8', ...)` requires PKCS#8. Added deterministic ASN.1 DER `wrapPkcs1AsPkcs8` parity matching the frontend.
3. **Documentation & Scope Alignment (`docs/agent-api.md`):** Rebranded docs to ABRN Drive (`abrnak_` / `abrnak_del_`) and synchronized the documented scope catalog to the exact 18 `allowedAgentScopes` enforced in `agent_api_keys.go` (including `requests:create` and `requests:list` governing Secure Drops).

**Remaining Risks / Production Release Note:** Database migrations `051` and `052` are verified in `abrn_coherence_test` and ready for coordinated deployment via [`docs/runbooks/abrn-coherence-release.md`](../runbooks/abrn-coherence-release.md); `abrndrive.service` and production DB `vaultdrive` were intentionally left untouched.

**Verdict:** `SEGURO CONTINUAR`

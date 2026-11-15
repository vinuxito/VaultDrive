# Verification Report — `v25-v30-agent-api` (Zero-Knowledge Agent API, Special Delete-Only Key & Recoverable Trash, Guardrails, TypeScript SDK & MCP Server)

- **Tickets:** [`v25`](../tickets/archived/2026-11-15-ticket-v25-agent-zk-crypto-parity.md) · [`v26`](../tickets/archived/2026-11-15-ticket-v26-agent-v1-wire-openapi-sync.md) · [`v27`](../tickets/archived/2026-11-15-ticket-v27-recoverable-trash-delete-key-and-data-plane.md) · [`v28`](../tickets/archived/2026-11-15-ticket-v28-agent-key-guardrails-folder-jail-ip-rpm-idempotency.md) · [`v29`](../tickets/archived/2026-11-15-ticket-v29-zk-typescript-sdk-portal-docs-sync.md) · [`v30`](../tickets/archived/2026-11-15-ticket-v30-abrn-drive-mcp-server.md)
- **Build ID:** `v25-v30-agent-api`
- **Date:** `2026-11-15`
- **Frontend Bundle Seal (`vaultdrive_client/dist/index.html` SHA-256):** `ca0ec71dba8bef7833c5535f2c6e646c010fab7bf8d0724f2f7470c008b42f5a`
- **Frontend Base Seal (`make build-frontend`):** `/abrn/` (`frontend base verified: /abrn/`)
- **Service Safety Boundary:** Production `abrndrive.service` and production DB `vaultdrive` untouched. Isolated testing ran against `abrn_coherence_test` and an ephemeral verification server that was shut down and removed after capture.
- **Overall Verdict:** **PASS (`SEGURO CONTINUAR`)**

---

## 1. Executive Architecture Summary

| Milestone | Scope Delivered | Core Security / Functional Invariant Verified |
|---|---|---|
| **`v25` ZK Crypto Parity** | `/api/v1/users/{me,{id}}/public-key`, `/api/v1/files/shared`, upload `folder_id` + `credential_scheme` (`rsa`/`folder`/`pin`/`password`) validation, collaborator/folder wrapped-key download fallback, frontend owner-RSA decryption parity | Files uploaded by AI agents encrypted to owner SPKI public key decrypt cleanly in human browser RAM and via bot RSA private keys |
| **`v26` Wire & OpenAPI Sync** | Structured `error: { code, message }` in `json_v1.go`, `/api/v1/` envelope wrapping, CORS `Idempotency-Key`, OpenAPI 3.0.3 spec (`docs_api.go`) + CSP-compliant interactive explorer at `/docs/api` and `/api/v1/docs`, Go route-parity test | `TestOpenAPISpecMatchesRegisteredV1Routes` enforces 100% parity between `main.go` `/api/v1/` routes and OpenAPI paths |
| **`v27` Delete-Only Key & Recoverable Trash** | Migration `051`, `abrnak_del_` (`key_kind='delete_only'`, exclusive `files:soft_delete`), human-JWT-only Governance & Trash API (`/api/trash*`), vault data-plane `/api/v1/` routes (`folders`, `shares`, `move`, `sync`, `drop`), React *Papelera recuperable* & Settings key split | Governance strictly returns `403 human_jwt_required`; standard `abrnak_` keys return `403 delete_key_required`; `abrnak_del_` cannot read/write/mint keys and only soft-deletes into human-controlled Trash |
| **`v28` Per-Key Guardrails** | Migration `052`, recursive `allowed_folder_ids` jail + child attenuation, `allowed_ips` CIDR check, per-key `rate_limit_rpm` (`1..600`), `Idempotency-Key` replay (`X-Idempotency-Replayed: true`) & `409` conflict guard, Settings/Ops guardrail badges | Folder-jailed keys receive `403 folder_scope_denied` outside allowed subtrees; parent key guardrails attenuate child keys |
| **`v29` `@abrn-drive/sdk` & Portal Sync** | `@abrn-drive/sdk` v2.0.0 (`AbrnDriveClient`, `QuantixClient` alias, `AbrnApiError`, `Idempotency-Key`, `429 Retry-After`, WebCrypto AES-256-GCM + RSA-OAEP + PKCS#1->PKCS#8 DER wrapper), `docs/agent-api.md` (exact 18 scopes), Portal & Simulator updates | Live Go E2E proves PKCS#1 user RSA key + WebCrypto encryption/decryption parity with zero third-party crypto deps |
| **`v30` `@abrn-drive/mcp` Server** | `@abrn-drive/mcp` v2.0.0 stdio JSON-RPC 2.0 server (`mcp/server.ts`, `mcp/bin.ts`) with 17 `abrn_*` tools supporting NDJSON + `Content-Length` framing | Rejects `ABRN_PASSWORD` / `ABRN_PIN` immediately without leaking secrets; strictly isolates delete tools to `ABRN_DELETE_API_KEY` |

---

## 2. Cold Verification Matrix

| Check ID | Verification Gate | Command / Environment | Numerical Outcome | Status |
|---|---|---|---|---|
| `CHK-01` | Go Backend Suite + OpenAPI Parity | `DB_URL="postgres://abrn_test:abrn_test_local@127.0.0.1:5432/abrn_coherence_test?sslmode=disable" go test -count=1 ./... && go vet ./...` | Exit `0` — `ok github.com/vinuxito/VaultDrive 10.479s`; `go vet` clean | **PASS** |
| `CHK-02` | Frontend Strict TypeScript | `cd vaultdrive_client && npm run typecheck` | Exit `0` (`tsc -b && tsc -p tsconfig.e2e.json --noEmit`, `0` errors) | **PASS** |
| `CHK-03` | Full Frontend Vitest Suite | `cd vaultdrive_client && npx vitest run --maxWorkers=2` | Exit `0` — **`130/130` test files, `613/613` tests passed** (`170.97s`) | **PASS** |
| `CHK-04` | Frontend `/abrn/` Production Build | `make build-frontend` | Exit `0` (`12.66s`, `frontend base verified: /abrn/`, `dist/index.html` `ca0ec71d...42f5a`) | **PASS** |
| `CHK-05` | SDK & MCP Strict TypeScript | `./vaultdrive_client/node_modules/.bin/tsc --noEmit ... --strict ... sdk/*.ts mcp/*.ts` | Exit `0` (`0` errors across `sdk/*.ts` and `mcp/*.ts`) | **PASS** |
| `CHK-06` | SDK Unit Suite (`@abrn-drive/sdk`) | `npm --prefix sdk test` (`node --experimental-strip-types --test ./sdk.test.ts`) | Exit `0` — `3` unit suites passed (`0` failed, `1` live-server test skipped without env; `1451.50ms`) | **PASS** |
| `CHK-07` | MCP Unit Suite (`@abrn-drive/mcp`) | `npm --prefix mcp test` (`node --experimental-strip-types --test ./mcp.test.ts`) | Exit `0` — `3` unit suites passed (`0` failed, `1` live-server test skipped without env; `2269.22ms`) | **PASS** |
| `CHK-08` | Live Go E2E SDK Integration | Live Go verification server `127.0.0.1:18082/abrn/api` (`abrn_coherence_test`) | **`4/4` live suites PASS** (`0` failed, `0` skipped; `1633.78ms`) | **PASS** |
| `CHK-09` | Live Go E2E MCP Subprocess (`mcp/bin.ts`) | Live `mcp/bin.ts` stdio subprocess against `127.0.0.1:18082/abrn/api` | **`4/4` live suites PASS** (`0` failed, `0` skipped; `3190.88ms`) | **PASS** |
| `CHK-10` | Live Chromium (`bsk`) Browser & UI Proof | Real Chrome `157.0.0.0` (`bsk` ext `0.5.0`) on ephemeral `/abrn` (`01..06` captures) | Browser decrypts bot RSA ciphertext, Trash restores item (`3 -> 2`), Settings Guardrails + `/abrn/api/v1/docs` (`52/52` ops) clean | **PASS** |

---

## 3. Audit Findings Caught & Fixed (`FND-01` .. `FND-04`)

1. **`FND-01` (`HIGH` — Swagger UI CDN Blocked by OWASP CSP & Missing `/api/v1/docs` Route):** `docs_api.go` loaded `https://unpkg.com/swagger-ui-dist@5/...`, blocked by `script-src 'self' 'unsafe-inline'` in `middleware_security.go:17`, while `/api/v1/docs` returned `404`. **Fixed:** Replaced external scripts with a 100% self-contained interactive OpenAPI 3.0.3 explorer and registered `/api/v1/docs` and `/api/v1/openapi.json` aliases in `main.go` and `docs_api.go`, verified visually in Chromium ([`06-swagger-docs.png`](../tickets/evidence/06-swagger-docs.png)).
2. **`FND-02` (`HIGH` — PKCS#1 Private Key Import Failure in `sdk/crypto.ts`):** Server-generated user RSA keys in `handle_user_create.go` use PKCS#1 (`BEGIN RSA PRIVATE KEY`), whereas Node/browser `crypto.subtle.importKey('pkcs8', ...)` rejects raw PKCS#1 keys. **Fixed:** Added deterministic ASN.1 DER `wrapPkcs1AsPkcs8` in [`sdk/crypto.ts`](../../sdk/crypto.ts), verified by `4/4` live Go SDK + MCP E2E roundtrips.
3. **`FND-03` (`MEDIUM` — Stale QuantiX Branding & Incomplete Scope Docs in `docs/agent-api.md`):** Updated all docs/examples to ABRN Drive (`abrnak_` / `abrnak_del_`) and aligned the documented scope table to all 18 `allowedAgentScopes` in `agent_api_keys.go` (including `requests:create` and `requests:list` governing Secure Drops).
4. **`FND-04` (`LOW` — Unconstrained Worker Pool Timing Jitter in `vault-search-index.test.ts`):** Pre-existing `15ms` microbenchmark assertion experienced CPU contention under unconstrained Vitest parallelism; confirmed `130/130` suites (`613/613` tests) pass cleanly under `--maxWorkers=2`.

---

## 4. Visual Evidence Index (`docs/tickets/evidence/`)

- [`01-vault-agent-decrypt.png`](../tickets/evidence/01-vault-agent-decrypt.png): Browser RAM decryption of agent-uploaded file with matching plaintext `SHA-256`.
- [`02-papelera-trash.png`](../tickets/evidence/02-papelera-trash.png): *Papelera recuperable* showing soft-deleted items, agent badge/reason, and human-only restore confirmation.
- [`03-settings-agent-keys.png`](../tickets/evidence/03-settings-agent-keys.png): Settings Agent Keys displaying guardrail badges (`Carpeta limitada`, `60 req/min`, `Solo Papelera · 100% recuperable`) and denial telemetry.
- [`04-create-key-modal.png`](../tickets/evidence/04-create-key-modal.png): Create Key flow separating normal automation keys (`abrnak_`) from Special Delete-Only keys (`abrnak_del_`).
- [`05-developer-portal.png`](../tickets/evidence/05-developer-portal.png): Developer Portal with ABRN Drive endpoints, `@abrn-drive/sdk`, and MCP configuration.
- [`06-swagger-docs.png`](../tickets/evidence/06-swagger-docs.png): Self-contained CSP-safe `/abrn/api/v1/docs` explorer showing `52 of 52 documented operations`.

# Verification Report — `/api/v1/*` Agent Contract Parity & Cuaderno Resolution (`#29841`–`#29845`)

- **Tickets Closed (`abrn-drive`):** `#29841` · `#29842` · `#29843` · `#29844` · `#29845` (`5/5 fixed`, `0 pending`, `0 in_progress`)
- **Findings Specification:** [`2026-11-15-v1-agent-contract-parity-findings.md`](../plans/2026-11-15-v1-agent-contract-parity-findings.md)
- **Session Memory:** [`session-2026-11-16-v1-agent-contract-parity.md`](../memories/session-2026-11-16-v1-agent-contract-parity.md)
- **Date:** `2026-11-16`
- **Base Commit:** `4f805b8` (`origin/main`)
- **Frontend Bundle Seal (`vaultdrive_client/dist/index.html` SHA-256):** `89aaf7e727ac43d8d94e0817ee1d10588469c074595284f5b617d3e54727566c` (`frontend base verified: /abrn/`)
- **Service Safety Boundary:** `abrndrive.service` and production DB `vaultdrive` remained untouched. All tests and live E2E runs used isolated DB `abrn_coherence_test` and ephemeral server `127.0.0.1:18083`.
- **Overall Verdict:** **PASS (`SEGURO CONTINUAR`)**

---

## 1. Ticket Resolution Matrix (`#29841` .. `#29845`)

| Cuaderno ID | Finding / Scope | Root Cause Fixed | Proof & Files Changed | Status |
|---|---|---|---|---|
| **`#29841`** | `GET /api/v1/auth/introspect` `owner_public_key` parity | Introspect returned `public_key` while downstream agent integrations expected `owner_public_key`. Emits both identical fields cleanly. | `handle_agent_api_keys.go`, `sdk/client.ts`, `docs/agent-api.md`, `agent_v1_crypto_test.go`; verified in Go test + live `sdk.test.ts` | **FIXED** |
| **`#29842`** | `POST/PUT /api/v1/folders` `parent_id` + `parentId` compatibility | Handlers only bound `parentId` while v1 snake_case callers sent `parent_id`. Added shared `decodeV1FolderWriteRequest` accepting either and returning `400 validation_error` on conflict; normalized SDK inputs similarly. | `handle_v1_core.go`, `sdk/client.ts`, `docs_api.go`, `docs/agent-api.md`, `agent_v1_guardrails_test.go`, `sdk/sdk.test.ts` | **FIXED** |
| **`#29843`** | `POST /api/v1/files/upload` streaming-safe `Idempotency-Key` + `replayed` | Multipart upload skipped `Idempotency-Key` dedup/conflict guards and SDK ignored `X-Idempotency-Replayed: true`. Added unlimited-size streaming `io.ReadSeeker` SHA-256 + length-prefixed form hashing, atomic replay/conflict handling, and SDK `replayed` flag propagation. | `guardrails_v1.go`, `handle_v1_core.go`, `sdk/client.ts`, `sdk/crypto.ts`, `docs_api.go`, `docs/agent-api.md`, `agent_v1_guardrails_test.go`, `sdk/sdk.test.ts` (`2.5 MiB` test) | **FIXED** |
| **`#29844`** | `POST /api/v1/drop/create` nullable JSON fields & `upload_url` normalization | Raw `sql.NullTime`/`sql.NullInt32` leaked `{Time, Valid}` / `{Int32, Valid}` structs; mobile share sheet could concatenate raw relative `/...` URLs. Normalized backend response to `*time.Time` / `*int32` (`null` when unset) and resolved origin in `MobileFolderShareSheet.tsx`. | `handle_drop.go`, `vaultdrive_client/src/components/mobile/MobileFolderShareSheet.tsx`, `sdk/client.ts`, `docs_api.go`, `docs/agent-api.md`, `agent_v1_trash_dataplane_test.go`, `MobileFolderShareSheet.test.tsx` | **FIXED** |
| **`#29845`** | Forbid owner master `pin` on `agent_api_key` `POST /api/v1/drop/create` | Agent keys had no legitimate access to human master PINs yet could probe `users.pin_failed_attempts`. Blocked non-empty `pin` for `agent_api_key` actors with `403 human_jwt_required` before key gen or DB counter reads/writes, plus SDK client-side guard. | `handle_drop.go`, `sdk/client.ts`, `docs_api.go`, `docs/agent-api.md`, `agent_v1_trash_dataplane_test.go`, `sdk/sdk.test.ts` | **FIXED** |

---

## 2. Cold Verification Matrix (Final Source Tree)

| Check ID | Verification Gate | Command / Environment | Numerical Outcome | Status |
|---|---|---|---|---|
| `CHK-01` | Go Backend Suite & Vet | `DB_URL="postgres://abrn_test:abrn_test_local@127.0.0.1:5432/abrn_coherence_test?sslmode=disable" /home/vinuxito/.cache/abrndrive-recovery/go/bin/go test -count=1 ./... && go vet ./...` | Exit `0` — `ok github.com/vinuxito/VaultDrive 10.736s`; `go vet` clean (`OpenAPI parity`, `crypto`, `guardrails`, `trash/dataplane`, `drop` all green) | **PASS** |
| `CHK-02` | SDK & MCP Strict `tsc` | `./vaultdrive_client/node_modules/.bin/tsc --noEmit --target es2022 --module nodenext --moduleResolution nodenext --allowImportingTsExtensions --strict --skipLibCheck --typeRoots ./vaultdrive_client/node_modules/@types sdk/*.ts mcp/*.ts` | Exit `0` (`0` TypeScript errors across `sdk/*.ts` and `mcp/*.ts`) | **PASS** |
| `CHK-03` | Frontend Strict Typecheck | `npm --prefix vaultdrive_client run typecheck` (`tsc -b && tsc -p tsconfig.e2e.json --noEmit`) | Exit `0` (`0` TypeScript errors across app & E2E specs) | **PASS** |
| `CHK-04` | Full Frontend Vitest Suite | `npx vitest run --maxWorkers=2` (`cwd=/lamp/www/ABRN-Drive/vaultdrive_client`) | Exit `0` — **`130/130` test files, `613/613` tests passed** (`184.86s`, `0` failed, `0` skipped) | **PASS** |
| `CHK-05` | Production `/abrn/` Bundle & Seal | `make build-frontend && sha256sum vaultdrive_client/dist/index.html` | Exit `0` (`15.51s`, `frontend base verified: /abrn/`, `89aaf7e727ac43d8d94e0817ee1d10588469c074595284f5b617d3e54727566c`) | **PASS** |
| `CHK-06` | SDK Unit Suite (`@abrn-drive/sdk`) | `npm --prefix sdk test` (`node --experimental-strip-types --test ./sdk.test.ts`) | Exit `0` — `4` unit suites passed, `0` failed (`1` live test skipped without env; `1561.32ms`) | **PASS** |
| `CHK-07` | MCP Unit Suite (`@abrn-drive/mcp`) | `npm --prefix mcp test` (`node --experimental-strip-types --test ./mcp.test.ts`) | Exit `0` — `3` unit suites passed, `0` failed (`1` live test skipped without env; `2281.49ms`) | **PASS** |
| `CHK-08` | Live Ephemeral Go HTTP Parity + SDK E2E | Compiled Go binary on `127.0.0.1:18083/abrn/api` (`abrn_coherence_test`, isolated cwd) + `npm --prefix sdk test` | `LIVE_PARITY_HTTP_CHECKS=OK`; SDK **`5/5` passed, `0` failed, `0` skipped** (`1892.01ms`) | **PASS** |
| `CHK-09` | Live Ephemeral Go MCP Subprocess E2E | `npm --prefix mcp test` against ephemeral `127.0.0.1:18083/abrn/api` | **`4/4` passed, `0` failed, `0` skipped** (`3396.62ms`) | **PASS** |

---

## 3. Live Ephemeral Server Observations Caught & Verified

- Verified live `POST /abrn/api/v1/folders` returns existing `parentId` field in response body while accepting both `parent_id` and `parentId` on `POST` create and `PUT` move/update, returning `400 validation_error` on conflicting fields.
- Verified live `POST /abrn/api/v1/drop/create` requires `target_folder_id`, returns `403 human_jwt_required` when an agent API key supplies `pin`, and returns clean JSON `expires_at: null`, `max_files: null`, and `/abrn/drop/<token>#key=<secret>` when `pin` is omitted.
- Note on Vitest invocation context: running `npx vitest` from `/lamp/www/ABRN-Drive` root skips `vaultdrive_client/vite.config.ts` (`jsdom`), whereas running `npx vitest run --maxWorkers=2` inside `/lamp/www/ABRN-Drive/vaultdrive_client` executes the configured `jsdom` suite with `130/130` files (`613/613` tests) passing cleanly.

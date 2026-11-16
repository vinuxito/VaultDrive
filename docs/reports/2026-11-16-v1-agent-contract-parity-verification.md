# Verification Report — `/api/v1/*` Agent Contract Parity & Cuaderno Resolution (`#29841`–`#29845`)

- **Tickets Closed (`abrn-drive`):** `#29841` · `#29842` · `#29843` · `#29844` · `#29845` (`5/5 fixed`, `0 pending`, `0 in_progress`)
- **Findings Specification:** [`2026-11-15-v1-agent-contract-parity-findings.md`](../plans/2026-11-15-v1-agent-contract-parity-findings.md)
- **Session Memory:** [`session-2026-11-16-v1-agent-contract-parity.md`](../memories/session-2026-11-16-v1-agent-contract-parity.md)
- **Date:** `2026-11-16`
- **Deployed Commit (`BUILD_ID`):** `912893c6a4e5c3b87c5cb4e5f4f38c061981ef58` (from `4f805b8`)
- **Live Binary SHA-256 (`/usr/local/lib/abrndrive/abrndrive`):** `434582f4d257ba679f3c41d1c50565fa4f10f6a9aabfa23ecbdb53156f860887`
- **Live Frontend Bundle Seal (`dist/index.html` & `https://abrndrive.filemonprime.net/abrn/` SHA-256):** `23f46f6f5bc473953b152c0598df483fee337799cb2097612eda69dfc0173227` (`0B` delta)
- **Coherent Production Backup:** `/var/backups/abrndrive-release/20261116T002916Z-912893c6a4e5c3b87c5cb4e5f4f38c061981ef58`
- **Overall Verdict:** **PASS (`SEGURO CONTINUAR` — LIVE IN PRODUCTION)**

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

## 2. Cold Verification & Live Production Cutover Matrix

| Check ID | Verification Gate | Command / Environment | Numerical Outcome | Status |
|---|---|---|---|---|
| `CHK-01` | Go Backend Suite & Vet | `DB_URL="postgres://abrn_test:abrn_test_local@127.0.0.1:5432/abrn_coherence_test?sslmode=disable" /home/vinuxito/.cache/abrndrive-recovery/go/bin/go test -count=1 ./... && go vet ./...` | Exit `0` — `ok github.com/vinuxito/VaultDrive 10.736s`; `go vet` clean (`OpenAPI parity`, `crypto`, `guardrails`, `trash/dataplane`, `drop` all green) | **PASS** |
| `CHK-02` | SDK & MCP Strict `tsc` | `./vaultdrive_client/node_modules/.bin/tsc --noEmit --target es2022 --module nodenext --moduleResolution nodenext --allowImportingTsExtensions --strict --skipLibCheck --typeRoots ./vaultdrive_client/node_modules/@types sdk/*.ts mcp/*.ts` | Exit `0` (`0` TypeScript errors across `sdk/*.ts` and `mcp/*.ts`) | **PASS** |
| `CHK-03` | Frontend Strict Typecheck | `npm --prefix vaultdrive_client run typecheck` (`tsc -b && tsc -p tsconfig.e2e.json --noEmit`) | Exit `0` (`0` TypeScript errors across app & E2E specs) | **PASS** |
| `CHK-04` | Full Frontend Vitest Suite | `npx vitest run --maxWorkers=2` (`cwd=/lamp/www/ABRN-Drive/vaultdrive_client`) | Exit `0` — **`130/130` test files, `613/613` tests passed** (`184.86s`, `0` failed, `0` skipped) | **PASS** |
| `CHK-05` | SDK Unit Suite (`@abrn-drive/sdk`) | `npm --prefix sdk test` (`node --experimental-strip-types --test ./sdk.test.ts`) | Exit `0` — `4` unit suites passed, `0` failed (`1` live test skipped without env; `1561.32ms`) | **PASS** |
| `CHK-06` | MCP Unit Suite (`@abrn-drive/mcp`) | `npm --prefix mcp test` (`node --experimental-strip-types --test ./mcp.test.ts`) | Exit `0` — `3` unit suites passed, `0` failed (`1` live test skipped without env; `2281.49ms`) | **PASS** |
| `CHK-07` | Live Ephemeral Go HTTP Parity + SDK E2E | Compiled Go binary on `127.0.0.1:18083/abrn/api` (`abrn_coherence_test`, isolated cwd) + `npm --prefix sdk test` | `LIVE_PARITY_HTTP_CHECKS=OK`; SDK **`5/5` passed, `0` failed, `0` skipped** (`1892.01ms`) | **PASS** |
| `CHK-08` | Live Ephemeral Go MCP Subprocess E2E | `npm --prefix mcp test` against ephemeral `127.0.0.1:18083/abrn/api` | **`4/4` passed, `0` failed, `0` skipped** (`3396.62ms`) | **PASS** |
| `REL-01` | Release Installer Static & Unit Suite | `python3 -m py_compile ... && (cd deploy/release && python3 -m unittest -v test_release_installer.py)` | Exit `0` — **`14/14` passed** (`1.042s`) | **PASS** |
| `REL-02` | Coordinated Live Cutover (`912893c`) | `sudo /usr/bin/python3 -I /run/abrndrive-release-installer.py "$STAGE"` | Exit `0` — `abrndrive.service` active (MainPID `15591`); backup `20261116T002916Z-912893c6a4e5c3b87c5cb4e5f4f38c061981ef58`; `/ready` `version: 52`, `stored_files: 1187` | **PASS** |
| `REL-03` | Live Production HTTP & OpenAPI Parity | `curl /health`, `curl https://abrndrive.filemonprime.net/abrn/`, `/abrn/api/v1/openapi.json`, `/abrn/api/v1/docs` | `version: 912893c6a4e5c3b87c5cb4e5f4f38c061981ef58`; `index.html` SHA-256 `23f46f6f...0173227` (`0B` delta); `44` OpenAPI paths live (`200`) | **PASS** |
| `REL-04` | Real Chromium (`bsk`) Production UI & Docs | `bsk open https://abrndrive.filemonprime.net/abrn/` & `/abrn/api/v1/docs` | Live site & `ABRN Drive OpenAPI & Agent Zero-Knowledge Guide` rendered cleanly | **PASS** |

---

## 3. Observations Caught & Verified

- Verified live `POST /abrn/api/v1/folders` returns existing `parentId` field in response body while accepting both `parent_id` and `parentId` on `POST` create and `PUT` move/update, returning `400 validation_error` on conflicting fields.
- Verified live `POST /abrn/api/v1/drop/create` requires `target_folder_id`, returns `403 human_jwt_required` when an agent API key supplies `pin`, and returns clean JSON `expires_at: null`, `max_files: null`, and `/abrn/drop/<token>#key=<secret>` when `pin` is omitted.
- Note on Vitest invocation context: running `npx vitest` from `/lamp/www/ABRN-Drive` root skips `vaultdrive_client/vite.config.ts` (`jsdom`), whereas running `npx vitest run --maxWorkers=2` inside `/lamp/www/ABRN-Drive/vaultdrive_client` executes the configured `jsdom` suite with `130/130` files (`613/613` tests) passing cleanly.

# Session Memory — `2026-11-16` `/api/v1/*` Agent Contract Parity & Cuaderno Resolution (`#29841`–`#29845`)

- **Date:** `2026-11-16`
- **Mission:** Configure the `FC ABRN-Drive` Cuaderno de Guerra (`abrn-drive`) skill and out-of-repo credential storage, register all five actionable `/api/v1/*` agent contract parity findings from `docs/plans/2026-11-15-v1-agent-contract-parity-findings.md` (`#29841`–`#29845`), implement conservative server/SDK/frontend/docs fixes, verify via cold Go + TypeScript + Vitest + live ephemeral Go server SDK/MCP E2E suites, and close all five Cuaderno tickets with receipts.
- **Starting Head:** `4f805b8` (`origin/main`) · **Deployed Commit:** `912893c6a4e5c3b87c5cb4e5f4f38c061981ef58`
- **Service & DB Safety Boundary:** All automated unit/integration tests and the ephemeral verification server (`127.0.0.1:18083`) ran against isolated database `abrn_coherence_test`. After user authorization and clean push, commit `912893c6a4e5c3b87c5cb4e5f4f38c061981ef58` was promoted live onto `abrndrive.service` via [`deploy/release/release_installer.py`](../../deploy/release/release_installer.py) with coherent backup in `/var/backups/abrndrive-release/20261116T002916Z-912893c6a4e5c3b87c5cb4e5f4f38c061981ef58`.
- **Verdict:** **`SEGURO CONTINUAR` (LIVE IN PRODUCTION)**

---

## 1. Cuaderno de Guerra Integration (`FC ABRN-Drive` / `abrn-drive`)

- Installed workspace skill `.agents/skills/cuaderno-coder/SKILL.md` and local config skill copy outside tracked application secrets.
- Stored `URC_URL` and `URC_CODER_KEY` outside Git (`chmod 0600` under `~/.filemon/keys/abrn-drive-coder.env` and `~/.config/cuaderno-de-guerra/abrn-drive.env`), zero secret leakage in Git history.
- Registered and resolved all 5 tickets (`5/5 fixed`, `0 pending`, `0 in_progress`):
  - `#29841` — `GET /api/v1/auth/introspect` `owner_public_key` + `public_key` compatibility alias
  - `#29842` — `POST /api/v1/folders` & `PUT /api/v1/folders/{id}` `parent_id` + `parentId` input parity & conflict rejection
  - `#29843` — `POST /api/v1/files/upload` streaming-safe `Idempotency-Key` replay/conflict + SDK `replayed` propagation
  - `#29844` — `POST /api/v1/drop/create` clean JSON `null` (`*time.Time` / `*int32`) & `/...` web-root relative `upload_url` normalization
  - `#29845` — Forbid owner master `pin` on `agent_api_key` `POST /api/v1/drop/create` (`403 human_jwt_required` prior to PIN failure counter)

---

## 2. Files Changed

### Backend Go + OpenAPI (`ABRN Drive`)
- `handle_agent_api_keys.go` — `handlerAgentAuthIntrospect` emits both `data["owner_public_key"]` and compatibility alias `data["public_key"]`.
- `handle_v1_core.go` — Added shared `v1FolderWritePayload` and `decodeV1FolderWriteRequest` for `handlerV1CreateFolder` and `handlerV1UpdateFolder` accepting either `parent_id` or `parentId` (returning `400 validation_error` on conflicting values); wired `handlerV1CreateFile` to streaming multipart `Idempotency-Key` replay/conflict persistence.
- `guardrails_v1.go` — Extracted `resolveV1IdempotencyScope`, streaming `buildV1MultipartUploadIdempotencyHash` (full SHA-256 over `io.ReadSeeker` + rewind + length-prefixed multipart form fields), `tryReplayV1Idempotency`, and `recordAndFlushV1Idempotency`; refactored `withV1Idempotency` onto the shared helpers.
- `handle_drop.go` — Rejected `isAgentActor && strings.TrimSpace(req.Pin) != ""` immediately with `403 human_jwt_required` before key generation or `users.pin_failed_attempts` mutation; switched `expires_at` (`*time.Time`) and `max_files` (`*int32`) response fields from `sql.Null*` wrappers to JSON `null` / typed scalar values, with `/` fallback when `basePath == ""`.
- `docs_api.go` — Synchronized OpenAPI 3.0.3 route documentation for `/api/v1/auth/introspect`, `/api/v1/folders`, `/api/v1/files/upload`, and `/api/v1/drop/create`.

### SDK (`@abrn-drive/sdk`) & Frontend
- `sdk/client.ts` — Updated `IntrospectResult` (`owner_public_key`, `public_key`), added `normalizeFolderInput` with conflict detection across `parentId`/`parent_id`, extracted `parseV1SuccessResponse` to populate `replayed` from `X-Idempotency-Replayed: true`, typed `DropTokenRecord`, and enforced client-side fail-fast `AbrnApiError(403, "human_jwt_required")` when an `abrnak_` key supplies `pin` to `createDropToken`.
- `sdk/crypto.ts` — Propagated `replayed?: boolean` in `EncryptUploadClient`, `encryptAndUploadForOwner`, and `encryptAndUploadWithFolderKey`.
- `vaultdrive_client/src/components/mobile/MobileFolderShareSheet.tsx` — Normalized relative `/...` `data.upload_url` against `window.location.origin` (`fullDropUrl`) so mobile WhatsApp and clipboard actions emit complete URLs while keeping relative backend contracts intact.

### Documentation & Automated Tests
- `docs/agent-api.md` — Synced contract examples and compatibility notes for all 5 fixes.
- `docs/plans/2026-11-15-v1-agent-contract-parity-findings.md` — Marked resolved (`#29841`–`#29845`).
- `agent_v1_crypto_test.go`, `agent_v1_guardrails_test.go`, `agent_v1_trash_dataplane_test.go`, `sdk/sdk.test.ts` — Expanded cold unit and integration assertions for every ticket, including `2.5 MiB` streaming upload replay + byte-mutation `409 idempotency_conflict`, folder `parent_id` subtree jail/conflict checks, nullable Drop responses, and 6x bogus agent PIN brute-force protection.

---

## 3. Cold Verification Outcomes & Live Production Cutover

| Check | Command | Result |
|---|---|---|
| Go Test & Vet | `DB_URL="postgres://abrn_test:abrn_test_local@127.0.0.1:5432/abrn_coherence_test?sslmode=disable" /home/vinuxito/.cache/abrndrive-recovery/go/bin/go test -count=1 ./... && go vet ./...` | Exit `0` — `ok github.com/vinuxito/VaultDrive 10.736s`; `go vet` clean |
| SDK & MCP Strict `tsc` | `./vaultdrive_client/node_modules/.bin/tsc --noEmit --target es2022 --module nodenext --moduleResolution nodenext --allowImportingTsExtensions --strict --skipLibCheck --typeRoots ./vaultdrive_client/node_modules/@types sdk/*.ts mcp/*.ts` | Exit `0` (`0` errors) |
| Frontend Typecheck | `npm --prefix vaultdrive_client run typecheck` | Exit `0` (`tsc -b && tsc -p tsconfig.e2e.json --noEmit`) |
| Full Frontend Vitest | `npx vitest run --maxWorkers=2` (in `vaultdrive_client/`) | Exit `0` — **`130/130` files, `613/613` tests passed** (`184.86s`) |
| Live Go Server Parity & SDK E2E | Ephemeral Go binary on `127.0.0.1:18083/abrn/api` (`abrn_coherence_test`) + `npm --prefix sdk test` | `LIVE_PARITY_HTTP_CHECKS=OK`; SDK **`5/5` passed, `0` failed, `0` skipped** (`1892.01ms`) |
| Live Go Server MCP E2E | `npm --prefix mcp test` against ephemeral `127.0.0.1:18083/abrn/api` | **`4/4` passed, `0` failed, `0` skipped** (`3396.62ms`) |
| Release Installer Unit Suite | `python3 -m py_compile ... && (cd deploy/release && python3 -m unittest -v test_release_installer.py)` | Exit `0` — **`14/14` passed** (`1.042s`) |
| Coordinated Production Cutover | `sudo /usr/bin/python3 -I /run/abrndrive-release-installer.py "$STAGE"` (`build_id: 912893c6a4e5c3b87c5cb4e5f4f38c061981ef58`) | Exit `0` — `abrndrive.service` active (MainPID `15591`); `/ready` `version: 52`, `stored_files: 1187`; `/health` local & public `version: 912893c6a4e5c3b87c5cb4e5f4f38c061981ef58`; binary SHA-256 `434582f4d257ba679f3c41d1c50565fa4f10f6a9aabfa23ecbdb53156f860887`; live `index.html` SHA-256 `23f46f6f5bc473953b152c0598df483fee337799cb2097612eda69dfc0173227` (0B delta) |
| Live Chromium (`bsk`) Browser Check | `bsk open https://abrndrive.filemonprime.net/abrn/` & `/abrn/api/v1/docs` | Rendered `"ABRN Drive"` and `"ABRN Drive OpenAPI & Agent Zero-Knowledge Guide"` cleanly |

---

## 4. Operational Notes

- Always execute coordinated live cutover via `deploy/release/README.md` onto `abrndrive.service` after each verified ABRN Drive build.
- No code blockers or open Cuaderno tickets remain (`0 pending`, `0 in_progress`).

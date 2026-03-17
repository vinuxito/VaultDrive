# Session Memory — 2026-03-15 (Trust UX, API v1, Agent Keys)

## Session Goal

Implement the next major product layer of ABRN Drive across four coordinated phases:

1. **Trust UX** — persistent trust rail, file security timeline, stronger receipts, first-run privacy explainer, clearer access hierarchy
2. **API-first completion** — versioned `/api/v1/...` surface, normalized response envelope, missing control endpoints
3. **Per-user Agent API Keys** — hashed key storage, scoped auth middleware, management UI, audit integration
4. **Ciphertext-first agent access** — fully controllable via scoped API keys; delegated decrypt deferred honestly

The mission constraint throughout: zero-knowledge trust boundary must remain intact.
The PIN law applied: the PIN the user sets once is used across the whole app — no per-action re-prompting.

---

## Context at Session Start

Previous session (2026-03-15 morning) left:
- `fb97d62` — fix: share/drop/request URLs broken on production — basename mismatch
- DB migration version: 33
- All backend auth was JWT-only; no external API surface
- No versioned API, no normalized response envelope
- No trust/timeline UI surfaces for files
- No agent key support anywhere

---

## What Was Built

### Phase 1 — Trust UX

**`vaultdrive_client/src/components/vault/TrustRail.tsx`** (new)
- Persistent owner-facing trust rail rendered in file preview
- Shows: protection status, visibility summary, owner, origin (vault upload vs secure drop), latest activity
- Backed by new `/api/v1/files/{id}/trust` endpoint
- Only shown for `is_owner !== false` (avoids implying recipients see owner trust state)

**`vaultdrive_client/src/components/vault/FileSecurityTimeline.tsx`** (new)
- Clean event timeline per file (upload, share, link creation/access/revoke, group share, secure drop intake)
- Tone-coded dots: `good` (green), `info` (blue), `warn` (amber)
- Backed by new `/api/v1/files/{id}/timeline` endpoint
- Events sorted newest-first

**`vaultdrive_client/src/components/vault/AccessPanel.tsx`** (modified)
- Added `state` pills per entry: active / revoked / expired
- Added Secure Drop entry type
- Added access count display
- More granular `kind` discrimination: owner / direct / group / share_link / secure_drop / revoked

**`vaultdrive_client/src/components/onboarding/OnboardingWizard.tsx`** (modified)
- Added new Step 1: "Calm by design" — plain-language trust briefing before PIN setup
- Step flow became: Privacy → Set PIN → Create Folder → Ready
- Step count changed from 3 to 4

**`vaultdrive_client/src/pages/settings.tsx`** (modified)
- Added plain-language privacy explainer card: what the server can/cannot see
- Added `<AgentApiKeysSection />`
- Added `<AuditLogSection />`

**`vaultdrive_client/src/components/vault/CreateShareLinkModal.tsx`** (modified)
- Receipt wording: "Share link created with revocable access"
- Warning softened: removed threatening "⚠️" emoji, kept honest fragment-key note
- Removed false `ownerUsesPin` branching — share link creation always requires the credential that encrypted the file

**`vaultdrive_client/src/components/upload/CreateUploadLinkModal.tsx`** (modified)
- Receipt wording emphasizes revocability and control

### Phase 2 — API v1

**`json_v1.go`** (new)
- `respondWithV1(w, r, code, payload, pagination)` — standard success envelope
- `respondWithV1Error(w, r, code, msg)` — standard error envelope
- `ensureRequestID(w, r)` — attaches X-Request-Id to every v1 response

**`handle_v1_core.go`** (new)
- `handlerV1ListFiles` — `GET /api/v1/files` with optional `?q=` search
- `handlerV1GetFileMetadata` — `GET /api/v1/files/{id}`
- `handlerV1CreateFile` — `POST /api/v1/files/upload` (multipart ciphertext upload)
- `handlerV1DownloadFile` — `GET /api/v1/files/{id}/download` (returns raw ciphertext + `X-Wrapped-Key` + `X-File-Metadata`)
- `handlerV1ListFolders` / `handlerV1CreateFolder` / `handlerV1UpdateFolder` / `handlerV1DeleteFolder`

**`handle_audit.go`** (new)
- `handlerGetAuditLogs` — `GET /api/v1/audit` with `?limit=`, `?offset=`, `?resource_type=`, `?resource_id=` filters

**`handle_access.go`** (heavily modified)
- Refactored into helper methods: `getOwnedFileForAccess`, `buildFileAccessEntries`, `summarizeVisibility`, `buildFileTimeline`
- Added `handlerGetFileTrustSummary` — `GET /api/v1/files/{id}/trust`
- Added `handlerGetFileSecurityTimeline` — `GET /api/v1/files/{id}/timeline`
- Fixed `handlerRevokeAllExternalAccess` to fail closed on DB errors (was returning success even if revoke failed)

**`main.go`** (modified)
- 25 new v1 routes added under `/api/v1/...`
- All use `middlewareActor` (accepts JWT or scoped agent key)

### Phase 3 — Agent API Keys

**`sql/schema/034_agent_api_keys.sql`** (new)
- Table `agent_api_keys` with all required fields
- Indexes on user, status, expiry

**`sql/queries/agent_api_keys.sql`** (new)
- 7 queries: CreateAgentAPIKey, ListAgentAPIKeysByUser, GetAgentAPIKeyByHash, GetAgentAPIKeyByIDForUser, RevokeAgentAPIKey, MarkAgentAPIKeyUsed, MarkAgentAPIKeyExpired

**`internal/database/agent_api_keys.sql.go`** (generated by sqlc)

**`agent_api_keys.go`** (new)
- `generateAgentAPIKeyToken()` — returns `(raw, prefix, sha256hash, error)`
- Raw key format: `abrn_ak_{base64url_random_32_bytes}`
- Only prefix + SHA-256 hash stored; raw key shown once at creation time
- `normalizeAgentScopes` — deduplicates and sorts
- `validateAgentScopes` — rejects unknown scope names
- `scopeAllowed` — O(n) check used in middleware

**`audit.go`** (new)
- `insertActivity` and `insertAudit` helper methods on `ApiConfig`
- `marshalJSONB`, `mustJSON`, `nullUUID`, `nullUUIDPtr`, `requestIP`, `requestInet` utilities

**`middleware_actor.go`** (new)
- `middlewareActor(requiredScopes ...string)` returns a handler wrapper
- Accepts both JWT (existing) and `abrn_ak_...` prefixed agent keys
- Agent key path: hash lookup → status/expiry check → scope check → usage tracking → audit insert
- Scope enforcement: fails 403 with activity + audit records on scope denial
- Fixed scope escalation: agent keys cannot mint child keys with broader scopes than their own

**`handle_agent_api_keys.go`** (new)
- `handlerListAgentAPIKeys` — list keys (prefix, scopes, status, last used, IP, UA, usage count)
- `handlerCreateAgentAPIKey` — create key with scope subset enforcement for agent callers
- `handlerRevokeAgentAPIKey` — revoke with audit trail
- `handlerAgentAuthIntrospect` — returns caller's auth_type, user_id, scopes, key_id

**`vaultdrive_client/src/components/settings/AgentApiKeysSection.tsx`** (new)
- Create key modal: name, expiry picker, notes, scope checkboxes
- One-time receipt: shows raw key once, then only prefix is visible
- Key list: status pills, scope badges, last used / IP / UA / usage count
- Revoke button with confirmation

### Phase 4 — Ciphertext-first + Fixes

**Audit hooks added to existing handlers:**
- `handle_files.go` — file upload
- `handle_file_share.go` — file share
- `handle_public_share_links.go` — link create/revoke
- `handle_file_requests.go` — request create/revoke/upload
- `handle_drop.go` — drop create/upload/revoke

**`vaultdrive_client/src/components/settings/AuditLogSection.tsx`** (new)
- Shows recent audit events with action labels, resource info, timestamps
- Expandable metadata detail per event
- Paginated (20 per page, load more)
- Refresh button
- Backed by `/api/v1/audit` with JWT auth

**File credential provenance (`credential_scheme` field):**
- `handle_files.go` and `handle_v1_core.go` now accept `credential_scheme` form field
- Stored as part of the file's `encrypted_metadata` JSON
- Frontend uploads now send `credential_scheme=pin` when owner has PIN set
- `getFileCredentialScheme()` helper in `files.tsx` reads this to give the correct modal (PIN vs file credential)
- Eliminates the false "PIN mode" for owner files that were encrypted before the PIN was set

### Oracle Risk Fixes Applied

**Child key scope escalation (HIGH):**
- `handlerCreateAgentAPIKey` now checks `actor.Scopes` from context
- Agent key callers cannot request child scopes they don't already have
- JWT callers are unrestricted (owner creating their own keys)

**Revoke-all returns false success (MEDIUM):**
- Both DB exec calls in `handlerRevokeAllExternalAccess` now check errors
- Returns 500 with specific error message if either operation fails
- Response `{"success": true}` only sent when both operations complete

### PIN-alignment (Owner Credential UX)

**Rule applied:** Once a PIN is set, new vault uploads use the PIN. Old files that were encrypted before PIN was set continue to ask for their original credential.

**What changed:**
- `files.tsx`: `getFileCredentialScheme()` replaces the `ownerUsesPin` shortcut for decrypt modals
- `share-modal.tsx`: `credentialMode` based only on `pinWrappedKey` (drop file marker), not `pin_set`
- `CreateShareLinkModal.tsx`: credential input type based only on `isDropFile`, not `ownerUsesPin`
- `BulkDownloadModal.tsx`: credential routing based only on `pin_wrapped_key` on individual files
- Upload functions: send `credential_scheme=pin` when owner has PIN

---

## Scopes Implemented

| Scope | Allows |
|-------|--------|
| `files:list` | List file metadata |
| `files:read_metadata` | Read single file metadata |
| `files:upload_ciphertext` | Upload encrypted file |
| `files:download_ciphertext` | Download ciphertext + wrapped key |
| `folders:read` | List folders |
| `folders:write` | Create / update / delete folders |
| `shares:create` | Create public share link |
| `shares:list` | List share links for a file |
| `shares:revoke` | Revoke link / revoke all external access |
| `requests:create` | Create file request |
| `requests:list` | List file requests |
| `requests:revoke` | Revoke file request |
| `activity:read` | Read activity log + audit log |
| `trust:read` | Read trust summary + security timeline |
| `api_keys:read` | List agent keys |
| `api_keys:write` | Create / revoke agent keys (with scope subset enforcement) |

Deferred: `drop:create`, `drop:list` — Secure Drop creation currently requires user-side PIN wrapping step that cannot safely be delegated yet.

---

## Build Verification

| Check | Result |
|-------|--------|
| `go test ./...` | ✅ |
| `go build ./...` | ✅ |
| `npm run build` (tsc + vite) | ✅ (zero TS errors) |
| LSP diagnostics (all modified .tsx files) | ✅ No errors |
| Agent API key test (`agent_api_keys_test.go`) | ✅ 2 tests pass |
| Bundle warning | ⚠️ Pre-existing (815 KB chunk, Vite advisory only) |
| `gopls` LSP | ⛔ Not installed — backend verified via `go test` + `go build` |

---

## Files Changed

### New Backend
- `agent_api_keys.go`
- `agent_api_keys_test.go`
- `audit.go`
- `json_v1.go`
- `middleware_actor.go`
- `handle_agent_api_keys.go`
- `handle_audit.go`
- `handle_v1_core.go`
- `sql/schema/034_agent_api_keys.sql`
- `sql/queries/agent_api_keys.sql`
- `internal/database/agent_api_keys.sql.go` (generated)

### Modified Backend
- `main.go` (+75 lines: 25 new v1 routes)
- `handle_access.go` (+421 lines: trust/timeline/access helpers + new handlers)
- `handle_drop.go` (+18 lines: audit hooks)
- `handle_file_requests.go` (+16 lines: audit hooks)
- `handle_file_share.go` (+27 lines: audit hooks)
- `handle_files.go` (+13 lines: audit hook + credential_scheme)
- `handle_public_share_links.go` (+14 lines: audit hooks)
- `internal/database/models.go` (+20 lines: AgentApiKey model)
- `handle_v1_core.go` (+5 lines: credential_scheme)

### New Frontend
- `vaultdrive_client/src/components/vault/TrustRail.tsx`
- `vaultdrive_client/src/components/vault/FileSecurityTimeline.tsx`
- `vaultdrive_client/src/components/settings/AgentApiKeysSection.tsx`
- `vaultdrive_client/src/components/settings/AuditLogSection.tsx`

### Modified Frontend
- `vaultdrive_client/src/pages/settings.tsx`
- `vaultdrive_client/src/components/onboarding/OnboardingWizard.tsx`
- `vaultdrive_client/src/components/vault/AccessPanel.tsx`
- `vaultdrive_client/src/components/vault/FilePreviewModal.tsx`
- `vaultdrive_client/src/components/vault/CreateShareLinkModal.tsx`
- `vaultdrive_client/src/components/upload/CreateUploadLinkModal.tsx`
- `vaultdrive_client/src/components/share-modal.tsx`
- `vaultdrive_client/src/components/vault/BulkDownloadModal.tsx`
- `vaultdrive_client/src/pages/files.tsx`

---

## Risks / Open Items

1. **Bundle size**: JS bundle is 815 KB (gzip 230 KB). Vite warns but this is advisory. Can be addressed with `manualChunks` when performance matters.

2. **`gopls` not installed**: Backend type-checking was done via `go test` + `go build`. No LSP diagnostics available for Go files.

3. **Secure Drop agent delegation not implemented**: Drop creation requires user-side PIN wrapping. Deferred until architecture can support it without weakening ZK boundary.

4. **Delegated decrypt not implemented**: Deferred. Would require key-wrapping to agent identity (RSA or symmetric). Must be explicitly user-authorized, time-bound, and revocable before shipping.

5. **Old files have no `credential_scheme` in metadata**: `getFileCredentialScheme()` defaults to `"password"` for these, which is correct — the UI falls back to asking for the original credential. No data migration needed.

---

## DB Migration Version After This Session

**Migration 034** (agent_api_keys table)

Run before starting server:
```bash
goose -dir sql/schema postgres "$DATABASE_URL" up
```

---

## Open Items for Next Session

1. Wire `credential_scheme` reading into `share-modal.tsx` and `CreateShareLinkModal.tsx` for the share credential prompt (currently still uses `pin_wrapped_key` only).
2. Consider code splitting to address the Vite bundle warning.
3. Add more test coverage for v1 handlers and agent key lifecycle flows.
4. Consider a "delegated access grant" design doc once the team is ready to revisit delegated decrypt.

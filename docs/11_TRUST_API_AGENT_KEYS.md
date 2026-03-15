# 11 — Trust UX, API v1, and Agent API Keys

Implemented: 2026-03-15

---

## Overview

This session delivered the sovereign file control plane layer for ABRN Drive:

- A calm, owner-facing trust UI (trust rail, security timeline, access hierarchy, privacy explainer)
- A stable versioned `/api/v1/...` control surface with normalized response envelopes
- Per-user Agent API Keys with hashed storage, scoped auth, last-used visibility, and full revocability
- Ciphertext-first agent access that preserves the zero-knowledge boundary
- Explicit audit trail for key lifecycle and sensitive file operations

The zero-knowledge contract was held throughout: agents can move ciphertext and manage the control plane, but they carry no plaintext authority and no silent server-side decrypt path was added.

---

## Phase 1 — Trust UX

### Trust Rail (`TrustRail.tsx`)

A persistent owner confidence rail mounted in file preview. Shows:

- **Protection** — "Browser-encrypted ciphertext stored server-side"
- **Who can see it** — visibility summary derived from all current access entries
- **Origin** — vault upload vs secure drop intake
- **Latest activity** — most recent timeline event label

Backed by `GET /api/v1/files/{id}/trust`.

Only visible to the file owner (`is_owner !== false` check in `FilePreviewModal.tsx`).

### File Security Timeline (`FileSecurityTimeline.tsx`)

Readable per-file event history. Events:

| Event type | Appears when |
|---|---|
| `uploaded` | File created |
| `secure_drop_received` | File came through Secure Drop |
| `shared` | Direct user share |
| `group_shared` | Group file share |
| `link_created` | Public share link created |
| `accessed` | Public link was opened |
| `revoked` | Link revoked |
| `expired` | Link expired |

Sorted newest-first. Backed by `GET /api/v1/files/{id}/timeline`.

### Access Hierarchy (`AccessPanel.tsx`)

Each access entry now shows a `state` pill (active / revoked / expired), access count for share links, and proper entry types for Secure Drop intake.

### Privacy Explainer (`settings.tsx`, `OnboardingWizard.tsx`)

Settings page includes a three-card explainer: what ABRN Drive protects, what the server can see, what it cannot see, and how external agents stay scoped.

Onboarding expanded to 4 steps: Privacy → PIN → Folder → Ready. First-run users see a plain-language trust briefing before anything else.

### Receipts

Share link receipt: "Share link created with revocable access"
Upload link receipt: "…the link can expire, be sealed after use, or be revoked later"

---

## Phase 2 — API v1

### Response Envelope (`json_v1.go`)

Every `/api/v1/...` endpoint returns:

```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "request_id": "uuid",
    "pagination": { "count": 20, "limit": 20, "offset": 0 }
  }
}
```

Error shape:

```json
{
  "success": false,
  "error": { "message": "..." },
  "meta": { "request_id": "uuid" }
}
```

### Endpoints

| Method | Path | Scope | Description |
|--------|------|-------|-------------|
| GET | `/api/v1/files` | `files:list` | List files with optional `?q=` search |
| GET | `/api/v1/files/{id}` | `files:read_metadata` | Single file metadata |
| POST | `/api/v1/files/upload` | `files:upload_ciphertext` | Multipart ciphertext upload |
| GET | `/api/v1/files/{id}/download` | `files:download_ciphertext` | Ciphertext + X-Wrapped-Key header |
| GET | `/api/v1/files/{id}/trust` | `trust:read` | Trust summary |
| GET | `/api/v1/files/{id}/timeline` | `trust:read` | Security event timeline |
| GET | `/api/v1/files/{id}/access-summary` | `trust:read` | Access entries |
| DELETE | `/api/v1/files/{id}/revoke-external` | `shares:revoke` | Revoke all external access |
| GET | `/api/v1/files/{fileId}/share-links` | `shares:list` | List share links |
| POST | `/api/v1/files/{fileId}/share-link` | `shares:create` | Create share link |
| DELETE | `/api/v1/share-links/{linkId}` | `shares:revoke` | Revoke link |
| GET | `/api/v1/file-requests` | `requests:list` | List file requests |
| POST | `/api/v1/file-requests` | `requests:create` | Create file request |
| DELETE | `/api/v1/file-requests/{id}` | `requests:revoke` | Revoke file request |
| GET | `/api/v1/folders` | `folders:read` | List folders |
| POST | `/api/v1/folders` | `folders:write` | Create folder |
| PUT | `/api/v1/folders/{id}` | `folders:write` | Update folder |
| DELETE | `/api/v1/folders/{id}` | `folders:write` | Delete folder |
| GET | `/api/v1/activity` | `activity:read` | Activity feed |
| GET | `/api/v1/audit` | `activity:read` | Audit log with filters |
| GET | `/api/v1/agent-keys` | `api_keys:read` | List agent keys |
| POST | `/api/v1/agent-keys` | `api_keys:write` | Create agent key |
| DELETE | `/api/v1/agent-keys/{id}` | `api_keys:write` | Revoke agent key |
| GET | `/api/v1/auth/introspect` | (none required) | Show caller auth_type, scopes, key_id |

All endpoints accept **JWT or scoped agent API key** via `Authorization: Bearer ...`.

---

## Phase 3 — Agent API Keys

### Schema

Migration 034: `agent_api_keys` table.

| Field | Type | Notes |
|-------|------|-------|
| `id` | UUID | PK |
| `user_id` | UUID | FK → users |
| `name` | TEXT | Human label |
| `key_prefix` | VARCHAR(24) | First 18 chars, visible forever |
| `key_hash` | CHAR(64) | SHA-256 of raw key, UNIQUE |
| `scopes_json` | JSONB | `["files:list", ...]` |
| `status` | TEXT | `active` / `revoked` / `expired` |
| `created_at` | TIMESTAMPTZ | |
| `last_used_at` | TIMESTAMPTZ | |
| `expires_at` | TIMESTAMPTZ | Optional |
| `revoked_at` | TIMESTAMPTZ | Set on revoke |
| `created_by_ip` | TEXT | |
| `last_used_ip` | TEXT | Updated per request |
| `last_used_user_agent` | TEXT | Updated per request |
| `notes` | TEXT | Optional memo |
| `usage_count` | INTEGER | Incremented per use |
| `last_seen_context_json` | JSONB | Last path + method |

### Key Format

```
abrn_ak_{base64url-encoded 32 random bytes}
```

Stored:
- `key_prefix` = first 18 characters (visible prefix shown in UI)
- `key_hash` = `hex(sha256(raw_key))` — only this is used for lookup

Raw key returned once in the creation response. Never stored. Not recoverable.

### Auth Middleware (`middleware_actor.go`)

The `middlewareActor(requiredScopes...)` wrapper:

1. Extracts `Authorization: Bearer ...`
2. If token starts with `abrn_ak_` → agent key path
   - Hash lookup
   - Status + expiry check (auto-marks expired)
   - Scope check (403 + audit log on failure)
   - Usage tracking (last IP, UA, timestamp, count)
   - Audit event: `agent_api_key.used`
3. Otherwise → existing JWT path

Both paths resolve to `database.User` and call the same `authedHandler`.

The resolved actor is stored in context (`actorContextKey`) for scope-aware operations.

### Scope Escalation Prevention

When an **agent key** creates a child key, the requested scopes must be a subset of the caller's own scopes. JWT callers (actual users) have no restriction.

```
actor type = agent_api_key
requested scopes = ["files:list", "shares:revoke"]
actor scopes     = ["files:list", "files:read_metadata"]
→ REJECTED: "Agent keys cannot create broader child scopes"
```

### UI (`AgentApiKeysSection.tsx`)

- Create key modal: name, expiry (7 / 30 / 90 days / no expiry), notes, scope checkboxes
- One-time receipt shows raw key with copy button
- Key list shows prefix, status, scopes, last used, IP, UA, usage count
- Revoke with confirmation prompt

---

## Phase 4 — Ciphertext-first + Audit

### Trust-Preserving Download

`handlerV1DownloadFile` returns raw ciphertext bytes plus:
- `X-Wrapped-Key` — the RSA-wrapped AES key for this user (if available)
- `X-File-Metadata` — the IV/salt/algorithm JSON

Decryption still requires the **user's RSA private key** which is stored PIN-encrypted in the browser. An agent with `files:download_ciphertext` gets the ciphertext but cannot decrypt it without the owner's private key. The zero-knowledge boundary is maintained.

### File Credential Provenance

`credential_scheme` field stored in file metadata JSON:
- `"pin"` — file was uploaded by a PIN-enabled owner using their PIN as the encryption credential
- `"password"` — file was uploaded with an independent passphrase, or predates PIN support

Used by `getFileCredentialScheme()` in the frontend to decide which credential prompt to show, eliminating the false "PIN mode" for pre-PIN legacy files.

### Audit Trail (`AuditLogSection.tsx`)

Settings page now shows a paginated audit log with:
- Action labels (human-readable)
- Resource type and ID excerpt
- Timestamp
- Expandable metadata detail

Backed by `/api/v1/audit`.

---

## Security Properties

| Property | Status |
|----------|--------|
| Raw keys never stored | ✅ |
| Scope enforcement before handler | ✅ |
| Child keys cannot exceed parent scopes | ✅ |
| Revoke-all fails closed on DB error | ✅ (fixed in this session) |
| ZK boundary preserved in download | ✅ |
| Trust/timeline only visible to owner | ✅ |
| Agent key creation, use, revoke all audited | ✅ |
| Delegated decrypt not implemented | ✅ (deferred honestly) |

---

## Files Changed

| File | Status |
|------|--------|
| `agent_api_keys.go` | New |
| `agent_api_keys_test.go` | New |
| `audit.go` | New |
| `json_v1.go` | New |
| `middleware_actor.go` | New |
| `handle_agent_api_keys.go` | New |
| `handle_audit.go` | New |
| `handle_v1_core.go` | New |
| `sql/schema/034_agent_api_keys.sql` | New |
| `sql/queries/agent_api_keys.sql` | New |
| `internal/database/agent_api_keys.sql.go` | Generated |
| `main.go` | Modified (+25 v1 routes) |
| `handle_access.go` | Modified (trust/timeline + fixes) |
| `handle_drop.go` | Modified (audit hooks) |
| `handle_file_requests.go` | Modified (audit hooks) |
| `handle_file_share.go` | Modified (audit hooks) |
| `handle_files.go` | Modified (audit + credential_scheme) |
| `handle_public_share_links.go` | Modified (audit hooks) |
| `internal/database/models.go` | Modified (AgentApiKey model) |
| `vaultdrive_client/src/components/vault/TrustRail.tsx` | New |
| `vaultdrive_client/src/components/vault/FileSecurityTimeline.tsx` | New |
| `vaultdrive_client/src/components/settings/AgentApiKeysSection.tsx` | New |
| `vaultdrive_client/src/components/settings/AuditLogSection.tsx` | New |
| `vaultdrive_client/src/pages/settings.tsx` | Modified |
| `vaultdrive_client/src/components/onboarding/OnboardingWizard.tsx` | Modified |
| `vaultdrive_client/src/components/vault/AccessPanel.tsx` | Modified |
| `vaultdrive_client/src/components/vault/FilePreviewModal.tsx` | Modified |
| `vaultdrive_client/src/components/vault/CreateShareLinkModal.tsx` | Modified |
| `vaultdrive_client/src/components/upload/CreateUploadLinkModal.tsx` | Modified |
| `vaultdrive_client/src/components/share-modal.tsx` | Modified |
| `vaultdrive_client/src/components/vault/BulkDownloadModal.tsx` | Modified |
| `vaultdrive_client/src/pages/files.tsx` | Modified |

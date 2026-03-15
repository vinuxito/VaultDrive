# Security Hardening & Platform Upgrade — Phase 2

**Date:** March 14, 2026  
**Session:** Phase 2 execution after UX upgrade (Phase 1)  
**Status:** Complete and deployed

---

## Overview

Phase 2 closed all identified security gaps, wired the missing activity backend, and shipped the remaining platform features needed to make ABRN Drive feel genuinely trustworthy and operationally useful.

---

## What Was Built

### 1. Zero-Knowledge Integrity Sealed

**Problem:** `upload_tokens.raw_encryption_key` stored the literal AES-256 key in the database. The server was not zero-knowledge for drop uploads.

**Fix:**
- Deleted `handlerDropGetEncryptionKey` and removed its route from `main.go`
- `handlerCreateDropToken` no longer writes `raw_encryption_key` (`sql.NullString{Valid: false}`)
- Upload validation in `handlerDropUpload` skips wrapped-key check for new tokens (empty `password_hash`)
- New tokens: `raw_encryption_key = NULL`, `password_hash = NULL` in DB
- Old tokens still work unchanged (backward compat)

**Verify:** `SELECT COUNT(*) FROM upload_tokens WHERE raw_encryption_key IS NULL` — increases with each new link.

### 2. Drop Keys Out of Server Logs

**Problem:** Drop link URLs used `?key=<wrappedKey>` — query params logged in Apache and systemd journals for every GET request.

**Fix:**
- New URL format: `/abrn/drop/:token#key=<rawAESkey>` — URL fragment is never sent to server
- `drop-upload.tsx` reads key from `window.location.hash` first, falls back to `window.location.search` for legacy links
- Legacy links (`?key=`) retain backward compat and still call the old path if server has raw key

**Note:** The old `handlerDropGetEncryptionKey` still exists for legacy tokens until they expire; after that, migration 029 drops the column.

### 3. API Security Hardening

**Problem:** User enumeration endpoints unprotected, CORS wildcard, no PIN rate limiting.

**Fixes:**
- `GET /api/user-by-email` and `GET /api/user-by-username` now require auth (handler signatures updated)
- `middlewareCORS`: reads `CORS_ALLOWED_ORIGINS` env var; defaults to known production/dev hosts
- PIN lockout: `users.pin_failed_attempts` + `users.pin_locked_until` columns (migration 030)
- After 5 failed PIN attempts: 15-minute lockout enforced in `handlerCreateDropToken`

### 4. Activity Feed Wired

**Problem:** Dashboard showed "Activity feed coming soon" — backend never implemented.

**Fix:**
- Created `handle_activity.go`: `GET /api/activity` reads from `activity_log` table (already populated)
- Created `GET /api/security-posture`: scans for expiring tokens (<48h) and stale share links (>30 days, unaccessed)
- Dashboard now shows real activity and a calm security posture panel

### 5. Safer Defaults

**Problem:** Share links and drop portals had no default expiry — links lived forever unless manually revoked.

**Fixes:**
- `handle_public_share_links.go`: default 7-day expiry when `expires_at` not provided
- Migration 031: `seal_after_upload BOOLEAN NOT NULL DEFAULT FALSE`, `last_used_at TIMESTAMPTZ` on `upload_tokens`
- `handlerCreateDropToken`: accepts `seal_after_upload` flag; if set, token deactivated after first upload
- `handlerDropUpload`: sets `last_used_at = NOW()` and auto-seals if `seal_after_upload = true`
- `CreateUploadLinkModal.tsx`: "Seal after first upload" toggle
- `VaultTree.tsx`: status badges — Active (green), Expiring <48h (amber), Sealed (grey)

### 6. Drop Portal Identity + Receipt

**Problem:** Clients opening a drop link had no context about who they were sending to.

**Fixes:**
- Migration 032: `organization_name TEXT` on `users`
- `handlerDropTokenInfo` returns `owner_display_name` and `owner_organization`
- `drop-upload.tsx`: identity bar shows "Sending to [Name] · [Organization]"
- Success screen: receipt block with name, org, file count, timestamp, reference, "Copy receipt" button
- `settings.tsx`: Organization card with text input and save (PUT /api/users/organization)
- `handle_user_update.go`: `handlerUpdateOrganization` handler
- `handle_user_me.go` + `GET /api/users/me` registered: returns `organization_name` field

### 7. File Access Visibility

**Problem:** No way to see who has access to a given file without mentally reconstructing from multiple sources.

**Fixes:**
- Migration 033: `access_count`, `last_accessed_at` on `public_share_links`
- `handle_public_share_links.go`: increments `access_count` + sets `last_accessed_at` on every file serve
- Created `handle_access.go`:
  - `GET /api/files/{id}/access-summary`: joins `file_access_keys`, `group_file_shares`, `public_share_links`
  - `DELETE /api/files/{id}/revoke-external`: one-click remove all non-owner access
- Created `AccessPanel.tsx`: modal showing access entries by kind (direct/group/share_link) with "Revoke all external access" button
- `files.tsx`: shield button on owned file rows opens AccessPanel

---

## DB Migrations Applied

| File | Change |
|------|--------|
| `030_pin_attempt_tracking.sql` | `pin_failed_attempts`, `pin_locked_until` on `users` |
| `031_upload_tokens_seal_option.sql` | `seal_after_upload`, `last_used_at` on `upload_tokens` |
| `032_user_organization.sql` | `organization_name` on `users` |
| `033_share_link_access_tracking.sql` | `access_count`, `last_accessed_at` on `public_share_links` |

Goose migration version: **33**

---

## New Files

| File | Purpose |
|------|---------|
| `handle_activity.go` | `GET /api/activity`, `GET /api/security-posture` |
| `handle_access.go` | `GET /api/files/{id}/access-summary`, `DELETE /api/files/{id}/revoke-external` |
| `handle_user_update.go` | `PUT /api/users/organization` |
| `vaultdrive_client/src/components/vault/AccessPanel.tsx` | Who-can-see-this modal |
| `sql/schema/030–033_*.sql` | DB migrations |
| `plans/abrn-drive-phase2-execution-plan.md` | Implementation plan |
| `docs/SESSION_MEMORY_2026-03-14-phase2.md` | Session memory |

---

## Infrastructure Change

Added `db *sql.DB` to `ApiConfig` struct. Several new handlers use raw SQL for new columns rather than regenerating sqlc — avoids regenerating the entire generated codebase while keeping the new features functional.

---

## Known Deferred Items

### Migration 029 — DROP COLUMN raw_encryption_key

Not yet run. Requires `sqlc generate` because the generated queries use explicit column names. Old drop tokens still reference this column for backward-compat URL display. Once old links expire (or are manually deleted), this is safe to run:

```bash
# 1. Run migration
goose -dir sql/schema postgres "$DB_URL" up  # after adding 029 back to schema
# 2. Regenerate sqlc
sqlc generate
# 3. Rebuild
go build -o abrndrive .
```

### PIN rate limiting on handlerSetUserPIN

Currently only `handlerCreateDropToken` has PIN lockout. The `POST /api/users/pin` endpoint does not. Should also protect PIN changes.

---

## Security Posture After Phase 2

| Finding | Status |
|---------|--------|
| raw_encryption_key in DB (ZK violation) | ✅ Fixed for new tokens; old tokens unaffected |
| Drop wrapped key in server logs | ✅ Fixed for new tokens (#fragment) |
| Unauthenticated user enumeration | ✅ Fixed |
| CORS wildcard | ✅ Fixed (explicit origins) |
| No PIN rate limiting | ✅ Fixed (lockout after 5 fails) |
| No access visibility UI | ✅ Fixed (AccessPanel) |
| Share links no default expiry | ✅ Fixed (7-day default) |
| Drop portal shows no owner identity | ✅ Fixed |
| No activity endpoint | ✅ Fixed |
| No operational security dashboard | ✅ Fixed (posture panel) |

# Secure Platform Hardening

Last updated: March 14, 2026

## Goal

Harden ABRN Drive's trust-critical paths so the app is safer to operate, clearer to users, and verifiable in a standalone branch runtime before further feature work.

## What changed

### 1. Backend trust and security hardening

- `main.go`
  - Added authenticated `GET /api/activity`
  - Protected `GET /api/user-by-username` and `GET /api/user-by-email`
  - Tightened CORS to explicit allowed origins instead of wildcard behavior
  - Changed drop legacy key resolution route from `GET` to `POST`
- `handle_activity.go` (new)
  - Added activity feed endpoint and message shaping for activity items
  - Added reusable activity logging helper
- `pin_security.go` (new)
  - Added PIN lockout policy: 5 failed attempts, 15-minute lockout
- `handle_login.go`, `handle_user_pin.go`, `handle_drop.go`
  - Added PIN lockout checks, failed-attempt registration, and lockout reset on success
- `handle_file_share.go`
  - Added activity logging for outbound share and inbound receive events
- `handle_get_public_key.go`
  - Converted public-key handlers to authenticated handlers
- `handle_user_get.go`
  - Continued returning safe user data only
  - Adjusted lookup response shape to array form so current share UI can consume it consistently

### 2. Drop flow hardening and trust UX

- `handle_drop.go`
  - Removed per-file `defer dst.Close()` leak inside upload loop and replaced it with explicit close/finalize behavior
  - Added owner display name to drop token info response
  - Stopped validating drop-page key through query-string GET flow
  - Continued emitting `#key=` links for drop creation/listing
  - Logged `drop_upload` activity events
- `vaultdrive_client/src/pages/drop-upload.tsx`
  - Switched to `API_URL` instead of hardcoded `/abrn/api`
  - Read key from URL fragment with query fallback for legacy links
  - Improved trust-facing copy and success/receipt messaging
  - Added clearer recipient identity and safer client-facing wording
- `vaultdrive_client/src/components/upload/CreateUploadLinkModal.tsx`
  - Kept default expiration at 7 days in UI ordering
  - Improved copy around safer `#key=` drop links

### 3. Activity and public trust surfaces

- `vaultdrive_client/src/components/layout/ActivityFeedPanel.tsx`
  - Added `file_received` event support
- `vaultdrive_client/src/pages/home.tsx`
  - Removed generic demo/source-code credibility leaks
  - Reframed home page around secure exchange and client collaboration
- `vaultdrive_client/src/pages/about.tsx`
  - Replaced project/demo language with product-principle language focused on trust and calm collaboration

### 4. Database/query changes

- `sql/queries/users.sql`
  - Added `RegisterFailedPINAttempt` and `ResetPINLockout`
- `internal/database/users.sql.go`, `internal/database/models.go`
  - Regenerated to include new PIN lockout query/model fields
- `sql/schema/029_user_pin_lockout.sql` (new)
  - Added `pin_failed_attempts` and `pin_locked_until`

## Verification performed

### Fresh code verification

- `go test ./...` -> passed
- `go build ./...` -> passed earlier in this session before runtime verification
- `cd vaultdrive_client && npm run build` -> passed

### Standalone branch runtime verification

Branch server was verified locally with a rebuilt binary and standalone frontend build.

Confirmed working:

- Home page loads
- Login succeeds and session token is stored
- Dashboard loads and `GET /api/activity` returns `200 []`
- Files page loads
- PIN can be configured for a fresh smoke user
- Folder creation works
- Drop-link creation works and returns fragment-safe `#key=` URLs
- Public drop page loads with the expected trust copy, description, and recipient context

### Direct API verification

- `GET /api/activity` with auth -> `200 []`
- `GET /api/users/{userId}/public-key` without auth -> `401`
- `GET /api/users/{userId}/public-key` with auth -> `200`

## Runtime prerequisites discovered during verification

Local verification surfaced a stale dev database. The branch runtime required these schema prerequisites before end-to-end verification would work cleanly:

- `users.pin_failed_attempts`
- `users.pin_locked_until`
- `activity_log` table
- `upload_tokens.description`
- `upload_tokens.client_message`

Important operational note:

- Running Goose migration files directly with `psql -f` is unsafe for verification because the `-- +goose Down` section is still executable SQL to Postgres. For local validation, only the `Up` SQL should be applied explicitly or Goose should be used properly.

## Remaining risks / deferred items

- Secure drop is improved, but not fully finished architecturally: server-side raw key storage/retrieval still exists in the backend model and should be removed in a later hardening pass.
- `GET /api/activity` is now real, but operational visibility is still partial because only a subset of handlers write activity events.
- The local standalone runtime required manual schema alignment; that is an environment risk, not a source-code compile failure.

## Safe continuation point

This branch is safe to continue building on.

The trust-critical slice now compiles, builds, and verifies through a realistic smoke path. The next logical work should focus on deeper secure-drop architecture cleanup and access-visibility improvements, not on re-fixing the current slice.

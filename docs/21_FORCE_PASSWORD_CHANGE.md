# 21 — Force Password Change

> Admin security gate: require users to change their password before accessing any vault resource.

## Summary

Admins can flag any non-self user to force a password change on their next login. The user sees a full-screen gate page with no escape — the only path forward is setting a new password or signing out. The backend middleware blocks every authenticated endpoint except `/api/users/change-password` while the flag is active.

## Architecture

Three-layer defense prevents bypass:

1. **Backend middleware gate** (`middleware_auth.go`) — checks `user.ForcePasswordChange` on every authenticated request. Only the change-password endpoint is allowed through.
2. **Frontend ProtectedRoute guard** (`protected-route.tsx`) — checks localStorage `force_password_change` flag and redirects to the gate page.
3. **Login redirect** (`login.tsx`) — detects the flag in the login response and redirects before loading the vault key.

## Database Changes

### Migration 037 (`sql/schema/037_force_password_change.sql`)

```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS force_password_change BOOLEAN NOT NULL DEFAULT FALSE;
```

### New SQL Queries (`sql/queries/users.sql`)

| Query | Purpose |
|-------|---------|
| `SetForcePasswordChange` | Admin sets the flag (true) on a target user |
| `ClearForcePasswordChange` | Cleared after successful password change |
| `UpdateUserPrivateKeyEncrypted` | Saves re-encrypted private key after password change |

## Backend Endpoints

### `POST /api/admin/users/{id}/force-password-change`

Admin-only. Sets `force_password_change = true` for the target user. Self-flagging is blocked.

### `POST /api/users/change-password`

Authenticated (any user). Accepts `old_password`, `new_password`, and optional `private_key_encrypted`. Validates old password via bcrypt, hashes new password, saves re-encrypted private key if provided, then clears the force flag.

### Auto-flag on admin password reset

`resetUserPasswordHandler` now auto-sets `force_password_change = true` after resetting a user's password. The error is handled (no longer silently discarded).

## Frontend Pages

### `/force-password-change` — Gate Page

- Full-screen, no navigation, no close button
- Current password + new password + confirm password fields
- Eye toggle for visibility on current and new password
- Real-time "passwords don't match" feedback
- ABRN branded glass card with ShieldAlert icon
- "Sign out instead" link at bottom (clears tokens, returns to login)
- `useEffect` guard: redirects to `/login` if no token, to `/dashboard` if no force flag

### Private Key Re-encryption

After successful password change, the page:
1. Decrypts the private key PEM with the old password
2. Re-encrypts with the new password using `encryptPrivateKeyWithPassword()`
3. Sends the re-encrypted key to the backend for persistence
4. Updates localStorage with the new encrypted key
5. Initializes the SessionVault (imports CryptoKey, sets credential) so file decryption works immediately on dashboard

If decryption fails (e.g. admin reset the password via a different encryption path), the password change still succeeds — the user just needs to re-enroll their keys separately.

### Admin Dashboard Button

- ShieldAlert icon button per user row (amber color)
- Disabled + solid amber when flag is already set
- Confirmation dialog before flagging
- Hidden for the current admin user (self-flag prevention)

## Security Review

Two code reviews were run (automated subagents). Issues found and resolved:

| Issue | Severity | Resolution |
|-------|----------|------------|
| Admin could flag themselves via API | CRITICAL | Added self-check in `forcePasswordChangeHandler` |
| Middleware path was a magic string | CRITICAL | Extracted `changePasswordPath` const in `middleware_auth.go` |
| `SetForcePasswordChange` error silently discarded | HIGH | Now returns 500 on failure in `resetUserPasswordHandler` |
| Private key not re-encrypted after password change | HIGH | Added `encryptPrivateKeyWithPassword` in crypto.ts + backend save |
| SessionVault not initialized after forced change | HIGH | Added vault init (importRSAPrivateKey + setCredential) after success |
| localStorage flag can be edited in DevTools | MEDIUM | Accepted: backend middleware is the authoritative gate, frontend is UX convenience only |

## Files Changed

| File | Change |
|------|--------|
| `sql/schema/037_force_password_change.sql` | NEW — migration |
| `sql/queries/users.sql` | 3 new queries |
| `internal/database/models.go` | `ForcePasswordChange bool` on User struct (sqlc) |
| `internal/database/users.sql.go` | Generated query functions (sqlc) |
| `handle_change_password.go` | NEW — change-password handler with key re-encryption |
| `handle_admin.go` | Force handler, self-guard, auto-flag error handling |
| `handle_login.go` | `force_password_change` in login response |
| `middleware_auth.go` | Force gate + `changePasswordPath` const |
| `main.go` | 2 new route registrations |
| `vaultdrive_client/src/pages/force-password-change.tsx` | NEW — gate page |
| `vaultdrive_client/src/pages/login.tsx` | Flag storage + redirect |
| `vaultdrive_client/src/pages/admin.tsx` | Force button + handler |
| `vaultdrive_client/src/App.tsx` | Route registration |
| `vaultdrive_client/src/components/protected-route.tsx` | Force flag guard |
| `vaultdrive_client/src/utils/crypto.ts` | `encryptPrivateKeyWithPassword()` |

## Verification

| Check | Result |
|-------|--------|
| `go build ./...` | CLEAN |
| `go vet ./...` | CLEAN |
| `tsc --noEmit` | CLEAN |
| `npx vite build` | SUCCESS (8.07s) |
| `npx vitest run` | 10 files, 27 tests PASS |

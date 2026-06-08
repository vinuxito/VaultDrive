# 20. Admin Dashboard Polish

**Date:** March 23, 2026
**Scope:** Small refinements to admin module — error feedback, password validation alignment, bulk delete limit bump

---

## Changes

### 1. `handle_admin.go` — Bulk delete limit raised

```go
const maxBulkDelete = 500  // was 100
```

**Why:** Original limit of 100 was arbitrary and too low for real admin operations on a growing user base.

### 2. `vaultdrive_client/src/pages/admin.tsx` — Password validation alignment

Frontend admin "Create User" form now enforces 8-character minimum password (was 6). This aligns with:
- Backend `resetUserPasswordHandler` (line 147): `len(req.NewPassword) < 8`
- Backend `createUserHandler` (line 281): `len(req.Password) < 8`
- Frontend `profile.tsx` (line 168): `passwordData.new_password.length < 8`

The 6-char frontend rule was the last inconsistency.

### 3. `vaultdrive_client/src/pages/admin.tsx` — Error feedback for admin operations

Added user-visible error feedback (via `alert()`) for all admin operations that previously silently failed:
- **Edit user**: Shows server error message or "Error updating user" / "Network error updating user"
- **Reset password**: Shows server error or "Error resetting password" / "Network error resetting password"
- **Reset PIN**: Shows server error or "Error resetting PIN" / "Network error resetting PIN"
- **Delete user**: Shows server error or "Error deleting user" / "Network error deleting user"

Previously, these operations logged to `console.error` but gave no user-visible feedback on failure.

---

## Verification

| Check | Result |
|-------|--------|
| `go build ./...` | CLEAN |
| `go vet ./...` | CLEAN |
| `go test ./...` | PASS |
| `tsc --noEmit` | CLEAN |
| `npx vitest run` | 21/21 |
| `npx vite build` | SUCCESS |
| `npx playwright test` | **32/32** |

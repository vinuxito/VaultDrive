# Task 01 — Email Feature Disabled

## Request

> "Remove the email feature. Don't delete the code, just remove it from the main app. We might use it later."

## What Was Done

The email integration (IMAP inbox, email account management) was removed from all active routing and UI surfaces. The Go handler files were renamed to `.disabled` so the compiler ignores them, but every line of code remains intact for future reactivation.

## Changes

### Backend — handlers renamed (not deleted)

| Original File | Renamed To | Contains |
|---|---|---|
| `handle_email_accounts.go` | `handle_email_accounts.go.disabled` | CRUD for stored email accounts |
| `handle_email_fetching.go` | `handle_email_fetching.go.disabled` | IMAP fetch, message listing |
| `imap_client.go` | `imap_client.go.disabled` | Low-level IMAP client wrapper |

Renaming to `.disabled` means Go's build tool ignores them — no compilation errors, no dead-code warnings.

### Backend — routes removed from `main.go`

The following route registrations were removed from `main.go`:

```go
// Removed:
mux.Handle("GET /api/email/accounts", ...)
mux.Handle("POST /api/email/accounts", ...)
mux.Handle("DELETE /api/email/accounts/{id}", ...)
mux.Handle("GET /api/email/accounts/{id}/messages", ...)
mux.Handle("POST /api/email/accounts/{id}/fetch", ...)
```

### Frontend — sidebar nav item removed

`vaultdrive_client/src/components/layout/sidebar.tsx` — the "Email" nav entry and its import were removed.

### Frontend — App.tsx route removed

`vaultdrive_client/src/App.tsx` — the `/email` route and the `import Email from "./pages/email"` import were removed. The `pages/email.tsx` file itself was **not deleted**.

## How to Re-enable

1. Rename the three `.disabled` files back to `.go`
2. Add the route registrations back to `main.go`
3. Add the nav item back to `sidebar.tsx`
4. Add the route back to `App.tsx`
5. `make build && sudo systemctl restart abrndrive`

## Files Changed

| File | Change |
|------|--------|
| `handle_email_accounts.go.disabled` | Renamed from `.go` |
| `handle_email_fetching.go.disabled` | Renamed from `.go` |
| `imap_client.go.disabled` | Renamed from `.go` |
| `main.go` | Email routes removed |
| `vaultdrive_client/src/components/layout/sidebar.tsx` | Email nav item removed |
| `vaultdrive_client/src/App.tsx` | Email route and import removed |

# Task 02 — 4-Digit PIN System

## Request

> "Users must be able to login with either password or PIN. If no PIN, allow password login and ask the user to set a PIN."

## What Was Built

A full 4-digit PIN system that runs parallel to password login. Every user can optionally set a PIN; if they haven't, they're prompted once after logging in. The PIN is used for:

- Logging in (instead of password)
- Decrypting Secure Drop files
- Decrypting files shared by other users (via RSA private key — see Task 04)

## Database

### Migration `023_user_pin.sql`

```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS pin_hash TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS pin_set_at TIMESTAMPTZ;
```

`pin_hash` stores a bcrypt hash of the 4-digit PIN (cost factor 10). The raw PIN is never stored.

### Migration `024_upload_tokens_pin_wrapped_key.sql`

```sql
ALTER TABLE upload_tokens ADD COLUMN IF NOT EXISTS pin_wrapped_key TEXT;
```

Stores the Secure Drop AES file key wrapped with the owner's PIN-derived key (replaces the plaintext password approach for drop links).

## Backend

### `handle_user_pin.go`

| Endpoint | Method | Description |
|----------|--------|-------------|
| `POST /api/users/pin` | auth required | Set or change the user's PIN |
| `GET /api/users/pin/status` | auth required | Returns `{ pin_set: bool }` |

**Set PIN request body:**

```json
{
  "pin": "1234",
  "old_pin": "0000",
  "private_key_pin_encrypted": "<hex blob>"
}
```

- `old_pin` is only required when changing an existing PIN (bcrypt-verified against `pin_hash`)
- `private_key_pin_encrypted` stores the user's RSA private key encrypted with the PIN — see Task 04
- The new PIN is bcrypt-hashed before storage

### `handle_login.go` — dual authentication

The login handler now accepts either `password` or `pin` in the request body:

```json
{ "email": "user@example.com", "password": "hunter2" }
{ "email": "user@example.com", "pin": "1234" }
```

PIN login verifies the PIN against `bcrypt.CompareHashAndPassword(user.PinHash, pin)`. If the PIN doesn't match or the user has no PIN set, a 401 is returned.

The login response always includes:

```json
{
  "pin_set": true,
  "private_key_encrypted": "<blob>",
  "private_key_pin_encrypted": "<blob or null>",
  "public_key": "<PEM>"
}
```

## Frontend

### `pages/login.tsx` — PIN tab

The login form has two tabs: **Password** and **PIN**. Switching tabs clears the input and error.

PIN login sends `{ email, pin }` instead of `{ email, password }`.

After login, the following are written to `localStorage["user"]`:

```json
{
  "username": "...",
  "email": "...",
  "pin_set": true,
  "private_key_encrypted": "<blob>",
  "private_key_pin_encrypted": "<blob or null>",
  "public_key": "<PEM>"
}
```

### `components/layout/dashboard-layout.tsx` — PIN banner

If `localStorage["user"].pin_set === false`, a dismissible amber banner is shown at the top of every dashboard page:

> "No PIN set — set one in Settings to enable PIN login and secure file sharing."

The banner links to `/settings`.

### `pages/settings.tsx` — PIN management card

The Settings page has a dedicated "Secure Drop PIN" card with:

- Green status badge if PIN is set
- Amber warning if not set
- "Set PIN" / "Change PIN" button that opens an inline form
- The form collects: current PIN (if changing), new PIN, and **account password**

The account password is required because the form must decrypt `private_key_encrypted` before re-encrypting it with the new PIN. See Task 04 for why.

Important: `private_key_encrypted` is not stored in the same format as Secure Drop or file-wrapped AES keys. It is a backend-generated base64 blob (`[16B salt][12B nonce][ciphertext]`) decrypted by `decryptPrivateKeyWithPassword()`, not by `unwrapKey()`.

**Submit logic (`handlePinSubmit`):**

```typescript
const privateKeyPem = await decryptPrivateKeyWithPassword(password, private_key_encrypted);
const privateKeyPinEncrypted = await encryptPrivateKeyWithPIN(pin, privateKeyPem);
await setPIN(pin, token, oldPin, privateKeyPinEncrypted);
```

The Settings page is rendered inside `ProtectedRoute`'s shared `DashboardLayout`. It should render only the page body and must not wrap itself in another `DashboardLayout`, otherwise the header and PIN banner will appear twice.

### `utils/api.ts` — `getPINStatus` / `setPIN`

```typescript
getPINStatus(token: string): Promise<{ pin_set: boolean }>
setPIN(pin: string, token: string, oldPin?: string, privateKeyPinEncrypted?: string): Promise<void>
```

## How PIN and RSA Connect

When a user sets their PIN, the flow is:

1. User provides their **account password** + new PIN
2. `decryptPrivateKeyWithPassword(password, private_key_encrypted)` → decrypts the RSA private key PEM from the backend registration blob
3. `encryptPrivateKeyWithPIN(pin, pem)` → re-encrypts the PEM using the PIN as the key derivation input
4. The result (`private_key_pin_encrypted`) is sent to the server and stored in `users.private_key_pin_encrypted`
5. It is also saved to `localStorage["user"].private_key_pin_encrypted`

This means: **any file shared to this user can later be decrypted using only their PIN**, with no password required. The PIN unlocks the private key; the private key unwraps the file's AES key.

## Files Changed

| File | Change |
|------|--------|
| `sql/schema/023_user_pin.sql` | New migration — `pin_hash`, `pin_set_at` columns |
| `sql/schema/024_upload_tokens_pin_wrapped_key.sql` | New migration — `pin_wrapped_key` column |
| `sql/queries/users.sql` | `SetUserPIN`, `GetUserPINHash`, `GetPINStatus` queries |
| `internal/database/users.sql.go` | sqlc generated |
| `handle_user_pin.go` | New — `POST /api/users/pin`, `GET /api/users/pin/status` |
| `handle_login.go` | PIN branch in login handler; returns key fields in response |
| `main.go` | PIN routes registered |
| `vaultdrive_client/src/pages/login.tsx` | PIN tab, localStorage writes |
| `vaultdrive_client/src/pages/settings.tsx` | PIN management card with password field; uses `decryptPrivateKeyWithPassword()` |
| `vaultdrive_client/src/components/layout/dashboard-layout.tsx` | PIN banner |
| `vaultdrive_client/src/utils/api.ts` | `getPINStatus`, `setPIN` |
| `vaultdrive_client/src/utils/crypto.ts` | `decryptPrivateKeyWithPassword`, `encryptPrivateKeyWithPIN`, `decryptPrivateKeyWithPIN` |

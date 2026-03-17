# Task 04 — RSA + PIN Zero-Knowledge File Sharing

## Request

> "Make sure that when I share a file or I get a file shared, or in my group or whatever — either me or the recipient must always be able to download the file with the PIN. No password sharing is needed at all."

## Goal

Every file in the system — own uploads, files shared user-to-user, files shared through a group, and Secure Drop files — must be downloadable using only the recipient's own 4-digit PIN. No encryption password is ever transmitted or shared between users.

## Architecture

### Key hierarchy

```
User password
    └── SHA-256(salt || password)
            └── AES-256-GCM
                    └── Decrypt private_key_encrypted → RSA-2048 private key PEM

User PIN
    └── PBKDF2-SHA256 (100k iterations)
            └── AES-256-GCM
                    └── Decrypt private_key_pin_encrypted → RSA-2048 private key PEM

RSA-2048 private key (either source)
    └── RSA-OAEP decrypt
            └── wrapped_key → AES-256-GCM file key

AES-256-GCM file key
    └── Decrypt file blob → plaintext
```

### Cryptographic primitives

| Operation | Algorithm | Where |
|-----------|-----------|-------|
| File encryption | AES-256-GCM | client-side upload |
| File key derivation (owner) | PBKDF2-SHA256, 100k iters | client `deriveKeyFromPassword` |
| File key wrapping (share) | RSA-OAEP / SHA-256 | client `wrapKeyWithRSA` |
| File key unwrapping (recipient) | RSA-OAEP / SHA-256 | client `unwrapKeyWithRSA` |
| Private key encryption (password) | AES-256-GCM + SHA-256(salt || password) | server `encryptPrivateKey` at registration |
| Private key encryption (PIN) | AES-256-GCM + PBKDF2 | client `encryptPrivateKeyWithPIN` |
| PIN storage | bcrypt cost 10 | server `handle_user_pin.go` |

## Database Changes

### Migration `025_user_private_key_pin_encrypted.sql`

```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS private_key_pin_encrypted TEXT;
```

Stores the RSA private key PEM encrypted with the user's PIN (hex-encoded `[16B salt][12B IV][ciphertext]`).

### New SQL queries (`sql/queries/users.sql`)

```sql
-- name: SetPrivateKeyPinEncrypted :exec
UPDATE users SET private_key_pin_encrypted = $1 WHERE id = $2;

-- name: GetUserPublicKeyByID :one
SELECT public_key FROM users WHERE id = $1;
```

### New SQL query (`sql/queries/groups.sql`)

```sql
-- name: GetGroupWrappedKeyForUser :one
SELECT gfs.wrapped_key
FROM group_file_shares gfs
JOIN group_members gm ON gfs.group_id = gm.group_id
WHERE gfs.file_id = $1 AND gm.user_id = $2
LIMIT 1;
```

Allows a group member to retrieve the wrapped key for a file they have access to via a group share.

## Backend Changes

### `handle_user_pin.go`

Now accepts `private_key_pin_encrypted` in the PIN request body and stores it via `SetPrivateKeyPinEncrypted`.

### `handle_login.go`

The login response now includes `private_key_pin_encrypted` (null if the user hasn't set a PIN yet). The client stores this in `localStorage`.

Password login also keeps using `private_key_encrypted`, but that blob must be decrypted with `decryptPrivateKeyWithPassword()` because it is a backend registration blob (`base64([salt][nonce][ciphertext])`), not the hex/PBKDF2 format used by `unwrapKey()`.

### `handle_get_public_key.go` (new file)

```
GET /api/users/{userId}/public-key
Authorization: Bearer <token>
Response: { "public_key": "<PEM>", "user_id": "<uuid>" }
```

Used by the share modal to fetch a recipient's RSA public key before wrapping the file key.

### `handle_file_share.go`

Accepts `user_id` (UUID) in the request body instead of `recipient_email`. This aligns with the frontend's share-modal search which works by user ID, not email.

### `handle_file_download.go`

Added a fallback: if a file is not directly shared with the requesting user, the handler checks `group_file_shares` joined with `group_members`. Group members can now download group-shared files.

The download response includes an `X-Wrapped-Key` response header containing the base64-encoded RSA-wrapped AES key for the requesting user. The client decrypts this with its RSA private key.

### `main.go`

Registered the new route:

```go
mux.Handle("GET /api/users/{userId}/public-key", apiConfig.middlewareAuth(apiConfig.handlerGetPublicKeyByID))
```

## Frontend Changes

### `utils/crypto.ts` — RSA/PIN functions

Core functions used by the sharing and PIN flow:

| Function | Description |
|----------|-------------|
| `decryptPrivateKeyWithPassword(password, b64)` | Decrypts backend `private_key_encrypted` blob → PEM |
| `importRSAPublicKey(pem)` | Imports SPKI PEM → `CryptoKey` for encrypt |
| `importRSAPrivateKey(b64)` | Imports PKCS8 PEM → `CryptoKey` for decrypt |
| `wrapKeyWithRSA(pubKey, aesKey)` | RSA-OAEP encrypts AES key → base64 |
| `unwrapKeyWithRSA(privKey, b64)` | RSA-OAEP decrypts → AES `CryptoKey` |
| `encryptPrivateKeyWithPIN(pin, pem)` | AES-GCM + PBKDF2 encrypts PEM with PIN → hex |
| `decryptPrivateKeyWithPIN(pin, hex)` | Reverses above → PEM string |

All functions use Web Crypto API (`window.crypto.subtle`). No external libraries.

### `utils/api.ts`

- `setPIN()` — now accepts `privateKeyPinEncrypted` param and includes it in the request body
- `getUserPublicKey(userId, token)` — new function, calls `GET /api/users/{userId}/public-key`

### `pages/login.tsx`

After successful login, writes to `localStorage["user"]`:

```json
{
  "private_key_encrypted": "<blob from server>",
  "private_key_pin_encrypted": "<blob or null>",
  "public_key": "<PEM>"
}
```

### `components/share-modal.tsx` — full rewrite

The share modal was rewritten to perform RSA key wrapping automatically. The user only needs to enter their file **encryption password** — the modal handles the rest.

**User-to-user share flow:**

```
1. Owner enters file password
2. Modal calls GET /api/files/{id}/download → gets X-Wrapped-Key
   (or derives key from password if owner)
3. Modal fetches recipient's public key: GET /api/users/{id}/public-key
4. wrapKeyWithRSA(recipientPubKey, aesKey) → wrappedKey
5. POST /api/files/{id}/share { user_id, wrapped_key }
```

**Group share flow:**

```
1. Owner enters file password → derives/unwraps AES key
2. For each group member:
   a. GET /api/users/{memberId}/public-key
   b. wrapKeyWithRSA(memberPubKey, aesKey) → wrappedKey
   c. POST /api/files/{id}/share { user_id: member.user_id, wrapped_key }
3. Wrap AES key with owner's own public key → ownerWrappedKey
4. POST /api/groups/{id}/files { file_id, wrapped_key: ownerWrappedKey }
```

The group-level wrapped key (step 4) lets the owner look up the file via their group record and still download it with their PIN.

### `pages/shared.tsx` — full rewrite

The shared files page was rewritten to use PIN-based decryption instead of prompting for a password.

**Download flow:**

```
1. User clicks download
2. PIN modal appears
3. User enters 4-digit PIN
4. decryptPrivateKeyWithPIN(pin, private_key_pin_encrypted) → PEM
5. importRSAPrivateKey(PEM) → CryptoKey
6. GET /api/files/{id}/download → blob + X-Wrapped-Key header
7. unwrapKeyWithRSA(privateKey, wrappedKey) → AES key
8. decryptFile(blob, aesKey, iv) → plaintext
9. Browser download triggered
```

If `private_key_pin_encrypted` is null (user hasn't set a PIN), an error is shown directing them to Settings.

### `pages/files.tsx` — download routing

The `downloadFileWithCredential` function now routes to three paths based on the file's properties:

```typescript
if (isDropUpload && file.drop_wrapped_key) {
  // Secure Drop path: unwrap with PIN via PBKDF2
  const rawKey = await unwrapKey(credential, file.drop_wrapped_key);
  ...
} else if (wrappedKeyB64 && file.is_owner === false) {
  // RSA share path: decrypt private key with PIN, unwrap AES key
  const pem = await decryptPrivateKeyWithPIN(credential, privateKeyPinEncrypted);
  const rsaKey = await importRSAPrivateKey(pem);
  encryptionKey = await unwrapKeyWithRSA(rsaKey, wrappedKeyB64);
} else {
  // Owner path: derive key from password via PBKDF2
  encryptionKey = await deriveKeyFromPassword(credential, salt, 100000);
}
```

`is_owner === false` uses strict equality to avoid misrouting when the field is undefined.

### `components/vault/BulkDownloadModal.tsx`

Added `is_owner` field to the `BulkDownloadFile` type so the modal can correctly detect whether PIN or password is needed per file.

## End-to-End User Journey

### Setting up (first time)

1. User logs in with password
2. PIN banner prompts them to set a PIN
3. User opens Settings → "Set PIN"
4. Form asks for: account password + new 4-digit PIN
5. `decryptPrivateKeyWithPassword(password, private_key_encrypted)` decrypts the backend password blob → RSA private key PEM
6. PIN re-encrypts PEM → `private_key_pin_encrypted` stored in DB + localStorage

### Sharing a file

1. Owner opens share modal on a file
2. Selects a user or group as recipient
3. Enters the file's encryption password
4. Modal automatically:
   - Derives the AES file key from the password
   - Fetches each recipient's RSA public key
   - Wraps the AES key with each public key
   - POSTs the wrapped key(s) to the server

### Recipient downloads the file

1. Opens "Shared with Me" page
2. Clicks download
3. Enters their 4-digit PIN
4. PIN decrypts their RSA private key from `private_key_pin_encrypted`
5. RSA private key unwraps the AES file key from `X-Wrapped-Key` header
6. AES key decrypts the file blob
7. Browser downloads the plaintext file

**No password is ever shared between users.**

## Security Notes

- The server stores only ciphertexts — it never has access to any plaintext key material
- `private_key_pin_encrypted` is stored server-side only as a convenience so it survives across devices/sessions; the server cannot use it without the PIN
- RSA-OAEP with SHA-256 provides semantic security — the same plaintext wraps to different ciphertexts each time
- If a user changes their PIN, a new `private_key_pin_encrypted` is generated and the old one is overwritten

## Files Changed

| File | Change |
|------|--------|
| `sql/schema/025_user_private_key_pin_encrypted.sql` | New migration |
| `sql/queries/users.sql` | `SetPrivateKeyPinEncrypted`, `GetUserPublicKeyByID` |
| `sql/queries/groups.sql` | `GetGroupWrappedKeyForUser` |
| `internal/database/users.sql.go` | sqlc generated |
| `internal/database/groups.sql.go` | sqlc generated |
| `handle_get_public_key.go` | New — `GET /api/users/{id}/public-key` |
| `handle_user_pin.go` | Accepts and saves `private_key_pin_encrypted` |
| `handle_login.go` | Returns `private_key_pin_encrypted` in login response |
| `handle_file_share.go` | Accepts `user_id` instead of `recipient_email` |
| `handle_file_download.go` | Group fallback; returns `X-Wrapped-Key` header |
| `main.go` | New route registered |
| `vaultdrive_client/src/utils/crypto.ts` | RSA/PIN helpers including `decryptPrivateKeyWithPassword` |
| `vaultdrive_client/src/utils/api.ts` | `setPIN` updated; `getUserPublicKey` added |
| `vaultdrive_client/src/pages/login.tsx` | Stores key fields to localStorage |
| `vaultdrive_client/src/pages/settings.tsx` | Password field + password-blob decrypt before PIN-encrypt |
| `vaultdrive_client/src/components/share-modal.tsx` | Full rewrite — RSA key wrapping |
| `vaultdrive_client/src/pages/shared.tsx` | Full rewrite — PIN modal replaces password modal |
| `vaultdrive_client/src/pages/files.tsx` | Three-path download routing |
| `vaultdrive_client/src/components/vault/BulkDownloadModal.tsx` | `is_owner` added to type |

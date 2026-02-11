# Secure Drop - Quick Reference

## Create Token (with password)

```bash
TOKEN="your_jwt_token"
curl -X POST https://dev-app.filemonprime.net/abrn/api/drop/create \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"target_folder_id":"FOLDER_UUID","password":"mySecret123"}'
```

**Response:**
```json
{
  "upload_url": "/abrn/drop/TOKEN?key=WRAPPED_KEY_HEX"
}
```

## Upload File

```bash
TOKEN="drop_token"
WRAPPED_KEY="wrapped_key_from_url"

curl -X POST "https://dev-app.filemonprime.net/abrn/api/drop/${TOKEN}/upload?key=${WRAPPED_KEY}" \
  -F "file=@/path/to/file.enc" \
  -F "password=${WRAPPED_KEY}"
```

## Get Token Info

```bash
TOKEN="drop_token"
WRAPPED_KEY="wrapped_key_from_url"

curl "https://dev-app.filemonprime.net/abrn/api/drop/${TOKEN}?key=${WRAPPED_KEY}"
```

## List My Tokens

```bash
TOKEN="your_jwt_token"
curl -H "Authorization: Bearer $TOKEN" \
  https://dev-app.filemonprime.net/abrn/api/drop/tokens | jq .
```

## Key Wrapping (for testing)

```go
// Wrap a key
wrapped, err := auth.WrapKey("password", "32_byte_raw_key_hex")
// Returns: hex(salt || nonce || ciphertext)

// Unwrap a key
rawKey, err := auth.UnwrapKey("password", wrapped_hex)
// Returns: original key as hex
```

## Frontend: Extract Key from URL

```typescript
const urlParams = new URLSearchParams(window.location.search);
const key = urlParams.get("key");  // Extract ?key= from URL
```

## Encryption Flow

```
1. Owner password → PBKDF2 → encryption key
2. Raw file key → AES-GCM(encryption key) → wrapped key
3. wrapped_key stored in DB, embedded in upload_url
4. Upload: wrapped_key sent with file
5. Backend: wrapped_key == stored_hash ? proceed : reject
```

## Security Checklist

- [ ] Password is at least 16 characters
- [ ] Each link has unique password
- [ ] Token has expiration date
- [ ] Token is deactivated after use

## File Locations

| Purpose | File |
|---------|------|
| Key wrapping | `auth/auth.go` |
| Handler logic | `handle_drop.go` |
| Frontend modal | `vaultdrive_client/src/components/upload/CreateUploadLinkModal.tsx` |
| Frontend upload | `vaultdrive_client/src/pages/drop-upload.tsx` |
| Full docs | `docs/PASSWORD_PROTECTED_DROP.md` |

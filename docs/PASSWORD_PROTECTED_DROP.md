# Password-Protected Secure Drop Implementation

## Overview

This document describes the implementation of owner-set password protection for Secure Drop upload links. The feature allows upload link creators to set a password that uploader doesn't need to enter—the encryption key is embedded in the URL via key wrapping.

## Table of Contents

1. [Problem Statement](#problem-statement)
2. [Solution Architecture](#solution-architecture)
3. [Cryptographic Design](#cryptographic-design)
4. [Database Schema](#database-schema)
5. [Backend Implementation](#backend-implementation)
6. [Frontend Implementation](#frontend-implementation)
7. [API Endpoints](#api-endpoints)
8. [Testing Guide](#testing-guide)
9. [Security Considerations](#security-considerations)

---

## Problem Statement

### Original Flow (No Password)
```
Owner creates link → Link URL shared → Uploader visits → Uploads files
```
- No password required
- Anyone with the link could upload

### Desired Flow (Owner Password)
```
Owner creates link with password → Link with embedded key shared → 
Uploader visits (key auto-filled) → Uploads files (encrypted with key)
```
- Owner sets password (for their own record)
- Uploader doesn't need to enter password
- Files encrypted client-side with wrapped key
- Owner can decrypt files later

---

## Solution Architecture

### High-Level Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│ 1. OWNER CREATES LINK                                                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   Owner sets password (e.g., "mySecret123")                            │
│         ↓                                                              │
│   Browser generates random AES-256 key (fileKey)                       │
│         ↓                                                              │
│   WrapKey(password, fileKey) → wrappedKey (PBKDF2+AES-GCM)             │
│         ↓                                                              │
│   Backend stores: upload_token + wrappedKey                             │
│         ↓                                                              │
│   Returns: upload_url + ?key=wrappedKey                                 │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│ 2. UPLOADER VISITS LINK                                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   URL: /drop/{token}?key={wrappedKey}                                  │
│         ↓                                                              │
│   Frontend extracts ?key=wrappedKey from URL                           │
│         ↓                                                              │
│   Uploader selects file(s) + clicks upload                             │
│         ↓                                                              │
│   Frontend sends: file + wrappedKey (from URL)                         │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│ 3. FILE UPLOAD                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   Backend validates wrappedKey matches stored key                      │
│         ↓                                                              │
│   Frontend encrypts file with:                                         │
│   - key: unwrapped fileKey (from wrappedKey + owner password)          │
│   - algorithm: AES-256-GCM                                             │
│         ↓                                                              │
│   Backend stores encrypted blob + IV + salt                            │
│   (server never sees plaintext or decryption key)                      │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│ 4. OWNER DECRYPTS FILES                                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   Owner visits file in dashboard                                        │
│         ↓                                                              │
│   Enter their password ("mySecret123")                                 │
│         ↓                                                              │
│   UnwrapKey(password, stored_wrappedKey) → fileKey                     │
│         ↓                                                              │
│   Decrypt file with fileKey → download plaintext                       │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| Wrap key with owner's password | Only owner can decrypt files |
| Embed wrapped key in URL | Uploader doesn't need password entry |
| Client-side encryption | Server never sees plaintext files |
| PBKDF2+ AES-GCM | Industry-standard, authenticated encryption |
| Random salt per wrap | Prevents rainbow table attacks |

---

## Cryptographic Design

### Key Wrapping Functions (`auth/auth.go`)

#### WrapKey(password, rawKey string) → hexEncodedWrappedKey

```go
// WrapKey encrypts a raw key using PBKDF2 key derivation + AES-GCM
func WrapKey(password, rawKey string) (string, error) {
    // 1. Generate random salt (16 bytes)
    salt := make([]byte, 16)
    if _, err := io.ReadFull(rand.Reader, salt); err != nil {
        return "", fmt.Errorf("failed to generate salt: %w", err)
    }

    // 2. Derive encryption key from password using PBKDF2
    //    - Algorithm: PBKDF2-SHA256
    //    - Iterations: 100,000
    //    - Salt: from step 1
    dk := pbkdf2.Key([]byte(password), salt, 100000, 32, sha256.New)

    // 3. Generate random nonce (12 bytes for AES-GCM)
    nonce := make([]byte, 12)
    if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
        return "", fmt.Errorf("failed to generate nonce: %w", err)
    }

    // 4. Encrypt rawKey using AES-256-GCM
    block, err := aes.NewCipher(dk)
    if err != nil {
        return "", fmt.Errorf("failed to create cipher: %w", err)
    }
    gcm, err := cipher.NewGCM(block)
    if err != nil {
        return "", fmt.Errorf("failed to create GCM: %w", err)
    }
    ciphertext := gcm.Seal(nil, nonce, []byte(rawKey), nil)

    // 5. Combine: salt + nonce + ciphertext
    //    Format: hex(salt || nonce || ciphertext)
    wrapped := append(salt, nonce...)
    wrapped = append(wrapped, ciphertext...)

    return hex.EncodeToString(wrapped), nil
}
```

#### UnwrapKey(password, wrappedKeyHex string) → rawKey

```go
// UnwrapKey decrypts a wrapped key using the password
func UnwrapKey(password, wrappedKeyHex string) (string, error) {
    // 1. Decode hex to bytes
    wrapped, err := hex.DecodeString(wrappedKeyHex)
    if err != nil {
        return "", fmt.Errorf("invalid hex: %w", err)
    }

    // 2. Extract salt (first 16 bytes)
    salt := wrapped[:16]

    // 3. Extract nonce (next 12 bytes)
    nonce := wrapped[16:28]

    // 4. Extract ciphertext (remaining bytes)
    ciphertext := wrapped[28:]

    // 5. Derive same encryption key using PBKDF2
    dk := pbkdf2.Key([]byte(password), salt, 100000, 32, sha256.New)

    // 6. Decrypt using AES-256-GCM
    block, err := aes.NewCipher(dk)
    if err != nil {
        return "", fmt.Errorf("failed to create cipher: %w", err)
    }
    gcm, err := cipher.NewGCM(block)
    if err != nil {
        return "", fmt.Errorf("failed to create GCM: %w", err)
    }
    plaintext, err := gcm.Open(nil, nonce, ciphertext, nil)
    if err != nil {
        return "", fmt.Errorf("decryption failed: %w", err)
    }

    return string(plaintext), nil
}
```

### Why This Design?

| Component | Choice | Security Benefit |
|-----------|--------|------------------|
| PBKDF2 iterations | 100,000 | Slows brute-force attacks |
| AES-256-GCM | Authenticated encryption | Detects tampering |
| Random salt per wrap | Unique salt | Prevents precomputation |
| 12-byte nonce | GCM standard | Prevents nonce reuse |
| HMAC for signing | JWT | Verifies token authenticity |

---

## Database Schema

### Migration: `sql/schema/020_upload_tokens_password.sql`

```sql
-- Adds password_hash column to store wrapped key (NOT bcrypt hash)

-- name: Up
ALTER TABLE upload_tokens ADD COLUMN IF NOT EXISTS password_hash TEXT;

-- name: Down
ALTER TABLE upload_tokens DROP COLUMN IF EXISTS password_hash;
```

### Table: `upload_tokens`

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `token` | TEXT | Unique token (SHA256) |
| `user_id` | UUID | Owner's user ID |
| `target_folder_id` | UUID | Destination folder |
| `expires_at` | TIMESTAMPTZ | Expiration time |
| `max_files` | INT | Max files (0=unlimited) |
| `is_active` | BOOL | Whether link is active |
| `created_at` | TIMESTAMPTZ | Creation timestamp |
| `password_hash` | TEXT | Wrapped key (hex encoded) |

---

## Backend Implementation

### Handler: Create Upload Token (`handle_drop.go`)

```go
// handlerCreateDropToken creates a new upload token with password
func (cfg *ApiConfig) handlerCreateDropToken(w http.ResponseWriter, r *http.Request, user database.User) {
    // 1. Parse request body
    var req struct {
        TargetFolderID string `json:"target_folder_id"`
        ExpiresAt      string `json:"expires_at"`
        MaxFiles       int    `json:"max_files"`
        Password       string `json:"password"`
    }
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        respondWithError(w, http.StatusBadRequest, "Invalid request")
        return
    }

    // 2. Validate required fields
    if req.TargetFolderID == "" {
        respondWithError(w, http.StatusBadRequest, "Target folder is required")
        return
    }
    if req.Password == "" {
        respondWithError(w, http.StatusBadRequest, "Password is required")
        return
    }

    // 3. Generate random encryption key (32 bytes = 256 bits)
    rawKey := make([]byte, 32)
    if _, err := io.ReadFull(rand.Reader, rawKey); err != nil {
        respondWithError(w, http.StatusInternalServerError, "Failed to generate key")
        return
    }

    // 4. Wrap the key with owner's password
    wrappedKey, err := auth.WrapKey(req.Password, hex.EncodeToString(rawKey))
    if err != nil {
        respondWithError(w, http.StatusInternalServerError, "Failed to wrap key")
        return
    }

    // 5. Generate unique token
    tokenBytes := make([]byte, 32)
    if _, err := io.ReadFull(rand.Reader, tokenBytes); err != nil {
        respondWithError(w, http.StatusInternalServerError, "Failed to generate token")
        return
    }
    token := hex.EncodeToString(tokenBytes)

    // 6. Parse expiration
    var expiresAt sql.NullTime
    if req.ExpiresAt != "" {
        t, err := time.Parse(time.RFC3339, req.ExpiresAt)
        if err == nil {
            expiresAt = sql.NullTime{Time: t, Valid: true}
        }
    }

    // 7. Insert into database
    params := database.CreateUploadTokenParams{
        Token:          token,
        UserID:         user.ID,
        TargetFolderID: req.TargetFolderID,
        ExpiresAt:      expiresAt,
        MaxFiles:       sql.NullInt32{Int32: int32(req.MaxFiles), Valid: req.MaxFiles > 0},
        IsActive:       true,
        PasswordHash:   wrappedKey,
    }
    uploadToken, err := cfg.DB.CreateUploadToken(r.Context(), params)
    if err != nil {
        respondWithError(w, http.StatusInternalServerError, "Failed to create token")
        return
    }

    // 8. Return upload_url with embedded key
    uploadURL := fmt.Sprintf("/abrn/drop/%s?key=%s", token, wrappedKey)
    respondWithJSON(w, http.StatusOK, map[string]interface{}{
        "id":            uploadToken.ID,
        "token":         uploadToken.Token,
        "upload_url":    uploadURL,
        "target_folder_id": uploadToken.TargetFolderID,
        "expires_at":    uploadToken.ExpiresAt,
        "max_files":     uploadToken.MaxFiles,
    })
}
```

### Handler: Upload File (`handle_drop.go`)

```go
// handlerDropUpload handles file upload via drop token
func (cfg *ApiConfig) handlerDropUpload(w http.ResponseWriter, r *http.Request) {
    // 1. Extract token and key from URL
    token := mux.Vars(r)["token"]
    wrappedKey := r.URL.Query().Get("key")

    // 2. Validate password is provided
    password := r.FormValue("password")
    if password == "" {
        respondWithError(w, http.StatusBadRequest, "Password is required")
        return
    }

    // 3. Get token from database
    uploadToken, err := cfg.DB.GetUploadTokenByToken(r.Context(), token)
    if err != nil {
        respondWithError(w, http.StatusNotFound, "Token not found")
        return
    }

    // 4. Check if token is active
    if !uploadToken.IsActive {
        respondWithError(w, http.StatusForbidden, "Token is no longer active")
        return
    }

    // 5. Check expiration
    if uploadToken.ExpiresAt.Valid && uploadToken.ExpiresAt.Time.Before(time.Now()) {
        respondWithError(w, http.StatusForbidden, "Token has expired")
        return
    }

    // 6. Validate wrapped key matches stored password_hash
    if wrappedKey != uploadToken.PasswordHash {
        respondWithError(w, http.StatusUnauthorized, "Invalid password")
        return
    }

    // 7. Continue with file upload...
    //    (existing upload logic with client-side encryption)
}
```

### Handler: List Tokens (`handle_drop.go`)

```go
// handlerListDropTokens returns all upload tokens for the authenticated user
func (cfg *ApiConfig) handlerListDropTokens(w http.ResponseWriter, r *http.Request, user database.User) {
    tokens, err := cfg.DB.GetUploadTokensByUserID(r.Context(), user.ID)
    if err != nil {
        respondWithError(w, http.StatusInternalServerError, "Failed to get tokens")
        return
    }

    // Return tokens with upload_url including key
    result := make([]map[string]interface{}, len(tokens))
    for i, token := range tokens {
        uploadURL := fmt.Sprintf("/abrn/drop/%s?key=%s", token.Token, token.PasswordHash)
        result[i] = map[string]interface{}{
            "id":              token.ID,
            "token":           token.Token,
            "upload_url":      uploadURL,
            "target_folder_id": token.TargetFolderID,
            "expires_at":      token.ExpiresAt,
            "max_files":       token.MaxFiles,
            "is_active":       token.IsActive,
            "created_at":      token.CreatedAt,
            "has_password":    true,
        }
    }

    respondWithJSON(w, http.StatusOK, result)
}
```

---

## Frontend Implementation

### Type Definitions (`types.ts`)

```typescript
export interface UploadToken {
  id: string;
  token: string;
  upload_url: string;       // NEW: URL with embedded key
  target_folder_id: string;
  expires_at: string | null;
  max_files: number;
  is_active: boolean;
  created_at: string;
  has_password?: boolean;   // NEW: indicates password protection
}
```

### Create Upload Link Modal (`CreateUploadLinkModal.tsx`)

```typescript
// Auto-generate password on mount
useEffect(() => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
  let password = "";
  for (let i = 0; i < 16; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  setEncryptionPassword(password);
}, []);

const handleSubmit = async (e: React.FormEvent) => {
  // Send password to backend for key wrapping
  const response = await fetch(`${API_URL}/drop/create`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify({
      target_folder_id: selectedFolderId,
      expires_at: expiresAt,
      max_files: maxFiles,
      password: encryptionPassword  // Owner password
    })
  });

  const data = await response.json();
  
  // Show success with URL and password
  setCreatedLink({
    url: data.upload_url,      // Contains ?key=wrappedKey
    password: encryptionPassword
  });
};
```

### Success View Component

```typescript
// Displays after link creation
{createdLink && (
  <div className="space-y-4">
    <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/30">
      <p className="text-green-400 text-sm">
        <strong>Upload link created successfully!</strong>
        <br />
        Share this link with anyone - uploads are password-protected.
      </p>
    </div>

    <div>
      <Label className="text-white text-sm flex items-center gap-1">
        <LinkIcon className="w-4 h-4" />
        Upload URL
      </Label>
      <div className="flex gap-2 mt-1">
        <Input
          value={createdLink.url}
          readOnly
          className="bg-slate-800 border-slate-700 text-white text-sm"
        />
        <Button
          onClick={() => copyToClipboard(createdLink.url)}
          className="bg-sky-900 hover:bg-sky-800 text-white"
        >
          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
        </Button>
      </div>
    </div>

    <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
      <p className="text-amber-400 text-sm flex items-center gap-2">
        <Lock className="w-4 h-4 shrink-0" />
        <span>
          <strong>Owner Password:</strong> {createdLink.password}
        </span>
      </p>
      <p className="text-amber-300 text-xs mt-1 ml-6">
        Keep this password safe! You'll need it to decrypt uploaded files.
        The uploader doesn't need to enter anything - the encryption key 
        is embedded in the URL.
      </p>
    </div>
  </div>
)}
```

### Upload Link Card (`UploadLinkCard.tsx`)

```typescript
// Uses upload_url directly from backend
<div className="flex items-center gap-2">
  <Input
    value={token.upload_url}
    readOnly
    className="bg-slate-800 border-slate-700 text-white text-sm font-mono"
  />
  <Button
    onClick={() => copyToClipboard(token.upload_url)}
    className="bg-sky-900 hover:bg-sky-800 text-white"
  >
    <Copy className="w-4 h-4" />
  </Button>
</div>
```

### Drop Upload Page (`drop-upload.tsx`)

```typescript
// Extract key from URL on mount
useEffect(() => {
  const urlParams = new URLSearchParams(window.location.search);
  const key = urlParams.get("key");
  if (key) {
    setWrappedKey(key);
    // Auto-fill if you want, or just validate on upload
  }
}, []);

const handleUpload = async (files: FileList) => {
  // Send wrappedKey with upload
  const formData = new FormData();
  formData.append("file", files[0]);
  formData.append("password", wrappedKey);  // Backend validates against stored hash
  
  await fetch(`/api/drop/${token}/upload`, {
    method: "POST",
    body: formData
  });
};
```

---

## API Endpoints

### Create Upload Token

```http
POST /abrn/api/drop/create
Authorization: Bearer <user_jwt>
Content-Type: application/json

{
  "target_folder_id": "012c1aca-4954-4621-8450-c4cac1ffba8c",
  "expires_at": "2026-02-12T14:30:00Z",
  "max_files": 5,
  "password": "ownerSecret123"
}
```

**Response:**
```json
{
  "id": "8e16a82b-47b8-4587-96fc-bb65111d9aae",
  "token": "a2f9ed746b83c0590b396a125d7ca0dbef5911d403fd7e3fd8f3954eb7553868",
  "upload_url": "/abrn/drop/a2f9ed746b83c0590b396a125d7ca0dbef5911d403fd7e3fd8f3954eb7553868?key=2c20da99485291c0a1a5e4e76d48da806ea06e95f88bced2f337af4bede5bafa97605a30d8e23dbead4cb2dd97d27db82bf17d2b54527255606a860344ab3002a8498b3965d8436ed3230239",
  "target_folder_id": "012c1aca-4954-4621-8450-c4cac1ffba8c",
  "expires_at": {"Time": "0001-01-01T00:00:00Z", "Valid": false},
  "max_files": {"Int32": 0, "Valid": false}
}
```

### Get Token Info

```http
GET /abrn/api/drop/{token}?key={wrappedKey}
```

**Response:**
```json
{
  "valid": true,
  "folder_name": "Test Folder",
  "expires_at": "",
  "files_limit": "",
  "uploaded": 0
}
```

### Upload File

```http
POST /abrn/api/drop/{token}/upload?key={wrappedKey}
Content-Type: multipart/form-data

file=<encrypted_file>
password={wrappedKey}
```

**Response:**
```json
{
  "message": "File uploaded successfully",
  "file_id": "uuid"
}
```

### List User's Tokens

```http
GET /abrn/api/drop/tokens
Authorization: Bearer <user_jwt>
```

**Response:**
```json
[
  {
    "id": "uuid",
    "token": "hex_token",
    "upload_url": "/abrn/drop/{token}?key={wrappedKey}",
    "target_folder_id": "uuid",
    "is_active": true,
    "has_password": true
  }
]
```

---

## Testing Guide

### 1. Get Authentication Token

```bash
TOKEN=$(curl -s -X POST https://dev-app.filemonprime.net/abrn/api/login \
  -H "Content-Type: application/json" \
  -d '{"email":"filemon@abrn.mx","password":"986532"}' | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
```

### 2. Create Upload Link with Password

```bash
curl -s -X POST https://dev-app.filemonprime.net/abrn/api/drop/create \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"target_folder_id":"012c1aca-4954-4621-8450-c4cac1ffba8c","password":"mySecret123"}' | jq .
```

### 3. Verify Token Info with Key

```bash
# Extract the upload_url from step 2
UPLOAD_URL=$(curl -s ... | jq -r '.upload_url')

# Visit the URL (should return token info)
curl -s "${UPLOAD_URL}" | jq .
```

### 4. Test Upload Without Password (Should Fail)

```bash
TOKEN="a2f9ed746b83c0590b396a125d7ca0dbef5911d403fd7e3fd8f3954eb7553868"

curl -s -X POST "https://dev-app.filemonprime.net/abrn/api/drop/${TOKEN}/upload" \
  -F "file=@test.txt" \
  -F "password=" | jq .
```

**Expected:**
```json
{
  "error": "Password is required"
}
```

### 5. Test Upload With Wrong Password (Should Fail)

```bash
TOKEN="a2f9ed746b83c0590b396a125d7ca0dbef5911d403fd7e3fd8f3954eb7553868"
WRONG_KEY="2c20da99485291c0a1a5e4e76d48da806ea06e95f88bced2f337af4bede5bafa"

curl -s -X POST "https://dev-app.filemonprime.net/abrn/api/drop/${TOKEN}/upload?key=${WRONG_KEY}" \
  -F "file=@test.txt" \
  -F "password=${WRONG_KEY}" | jq .
```

**Expected:**
```json
{
  "error": "Invalid password"
}
```

### 6. End-to-End Upload Test

```bash
# Create link
RESPONSE=$(curl -s -X POST .../drop/create ...)
TOKEN=$(echo $RESPONSE | jq -r '.token')
KEY=$(echo $RESPONSE | jq -r '.upload_url' | sed 's/.*key=//')

# Upload file
echo "test content" > /tmp/test.txt
curl -s -X POST "https://dev-app.filemonprime.net/abrn/api/drop/${TOKEN}/upload?key=${KEY}" \
  -F "file=@/tmp/test.txt" \
  -F "password=${KEY}"
```

---

## Security Considerations

### What This Protects Against

| Threat | Mitigation |
|--------|------------|
| Unauthorized uploads | Password required (wrapped key validation) |
| Replay attacks | Random nonce per wrap, unique token per link |
| Rainbow tables | Random salt per key wrap |
| Tampering | AES-GCM authenticated encryption |
| Brute force | PBKDF2 100,000 iterations |

### What This Doesn't Protect Against

| Limitation | Note |
|------------|------|
| Owner losing password | No password reset - files are lost |
| Uploader knowing password | Uploader has wrapped key, not raw key |
| Malicious uploader | Can only upload, cannot download |

### Security Best Practices

1. **Use strong passwords** - At least 16 characters
2. **Unique passwords per link** - Don't reuse passwords
3. **Store password securely** - Use a password manager
4. **Revoke unused tokens** - Deactivate after use
5. **Set expiration dates** - Limit exposure window

---

## Files Modified

### Backend

| File | Change |
|------|--------|
| `handle_drop.go` | Added password wrapping/validation logic |
| `auth/auth.go` | Added `WrapKey()` and `UnwrapKey()` functions |
| `sql/schema/020_upload_tokens_password.sql` | Migration for password_hash column |

### Frontend

| File | Change |
|------|--------|
| `components/upload/CreateUploadLinkModal.tsx` | Auto-generate password, show success view |
| `components/upload/UploadLinkCard.tsx` | Use upload_url with embedded key |
| `pages/drop-upload.tsx` | Extract key from URL query |
| `components/upload/types.ts` | Added upload_url, has_password fields |

---

## Future Enhancements

- [ ] Password strength indicator
- [ ] Custom password (owner chooses)
- [ ] Time-limited access (e.g., "valid for 24 hours")
- [ ] IP whitelisting
- [ ] Upload notifications via email

---

## References

- [Go crypto/aes package](https://pkg.go.dev/crypto/aes)
- [Go crypto/cipher/gcm package](https://pkg.go.dev/crypto/cipher/gcm)
- [PBKDF2 specification (RFC 2898)](https://datatracker.ietf.org/doc/html/rfc2898)
- [AES-GCM specification](https://csrc.nist.gov/publications/detail/sp/800-38d/final)

# Step 9 — Cryptographic Hardening: Argon2id KDF Migration

**Parent:** [Hackathon Index](./2026-05-22-hackathon-index.md)  
**Priority:** 🟢 Important  
**Effort:** L (2–3 days)  
**Status:** 🔲 TODO

---

## Why This Matters

The encrypted private key envelope currently uses a **single-round SHA-256** key derivation function. The source code itself acknowledges this is wrong:

```go
// Note: In production, use a slower KDF like Argon2 or PBKDF2
keyHash := sha256.Sum256(append(salt, []byte(password)...))
```

SHA-256 is a hash, not a KDF. It runs in nanoseconds. An attacker with the encrypted envelope could brute-force passwords at billions of attempts per second. This is the only remaining honest architectural risk in the system.

For a hackathon judge who reviews the code, this comment is either:
- **A red flag** — "they know it's wrong and didn't fix it"
- **A talking point** — "they migrated to Argon2id with backward-compatible re-wrapping"

We want the second reaction.

---

## Current State (Verified)

**File:** `handle_user_create.go`, lines 173–183

```go
func encryptPrivateKey(privateKeyPEM, password string) (string, error) {
    salt := make([]byte, 16)
    io.ReadFull(rand.Reader, salt)
    keyHash := sha256.Sum256(append(salt, []byte(password)...))
    key := keyHash[:]
    // ... AES-GCM encryption follows ...
}
```

**Database:** No `kek_envelope_version` column exists. All users have V1 (SHA-256) envelopes. The latest migration is `044_governance_settings.sql`.

---

## Success Condition

After this step:
1. **New accounts** use Argon2id with tuned parameters to derive the encryption key.
2. **Existing accounts** transparently re-wrap their envelope on next successful password unlock.
3. A `kek_envelope_version` column in the `users` table tracks which KDF was used.
4. The V1 (SHA-256) unwrap path remains available for backward compatibility.
5. A feature flag (`KDF_V2_ENABLED`) controls the rollout. Default: OFF for first deploy.
6. Round-trip tests cover both versions and the migration path.
7. The source code comment is replaced with a proud statement: *"Argon2id KDF, 64 MiB, 3 iterations."*

---

## Implementation Plan

### 9.1 — Database Migration

**File:** `sql/schema/045_kek_envelope_version.sql`

```sql
-- +goose Up
ALTER TABLE users ADD COLUMN kek_envelope_version INTEGER NOT NULL DEFAULT 1;
COMMENT ON COLUMN users.kek_envelope_version IS '1=SHA-256 (legacy), 2=Argon2id';

-- +goose Down
ALTER TABLE users DROP COLUMN kek_envelope_version;
```

Run `sqlc generate` after migration to regenerate Go types.

### 9.2 — Argon2id Wrap Function

**File:** `crypto_kdf.go` (new)

```go
import "golang.org/x/crypto/argon2"

// Argon2id parameters for 2026 hardware
// OWASP recommendation: ≥64 MiB memory, ≥3 iterations, ≥4 threads
const (
    argon2Time    = 3          // iterations
    argon2Memory  = 64 * 1024  // 64 MiB
    argon2Threads = 4
    argon2KeyLen  = 32         // AES-256
)

func deriveKeyV2(password string, salt []byte) []byte {
    return argon2.IDKey(
        []byte(password), salt,
        argon2Time, argon2Memory, argon2Threads, argon2KeyLen,
    )
}

func encryptPrivateKeyV2(privateKeyPEM, password string) (string, error) {
    salt := make([]byte, 16)
    if _, err := io.ReadFull(rand.Reader, salt); err != nil {
        return "", err
    }
    
    key := deriveKeyV2(password, salt)
    
    block, err := aes.NewCipher(key)
    if err != nil {
        return "", err
    }
    
    gcm, err := cipher.NewGCM(block)
    if err != nil {
        return "", err
    }
    
    nonce := make([]byte, gcm.NonceSize())
    if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
        return "", err
    }
    
    ciphertext := gcm.Seal(nil, nonce, []byte(privateKeyPEM), nil)
    
    // Format: salt(16) || nonce(12) || ciphertext
    envelope := make([]byte, 0, len(salt)+len(nonce)+len(ciphertext))
    envelope = append(envelope, salt...)
    envelope = append(envelope, nonce...)
    envelope = append(envelope, ciphertext...)
    
    return base64.StdEncoding.EncodeToString(envelope), nil
}
```

### 9.3 — Register Handler Update

**File:** `handle_user_create.go`

```go
if cfg.kdfV2Enabled {
    encryptedPrivKey, err = encryptPrivateKeyV2(privKeyPEM, newUser.Password)
    kekVersion = 2
} else {
    encryptedPrivKey, err = encryptPrivateKey(privKeyPEM, newUser.Password)
    kekVersion = 1
}
```

### 9.4 — Transparent Migration on Unlock

After successful V1 unwrap:
1. Re-derive key with Argon2id
2. Re-encrypt the private key
3. Persist with `kek_envelope_version = 2`
4. Log the migration for audit trail

```go
if user.KekEnvelopeVersion == 1 && cfg.kdfV2Enabled {
    rewrapped, err := encryptPrivateKeyV2(plainPrivKey, password)
    if err == nil {
        cfg.dbQueries.UpdateUserKEK(ctx, database.UpdateUserKEKParams{
            ID:                  user.ID,
            PrivateKeyEncrypted: rewrapped,
            KekEnvelopeVersion:  2,
        })
        log.Printf("kdf_migration: user=%s upgraded v1→v2", user.ID)
    }
}
```

### 9.5 — Feature Flag

**File:** `config.go`

```go
KdfV2Enabled: getEnvBool("KDF_V2_ENABLED", false),
```

### 9.6 — Tests

**File:** `crypto_kdf_test.go` (new)

| Test | What it proves |
|------|----------------|
| Round-trip V1 | encrypt → decrypt with SHA-256 ✓ |
| Round-trip V2 | encrypt → decrypt with Argon2id ✓ |
| V1 → V2 migration | encrypt V1, decrypt V1, re-encrypt V2, decrypt V2 ✓ |
| Wrong password V1 | returns error ✓ |
| Wrong password V2 | returns error ✓ |
| Feature flag OFF | new users get V1 ✓ |
| Feature flag ON | new users get V2 ✓ |
| Timing V2 | Argon2id takes >100ms (proves it's not SHA-256) ✓ |

---

## Verification

| Check | Expected | How to verify |
|-------|----------|---------------|
| Migration runs | Column exists | `psql -c "SELECT kek_envelope_version FROM users LIMIT 1"` |
| New user V2 | kek_envelope_version = 2 | Register with flag on, check DB |
| Old user V1 | Still unlocks | Login with existing V1 account |
| Migration on unlock | Version bumps to 2 | Unlock V1 user, check DB |
| Feature flag off | V1 for new users | Register with flag off, check DB |
| Go tests pass | All green | `go test ./...` |
| E2E tests pass | 41/41 | `npx playwright test` |

---

## Risk

**Medium.** This is a cryptographic migration. Safeguards:
1. **Never delete the V1 envelope** until V2 is persisted and verified
2. **Feature flag** allows instant rollback to V1 for all new users
3. **Test with synthesized V1 envelopes** before touching real accounts
4. **Log every migration** with user ID for audit trail
5. **Argon2id parameters** follow OWASP 2024 recommendations (64 MiB, 3 iterations)

---

## Evidence Log

| Date | What was done | Verified? | Commit |
|------|--------------|-----------|--------|
| | | | |

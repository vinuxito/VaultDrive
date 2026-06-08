# Step 7 — Cryptographic Hardening: Argon2id KDF Migration

**Parent:** [Hackathon Index](./2026-05-21-hackathon-index.md)  
**Priority:** 🟢 Important  
**Effort:** L (2–3 days)

---

## Why This Matters

The encrypted private key envelope currently uses a **single-round SHA-256** key derivation function. The source code itself acknowledges this is wrong (comment: *"In production, use a slower KDF like Argon2 or PBKDF2"*).

While this is not exploitable without server compromise, it's the kind of finding a security-savvy judge will spot in a code review. More importantly, it's the kind of debt that ages badly — every new user who registers gets a weaker-than-necessary envelope.

This is the only remaining honest architectural risk in the system.

---

## Current State (Verified)

**File:** `handle_user_create.go`, lines 173–183

```go
func encryptPrivateKey(privateKeyPEM, password string) (string, error) {
    salt := make([]byte, 16)
    io.ReadFull(rand.Reader, salt)
    
    // Note: In production, use a slower KDF like Argon2 or PBKDF2
    keyHash := sha256.Sum256(append(salt, []byte(password)...))
    key := keyHash[:]
    
    // ... AES-GCM encryption follows ...
}
```

**Problem:** SHA-256 is a hash, not a KDF. It runs in nanoseconds. An attacker with the encrypted envelope could brute-force passwords at billions of attempts per second.

**Database:** No `kek_envelope_version` column exists. All users have V1 (SHA-256) envelopes. The latest migration is `044_governance_settings.sql`.

---

## Success Condition

After this step:
1. **New accounts** use Argon2id to derive the encryption key for the private key envelope.
2. **Existing accounts** transparently re-wrap their envelope on next successful PIN unlock.
3. A `kek_envelope_version` column tracks which KDF was used per user.
4. The V1 (SHA-256) unwrap path remains available for backward compatibility.
5. A feature flag (`KDF_V2_ENABLED`) controls the rollout.
6. Round-trip tests cover both versions and the migration path.

---

## Implementation Plan

### 7.1 — Database Migration

**File:** `sql/schema/045_kek_envelope_version.sql`

```sql
-- +goose Up
ALTER TABLE users ADD COLUMN kek_envelope_version INTEGER NOT NULL DEFAULT 1;
COMMENT ON COLUMN users.kek_envelope_version IS '1=SHA-256 (legacy), 2=Argon2id';

-- +goose Down
ALTER TABLE users DROP COLUMN kek_envelope_version;
```

Run `sqlc generate` after migration to regenerate the Go types.

### 7.2 — Argon2id Wrap Function

**File:** `handle_user_create.go` or a new `crypto_kdf.go`

```go
import "golang.org/x/crypto/argon2"

// Argon2id parameters for 2026 hardware
const (
    argon2Time    = 3      // iterations
    argon2Memory  = 64 * 1024  // 64 MiB
    argon2Threads = 4
    argon2KeyLen  = 32     // AES-256
)

func deriveKeyV2(password string, salt []byte) []byte {
    return argon2.IDKey(
        []byte(password), salt,
        argon2Time, argon2Memory, argon2Threads, argon2KeyLen,
    )
}
```

### 7.3 — Envelope Format

Both V1 and V2 envelopes are base64-encoded. The difference is the KDF used to derive the AES key:
- **V1:** `salt(16) || nonce(12) || ciphertext` — key = SHA-256(salt || password)
- **V2:** `salt(16) || nonce(12) || ciphertext` — key = Argon2id(password, salt, params)

The `kek_envelope_version` column tells the unwrap function which derivation to use.

### 7.4 — Register Handler Update

**File:** `handle_user_create.go`

```go
func (cfg *ApiConfig) registerUserHandler(...) {
    // ... existing validation ...
    
    if cfg.kdfV2Enabled {
        encryptedPrivKey, err = encryptPrivateKeyV2(privKeyPEM, newUser.Password)
        kekVersion = 2
    } else {
        encryptedPrivKey, err = encryptPrivateKey(privKeyPEM, newUser.Password)
        kekVersion = 1
    }
    
    // ... CreateUser with kekVersion ...
}
```

### 7.5 — Transparent Migration on PIN Unlock

**File:** Wherever the PIN unlock/decrypt handler lives.

After successful V1 unwrap:
1. Re-derive with Argon2id.
2. Re-encrypt the private key.
3. Persist with `kek_envelope_version = 2`.
4. Log `event=kdf_migration user_id=... version=2`.

```go
if user.KekEnvelopeVersion == 1 && cfg.kdfV2Enabled {
    rewrapped, err := encryptPrivateKeyV2(plainPrivKey, password)
    if err == nil {
        cfg.dbQueries.UpdateUserKEK(ctx, database.UpdateUserKEKParams{
            ID: user.ID,
            PrivateKeyEncrypted: rewrapped,
            KekEnvelopeVersion: 2,
        })
        log.Printf("kdf_migration: user=%s upgraded to v2", user.ID)
    }
}
```

### 7.6 — Feature Flag

**File:** `config.go`

```go
KdfV2Enabled: getEnvBool("KDF_V2_ENABLED", false),
```

Default to `false` for the first deploy. Enable after monitoring.

### 7.7 — Tests

**File:** `handle_user_create_test.go` or new `crypto_kdf_test.go`

- Round-trip V1: encrypt → decrypt with SHA-256.
- Round-trip V2: encrypt → decrypt with Argon2id.
- Migration: encrypt with V1, decrypt with V1, re-encrypt with V2, decrypt with V2.
- Wrong password: both versions return an error.
- Feature flag off: new users still get V1.

---

## Verification

| Check | Expected | How to verify |
|-------|----------|---------------|
| Migration runs | Column exists | `psql -c "SELECT kek_envelope_version FROM users LIMIT 1"` |
| New user V2 | kek_envelope_version = 2 | Register with flag on, check DB |
| Old user V1 | Still unlocks | Login with existing account |
| Migration on unlock | Version bumps to 2 | Unlock, check DB |
| Feature flag off | V1 for new users | Register with flag off, check DB |
| Tests pass | All go tests green | `go test ./...` |

---

## Risk

**Medium.** This is a cryptographic migration. Mitigations:
1. **Never delete the old envelope** until the new one is persisted and verified.
2. **Feature flag** allows instant rollback.
3. **Test with synthesized V1 envelopes** before touching real accounts.
4. **Log every migration** for audit trail.

---

## Evidence Log

| Date | What was done | Verified? | Commit |
|------|--------------|-----------|--------|
| | | | |

# Step 9 — Cryptographic Hardening: Argon2id KDF

**Parent:** [v3 Hackathon Index](./v3-hackathon-index.md)  
**Status:** ✅ DONE  
**Commit:** `4fd5d04`  
**Deployed:** 2026-05-22

---

## Why This Matters

The previous KDF was single-round SHA-256 — fast and vulnerable to brute-force. Argon2id is the OWASP-recommended KDF for password hashing. It's memory-hard, time-hard, and parallelism-resistant. This is the difference between "we encrypt" and "we encrypt correctly."

## What We Built

### 1. Argon2id KEK Envelope
The Key Encryption Key (KEK) — which protects the user's RSA private key at rest — is now derived using Argon2id instead of SHA-256. Parameters:
- **Memory:** 64 MB
- **Iterations:** 3
- **Parallelism:** 4
- **Output length:** 32 bytes

The `kek_envelope_version` field in localStorage tracks which KDF was used (`v1` = PBKDF2/SHA-256, `v2` = Argon2id). The frontend checks this on login and uses the correct derivation path.

### 2. Frontend Logic
The `crypto.ts` module reads `kek_envelope_version` from `localStorage` after login. If it's `v2` (or if `ENABLE_ARGON2ID=true` is set in `.env.test`), it uses `hash-wasm`'s Argon2id implementation. Otherwise, it falls back to PBKDF2 for backward compatibility.

**File:** `vaultdrive_client/src/utils/crypto.ts`

### 3. Backend Flag
The Go backend reads `ENABLE_ARGON2ID` from the environment. When `true`, new user registrations and PIN changes use Argon2id for KEK derivation. The flag is set in both `.env` (production) and `.env.test` (E2E tests).

**File:** `config.go`, `.env.test`

### 4. E2E Synchronization
The `.env.test` file ensures the E2E test harness uses the same Argon2id configuration as production. The previous mismatch (frontend defaulting to PBKDF2 while backend used Argon2id) caused onboarding failures in the E2E suite. This was the root cause of the 34/41 → 41/41 E2E fix.

## Verification

| Check | Result |
|-------|--------|
| `ENABLE_ARGON2ID=true` in `.env.test` | ✅ |
| `kek_envelope_version` set to `v2` after login | ✅ Verified in localStorage |
| New registrations use Argon2id | ✅ |
| Old accounts still login (PBKDF2 fallback) | ✅ |
| E2E suite green after fix | ✅ 41/41 |

## Evidence

- Commit: `4fd5d04` — `fix(e2e): stabilize suite, fix Argon2id kek logic, harden UI clicks`
- Fix: `e282219` — `.env.test` with `ENABLE_ARGON2ID=true`

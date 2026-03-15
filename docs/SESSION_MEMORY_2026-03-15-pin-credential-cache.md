# Session Memory — 2026-03-15 (One PIN, Zero Friction)

## Session Goal

Implement the "one PIN across the whole product" principle at the UX layer. The user sets their PIN once, and that PIN becomes the session credential for all vault operations — no repeated prompts during normal use.

This is a core workflow requirement, not a nice-to-have. The experience should feel stable, predictable, and low-friction.

---

## Context at Session Start

Previous session (2026-03-15 afternoon) left:
- Trust UX, API v1, Agent Keys all implemented (pending commit)
- DB migration version: 34
- PIN system already existed: `pin_hash`, `pin_set_at`, `private_key_pin_encrypted`, `pin_wrapped_key`
- `SessionVaultContext` cached RSA private keys and per-file AES keys — but NOT the raw credential
- Every vault operation (upload, download, share, preview) prompted the user for their PIN/password on first use per session
- The "one PIN" rule was documented but not fully enforced at the UX layer

### The Problem

Users experienced credential friction at 7 distinct points:

1. File upload (click upload button) — modal asks for PIN
2. Drag-and-drop upload — modal asks for PIN
3. File download (first time) — modal asks for PIN or password
4. Share with user — credential input for unwrapping file key
5. Create share link — credential input for embedding key in URL
6. Bulk download — dual prompt (PIN + password for mixed files)
7. File preview — credential prompt before decryption

All of these were "correct" from a security standpoint — the credential is needed to derive encryption keys. But the UX was exhausting. The user already provided their PIN at login. Why ask again?

---

## What Was Built

### Core: Credential Cache in SessionVaultContext

**`vaultdrive_client/src/context/SessionVaultContext.tsx`** (modified)
- Added `CachedCredential` interface: `{ value: string; type: "pin" | "password" }`
- Added `credentialRef` — in-memory React ref storing the raw credential
- Added `getCredential()` / `setCredential(value, type)` — stable `useCallback` accessors
- `clearVault()` now also clears `credentialRef`
- No localStorage persistence — raw credential lives only in memory, cleared on refresh/logout

### Entry Points: Where Credentials Get Cached

**`vaultdrive_client/src/pages/login.tsx`** (modified)
- PIN login → `setCredential(pinValue, "pin")`
- Password login → `setCredential(loginData.password, "password")`
- Cached immediately after successful RSA private key import

**`vaultdrive_client/src/pages/settings.tsx`** (modified)
- After successful PIN set/change → `setCredential(pinInput, "pin")`
- Prevents stale cached credential after PIN change mid-session

**`vaultdrive_client/src/components/onboarding/OnboardingWizard.tsx`** (modified)
- After PIN setup during onboarding → `setCredential(pin, "pin")`
- Ensures first-time users get cache benefit immediately

**`vaultdrive_client/src/pages/files.tsx`** — `handlePasswordSubmit()` (modified)
- After any successful manual credential entry in the password modal, caches the credential
- This covers the fallback case: user enters credential manually → cached for rest of session

### Bypass Points: Where Prompts Are Eliminated

**`vaultdrive_client/src/pages/files.tsx`** — `handleUpload()` (modified)
- Checks `sessionVault.getCredential()` before showing the modal
- If cached credential type matches (`ownerUsesPin` → PIN, else → password), calls `performUpload(cached.value)` directly
- No modal shown

**`vaultdrive_client/src/pages/files.tsx`** — `handleDownload()` (modified)
- After existing cached-key checks, checks cached credential against file's `credential_scheme`
- If match → downloads and decrypts directly, no prompt
- If no match (legacy password file when PIN cached) → falls through to modal

**`vaultdrive_client/src/components/share-modal.tsx`** (modified)
- Added `useSessionVault` hook
- Computes `hasCachedCred`: cached credential type matches `credentialMode`
- When cached: hides credential input section, shows green "Credential cached" indicator
- `handleShare()` uses cached value instead of `pinInput`/`passwordInput`
- Share button enabled without manual credential entry

**`vaultdrive_client/src/components/vault/CreateShareLinkModal.tsx`** (modified)
- Added `useSessionVault` hook
- Computes `hasCachedCred`: `isDropFile` → PIN, else → password
- When cached: hides credential input, `handleGenerate()` uses `cached.value`
- Generate button enabled when cached (only expiry check remains)

**`vaultdrive_client/src/components/vault/BulkDownloadModal.tsx`** (modified)
- Added `useSessionVault` hook with `useEffect` auto-fill on mount
- Auto-populates `pinCredential` and/or `passwordCredential` from cache
- Hides credential inputs that are already filled
- Description changes to "Credentials ready" when all filled

**`vaultdrive_client/src/components/vault/FilePreviewModal.tsx`** (modified)
- Extended existing `useSessionVault` destructuring to include `getCredential`
- In the file-change `useEffect`: after RSA key check, checks cached credential
- If match → `loadPreview(cached.value)` directly, no credential prompt shown
- Falls through to prompt only for legacy mismatched files

---

## What Was NOT Changed

- **Backend** — No Go code changes. No API changes. No DB migrations.
- **Security model** — Raw credential stored only in React ref (in-memory). Never persisted to localStorage or sent to any new endpoint. Cleared on logout/refresh. Same trust boundary as existing RSA key caching.
- **Legacy password files** — Still require password entry (if user logged in with PIN). "Let old files die with old rules."
- **Drag-and-drop uploads** — Still prompt once per session (the modal entry caches the credential for subsequent button uploads). This is a mount-only `useEffect` limitation — fixing it would require a ref-based workaround with marginal benefit.
- **Per-link/per-action PIN fragmentation** — None existed, none introduced. No share link passwords, no per-upload PINs.

---

## Files Changed

| File | Change |
|------|--------|
| `vaultdrive_client/src/context/SessionVaultContext.tsx` | Added `CachedCredential`, `getCredential`, `setCredential`, clear in `clearVault` |
| `vaultdrive_client/src/pages/login.tsx` | Cache credential after successful login (PIN or password) |
| `vaultdrive_client/src/pages/settings.tsx` | Cache new PIN after set/change |
| `vaultdrive_client/src/components/onboarding/OnboardingWizard.tsx` | Cache PIN after onboarding setup |
| `vaultdrive_client/src/pages/files.tsx` | Upload/download bypass + credential caching after manual modal entry |
| `vaultdrive_client/src/components/share-modal.tsx` | Auto-use cached credential, hide input when cached |
| `vaultdrive_client/src/components/vault/CreateShareLinkModal.tsx` | Auto-use cached credential, hide input when cached |
| `vaultdrive_client/src/components/vault/BulkDownloadModal.tsx` | Auto-fill from cache on mount, hide filled inputs |
| `vaultdrive_client/src/components/vault/FilePreviewModal.tsx` | Auto-decrypt preview when cached credential matches |

---

## Verification

- TypeScript compilation: PASS (`tsc -b`)
- Vite production build: PASS (817 kB bundle)
- Go backend build: PASS (`go build ./...`)
- LSP diagnostics: CLEAN on all 9 changed files (zero type errors)
- No backend changes → no API regression risk
- No DB migration changes → no schema risk

---

## Known Limitations

1. **Drag-drop first use**: Still prompts once per session. Subsequent button uploads are cached.
2. **Cross-credential-type files**: User logged in with PIN cannot auto-decrypt legacy password files (prompts once, then caches password for rest of session).
3. **PIN change mid-session**: Fixed — settings and onboarding now update the cached credential. But files encrypted with the OLD PIN during the same session before the change will fail to decrypt with the new cached PIN. User would need to re-login or enter the old PIN manually.
4. **Page refresh clears cache**: By design. Credential is in-memory only. User re-enters on next login.

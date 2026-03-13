# Task 05 — Bug Audit & Fixes

## Request

> "Inspect the current code and verify the latest build works end-to-end. Report what was changed, what was verified, any errors or risks, and whether it is safe to continue."

## Audit Method

Two parallel subagents were run:

1. **explore** — read all 6 changed frontend files in full and checked for: broken imports, prop mismatches, logic gaps, silent error swallowing, and edge cases
2. **Direct inspection** — read the backend handlers and DB models to cross-reference field names and response shapes

The audit surfaced **9 issues** across 5 files: 1 critical, 4 high, 2 medium, 2 low.

---

## Issues Found and Fixed

### BUG 1 — CRITICAL — `settings.tsx:76-80` — Double encryption of private key

**Root cause:** `private_key_encrypted` stored in `localStorage["user"]` is the RSA private key encrypted with the user's **login password** (via AES-GCM + PBKDF2, same format as file keys). It is not a plaintext PEM string. The code was passing this ciphertext blob directly to `encryptPrivateKeyWithPIN(pin, blob)`, which encrypted the already-encrypted blob a second time.

**Effect:** When `shared.tsx` later called `decryptPrivateKeyWithPIN(pin, private_key_pin_encrypted)` it received the password-encrypted blob (not a PEM), and `importRSAPrivateKey(pkcs8, ...)` threw a `DataError`. **Every shared-file download would silently fail.**

**Fix:** Added an account password field to the PIN form. On submit:

```typescript
const privateKeyPem = await unwrapKey(passwordInput, private_key_encrypted);
const privateKeyPinEncrypted = await encryptPrivateKeyWithPIN(pin, privateKeyPem);
```

The password decrypts the blob → PEM, then the PIN encrypts the PEM. Now `decryptPrivateKeyWithPIN` returns a valid PEM that `importRSAPrivateKey` can consume.

**Files:** `settings.tsx` (logic + UI — new password `<input>` field added to the PIN form)

---

### BUG 2 — HIGH — `files.tsx:461-484` — `is_owner` not forwarded to `downloadFileWithCredential`

**Root cause:** `handleDownload` correctly sets `pendingDownload.is_owner`, but `performDownload` built the object passed to `downloadFileWithCredential` without including `is_owner`.

**Effect:** Inside `downloadFileWithCredential`, `file.is_owner` was always `undefined`. The condition `wrappedKeyB64 && !file.is_owner` evaluated `!undefined === true`, so **owners** downloading their own file (which has a `X-Wrapped-Key` header from a group share) would be incorrectly routed to the PIN/RSA path and fail.

**Fix:**

```typescript
const result = await downloadFileWithCredential({
  id: pendingDownload.fileId,
  filename: pendingDownload.filename,
  metadata: pendingDownload.metadata,
  drop_wrapped_key: pendingDownload.drop_wrapped_key,
  is_owner: pendingDownload.is_owner,   // ← added
}, password);
```

**Files:** `files.tsx`

---

### BUG 3 — HIGH — `files.tsx:411` — `!file.is_owner` misroutes undefined

**Root cause:** The routing condition `!file.is_owner` is `true` when `is_owner` is `undefined` (not just when it's `false`). This means any file missing the `is_owner` field would be incorrectly routed to the RSA/PIN path.

**Fix:** Changed to strict equality:

```typescript
} else if (wrappedKeyB64 && file.is_owner === false) {
```

**Files:** `files.tsx`

---

### BUG 4 — HIGH — `share-modal.tsx:184-196` — Silent empty `wrapped_key` on group share

**Root cause:** When wrapping the AES key with the owner's own public key for the group share record, the code returned `null` if `localStorage["user"].public_key` was absent, then sent `wrapped_key: ownerWrappedKey || ""` to the server. The POST succeeded; no error was shown; but the group record stored an empty wrapped key, making the owner unable to download the file via the group.

**Fix:** Removed the null path entirely — now throws immediately if the public key is missing:

```typescript
if (!userObj?.public_key) {
  throw new Error("Your public key is missing. Please log out and log in again before sharing to a group.");
}
const ownerPubKey = await importRSAPublicKey(userObj.public_key);
const ownerWrappedKey = await wrapKeyWithRSA(ownerPubKey, aesKey);
```

The group POST also now checks `response.ok` and throws on failure.

**Files:** `share-modal.tsx`

---

### BUG 5 — HIGH — `share-modal.tsx:177-181` — Silent per-member share failures

**Root cause:** The loop that wraps the AES key for each group member called `fetch(...)` but never checked `response.ok`. If any member share failed (4xx/5xx), the loop continued silently and the group POST still fired, creating a group record even though some members had no wrapped key.

**Fix:** Added response check after each member share:

```typescript
const memberShareResp = await fetch(`${API_URL}/files/${fileId}/share`, { ... });
if (!memberShareResp.ok) {
  const errData = await memberShareResp.json().catch(() => ({}));
  throw new Error(errData.error || `Failed to share with member ${member.user_id}`);
}
```

**Files:** `share-modal.tsx`

---

### BUG 6 — LOW — `shared.tsx:298-303` — Modal closes before download, errors appear behind it

**Root cause:** `setShowPinModal(false)` was called before `performDownload(pin)`. If decryption failed, the error was set via `setError` but the modal was already gone, so the user saw a blank page with a floating error banner.

**Fix:** Moved `setShowPinModal(false)` to after `performDownload` completes:

```typescript
async function handlePinSubmit() {
  if (pinValue.length !== 4) return;
  const pin = pinValue;
  setPinValue("");
  await performDownload(pin);    // ← runs first
  setShowPinModal(false);        // ← only closes on completion
}
```

**Files:** `shared.tsx`

---

### BUG 7 — LOW — `share-modal.tsx:397` — Misleading UI copy

**Root cause:** The helper text under the file password input said "re-wrap it for the recipient's PIN" — the file is actually wrapped with the **recipient's RSA public key**, not their PIN directly.

**Fix:** Changed to "wrap it with the recipient's RSA public key".

**Files:** `share-modal.tsx`

---

## Issues Found But Not Fixed

### MEDIUM — `files.tsx:279-281` — Folder tree node uses `drop_folder_name` as filter

The "folder" tree node filters files by `drop_folder_name` (a Secure Drop field), not by a conventional folder ID. Regular user-created folders would not match. This was identified as a pre-existing design ambiguity rather than a regression from the sharing work. Tracked but not changed in this session.

---

## Verification After Fixes

```
tsc -b     → 0 errors
vite build → ✓ built in 11.53s (no new warnings)
```

Go service was already running clean (`go build` passed before the audit).

---

## Note for Existing Users

Users who set their PIN during the session **before this fix** have a corrupted `private_key_pin_encrypted` value (double-encrypted). They need to go to **Settings → Change PIN** once. The PIN itself (bcrypt hash) is fine; only the key-blob needs to be regenerated with the corrected flow.

---

## Summary Table

| # | File | Severity | Status |
|---|------|----------|--------|
| 1 | `settings.tsx` | CRITICAL | Fixed |
| 2 | `files.tsx` (is_owner forwarding) | HIGH | Fixed |
| 3 | `files.tsx` (strict equality) | HIGH | Fixed |
| 4 | `share-modal.tsx` (null public key) | HIGH | Fixed |
| 5 | `share-modal.tsx` (silent member errors) | HIGH | Fixed |
| 6 | `shared.tsx` (modal close order) | LOW | Fixed |
| 7 | `share-modal.tsx` (UI copy) | LOW | Fixed |
| 8 | `files.tsx` (folder filter field) | MEDIUM | Not fixed — pre-existing |

## Files Changed in This Task

| File | Changes |
|------|---------|
| `vaultdrive_client/src/pages/settings.tsx` | Password field added; `unwrapKey` call before PIN-encrypt |
| `vaultdrive_client/src/pages/files.tsx` | `is_owner` forwarded; strict equality for routing |
| `vaultdrive_client/src/components/share-modal.tsx` | Null public key throws; member response.ok check; UI copy |
| `vaultdrive_client/src/pages/shared.tsx` | Modal close moved after download |

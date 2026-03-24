# 22 — Drop Link Key Recovery

**Date:** March 24, 2026
**Status:** Complete and verified

## Problem

Shared drop links for client file uploads stopped working after migration 029 (March 14, 2026). Clients visiting a drop link saw one of two errors:

1. **"This upload link is no longer available"** — generic error page title
2. **"Encryption key not found in URL. Please use the full link provided to you."** — the actual cause

### Root Cause Chain

```
Migration 029: raw_encryption_key dropped from upload_tokens (correct security decision)
  -> encryption key now only exists in pin_wrapped_key (AES-wrapped with owner PIN)
  -> key is only returned to the client at creation time as URL fragment: #key={hex}
  -> handlerListDropTokens returns upload_url WITHOUT #key= fragment
  -> UploadLinkCard displays and copies keyless URL
  -> client visits keyless URL -> readKeyFromUrl() returns "" -> upload fails
```

The UI even promised "Copy the link now, or find it again later in Upload Links" — but "later" URLs had no key.

### Secondary Issue

Dead `isLegacyKey()` code path in `drop-upload.tsx` called the removed `/api/drop/{token}/encryption-key` endpoint (removed in migration 029), which would 404 for any legacy-format URLs.

## Solution

### 1. PIN-Protected Key Recovery Endpoint

**File:** `handle_drop.go` — new `handlerDropTokenRecoverKey`

```
POST /api/drop/{token}/recover-key
Authorization: Bearer {jwt}
Body: { "pin": "1234" }
Response: { "encryption_key": "hex..." }
```

Security layers:
- JWT authentication (owner only)
- Owner-match verification (token.OwnerUserID == caller)
- PIN hash verification against `users.pin_hash`
- PIN lockout (5 attempts, 15-min timeout) — same as all other PIN paths
- Audit trail: `secure_drop.key_recovered` event logged

Flow: `auth.UnwrapKey(pin, uploadToken.PinWrappedKey)` returns the raw hex key.

### 2. Route Registration

**File:** `main.go`

```go
mux.HandleFunc("POST /api/drop/{token}/recover-key", apiConfig.handlerDropTokenRecoverKey)
```

### 3. "Reveal Full Link" UI in UploadLinkCard

**File:** `vaultdrive_client/src/components/upload/UploadLinkCard.tsx`

- Amber warning when URL is missing `#key=` fragment
- "Reveal full link with PIN" button triggers inline PIN prompt
- On success: reconstructs full URL, auto-copies to clipboard, shows green confirmation
- Error states for wrong PIN, lockout, network failure
- Copy button shows checkmark feedback on success

### 4. Improved Client-Side Error UX

**File:** `vaultdrive_client/src/pages/drop-upload.tsx`

- New `missingKey` state detected on page load (not deferred to upload attempt)
- Distinct amber "Incomplete upload link" page when token is valid but key is missing
- Clear guidance: "Please ask the sender to re-send the full link (the part after # is required)"
- Removed dead `isLegacyKey()` function and its code path calling the deleted `/encryption-key` endpoint
- `readKeyFromUrl()` simplified: only reads from `#key=` fragment (no more `?key=` query param fallback)

## Files Changed

| File | Change |
|------|--------|
| `handle_drop.go` | +133 lines — `handlerDropTokenRecoverKey` with full PIN validation + audit |
| `main.go` | +1 line — route registration |
| `vaultdrive_client/src/components/upload/UploadLinkCard.tsx` | +145/-13 — reveal key UI, PIN prompt, copy feedback |
| `vaultdrive_client/src/pages/drop-upload.tsx` | +51/-33 — missing-key page, dead code removal |
| **Total** | 4 files, ~297 insertions, ~33 deletions |

## Verification

| Check | Result |
|-------|--------|
| `go build ./...` | CLEAN — 0 errors |
| `tsc --noEmit` | CLEAN — 0 TypeScript errors |
| `npx vitest run` | **27/27 pass** (10 test files, 6.07s) |
| `npm run build` | SUCCESS (8.98s) |

## Encryption Key Lifecycle (Updated)

```
CREATE:  PIN -> auth.WrapKey(pin, randomKey) -> pin_wrapped_key stored in DB
         Full URL returned: /abrn/drop/{token}#key={randomKey}

LIST:    Server returns /abrn/drop/{token} (no key — correct, key is secret)
         UI shows amber warning + "Reveal full link with PIN" button

RECOVER: Owner enters PIN -> POST /api/drop/{token}/recover-key
         Server: auth.UnwrapKey(pin, pin_wrapped_key) -> raw key returned
         Client: reconstructs full URL with #key= fragment

USE:     Client visits full URL -> readKeyFromUrl() extracts key from fragment
         File encrypted in browser with AES-256-GCM -> uploaded to server
```

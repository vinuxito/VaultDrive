# 23 — Drop Link Full Cycle E2E Test Suite

**Date:** March 24, 2026
**Status:** Complete and verified — 35/35 E2E tests passing

## Problem

After the drop link key recovery fix (doc 22), the critical question remained: does the **full lifecycle** actually work end-to-end?

```
Owner creates drop link → shares with client → client uploads file → owner downloads and decrypts
```

No existing test covered this complete flow. The existing `public-sender-flows` and `upload-link-lifecycle` specs covered upload, but **never tested the owner download + decryption of drop-uploaded files**.

The user explicitly asked: "Are you really really sure I can share a link to my client and he will be able to upload files and then I will be able to download those files? Cos I'm doing one now. If it fails, I'm gonna look really really bad. Do E2E test to be sure please."

## Solution

### New spec: `e2e/drop-full-cycle.spec.ts` (3 tests)

**Test 1 — Full lifecycle** (8.3s):
1. Owner registers, logs in, completes onboarding
2. Creates a drop link via API → verifies URL contains `#key=` fragment
3. Clears auth → visits drop link as anonymous client
4. Client uploads a file (encrypted in browser with AES-256-GCM)
5. Upload succeeds → sees "Your files have been delivered securely."
6. Owner logs back in → navigates to `/files` → verifies drop-uploaded file is visible
7. Clicks Download → PIN modal appears → enters PIN → clicks "Decrypt & Download"
8. Download API returns 200 with `X-Wrapped-Key` header
9. Browser decrypts file (unwrapKey → AES-GCM decrypt) → PIN modal closes → no error

**Test 2 — Key recovery + re-share** (7.3s):
1. Owner creates a drop link
2. Calls `POST /api/drop/{token}/recover-key` with PIN
3. Verifies raw encryption key is returned
4. Reconstructs full URL with recovered key
5. Anonymous client visits recovered URL → uploads file → succeeds

**Test 3 — Wrong PIN rejected** (5s):
1. Owner creates a drop link
2. Calls key recovery with wrong PIN (`9999` instead of `2468`)
3. Verifies response is 400+

### Updated spec: `e2e/public-sender-flows.spec.ts`

The "missing fragment key" test was updated to match the new UX from doc 22:
- **Before:** Expected "Secure File Delivery" page → tried upload → saw "Encryption key not found"
- **After:** Expected "Incomplete upload link" page (distinct amber error detected on page load)

## Key Technical Decisions

### Viewport width
The download button uses `hidden md:flex` (only visible at 768px+). The test uses `test.use({ viewport: { width: 1280, height: 720 } })` to ensure the desktop layout.

### Download verification strategy
Playwright's `download` event doesn't fire for blob URL downloads created via `document.createElement('a').click()`. Instead, the test verifies:
1. Download API returns 200 with `X-Wrapped-Key` header present
2. PIN modal closes after decryption (proves `unwrapKey` + `decryptFile` succeeded)
3. No error banner appears (`.bg-red-50 .text-red-800` selector for the actual error, not false positives from delete button styling)

### Error detection specificity
The initial broad selector `[class*='text-red']` matched the always-visible delete button styling (`text-red-500`, `text-red-600`). Fixed to target only the actual error banner: `.bg-red-50 .text-red-800`.

## Files Changed

| File | Change |
|------|--------|
| `vaultdrive_client/e2e/drop-full-cycle.spec.ts` | +300 lines — 3 new E2E tests |
| `vaultdrive_client/e2e/public-sender-flows.spec.ts` | Updated missing-key test for new UX |

## Verification

| Check | Result |
|-------|--------|
| `go build ./...` | CLEAN — 0 errors |
| `tsc --noEmit` | CLEAN — 0 TypeScript errors |
| `npx vitest run` | **27/27 pass** (10 test files) |
| `npm run build` | SUCCESS (9.66s) |
| `npx playwright test` | **35/35 pass** (2.0m) |

## E2E Test Coverage (35 tests across 10 spec files)

| Spec File | Tests | What It Covers |
|-----------|-------|----------------|
| `owner-trust-flow` | 3 | Signup, onboarding, PIN login, Settings tabs |
| `agent-key-lifecycle` | 8 | Create, introspect, scope denial, revoke, audit, live stream, Filemon, denial timeline |
| `public-sender-flows` | 3 | Drop delivery, missing-key error page, file request sender |
| `file-upload-flow` | 2 | Browser encryption, AES-256-GCM metadata |
| `upload-link-lifecycle` | 3 | UI creation, anonymous delivery, 24h expiry |
| `share-link-lifecycle` | 3 | Create, access count, revoke |
| `group-crud` | 3 | Create via UI, add/remove members, delete |
| `group-sharing` | 2 | Share to group + member access, remove from group |
| `trust-safety-ux` | 5 | PIN setup, security tab, empty states, API receipts, encryption footer |
| **`drop-full-cycle`** | **3** | **Full lifecycle, key recovery + re-share, wrong PIN rejection** |

# 17 — PIN Authentication Unification
**Date:** 2026-03-20
**Session:** Unified PIN-based auth across all ABRN Drive entry-points; 7 committed iterations

---

## Objective

Close every gap where a user who chose PIN-based encryption still saw a password prompt, a stale credential mode, or an incorrect E2E test assertion. No changes to the password-based registration or external authentication path.

---

## Gaps Found & Fixed

### 1. FilePreviewModal — credential never cached after manual entry (`b1388b0`)

**Gap:** `handleCredentialSubmit` in `FilePreviewModal.tsx` called `loadPreview(credential)` but never stored the credential in the session vault. Every subsequent file preview required another PIN prompt.

**Fix:**
- Changed `loadPreview` to return `Promise<boolean>` (true = decrypted OK)
- Aliased `setCredential: cacheCredential` from `useSessionVault` to avoid collision with the existing React state variable
- On success: `cacheCredential(credential, ct === "password" ? "password" : "pin")`

**File:** `src/components/vault/FilePreviewModal.tsx`

---

### 2. Login redirects new users past the onboarding gate (`3da8992`)

**Gap:** Every successful login navigated to `"/"` (public homepage). `DashboardLayout` gates PIN setup behind `/files`, so users who had never set a PIN never saw `OnboardingWizard`.

**Fix:** `navigate(data.pin_set ? "/" : "/files")`

**File:** `src/pages/login.tsx`

---

### 3. PIN mode hint survives session clearance (`dcd4bec`)

**Gap:** After `clearLocalAuth()` wiped localStorage the login page always defaulted to "password" mode; PIN users had to manually switch.

**Fix:**
- `OnboardingWizard.handleSetPin`: writes `localStorage.setItem("abrn_pin_hint", "1")` after successful PIN set
- `login.tsx`: writes `abrn_pin_hint = "1"` after successful PIN login
- `login.tsx`: initialises `loginMode` state from `abrn_pin_hint` so the PIN tab is pre-selected on next load

**Files:** `src/components/onboarding/OnboardingWizard.tsx`, `src/pages/login.tsx`

---

### 4. ShareModal treats PIN-encrypted files as password-encrypted (`7a91cbb`)

**Gap:** `credentialMode` was always `"password"` for non-drop files regardless of their `credential_scheme` in metadata. Cached PIN was never matched.

**Fix:** Inspects `JSON.parse(fileMetadata).credential_scheme`; returns `"pin"` when present.

**File:** `src/components/share-modal.tsx`

---

### 5. CreateShareLinkModal same credential-mode gap (`3a54bb8`)

**Gap:** Identical to gap #4 in the companion modal.

**Fix:** `fileCredentialMode` computed variable from `file.metadata`; UI labels, `inputMode`, `maxLength`, disabled logic, and `cacheCredential` call all keyed to `fileCredentialMode`.

**File:** `src/components/vault/CreateShareLinkModal.tsx`

---

### 6. E2E `owner-trust-flow` stale text assertion (`863c2b2`)

**Gap:** `"One-PIN doctrine"` was renamed to `"One PIN for everything"` during the enterprise polish pass. Test still checked old string.

**Fix:** Updated assertion string.

**File:** `e2e/owner-trust-flow.spec.ts`

---

### 7. E2E tests don't navigate 3-tab Settings; wrong 403 error shape (`6090e55`)

**Gap:** Enterprise polish added a 3-tab structure (Account / Security / Advanced) to Settings. Tests asserting agent-ops headings, Filemon operator, control-plane docs, and the PIN section all failed because their content is behind a tab.

Additionally, `agent-key-lifecycle` scope-denial test asserted `expect(errorBody.success).toBe(false)` but the backend 403 body is `{error: string}` with no `success` field.

**Fixes:**
- `owner-trust-flow`: click `Security` tab before PIN section assertions
- `owner-trust-flow`: click `Advanced` tab before control-plane docs assertions
- `agent-key-lifecycle` (3 tests): click `Advanced` tab before agent-ops/Filemon/timeline assertions
- `agent-key-lifecycle`: scope-denial assertion changed to `expect(errorBody.error).toBeTruthy()`

**Files:** `e2e/owner-trust-flow.spec.ts`, `e2e/agent-key-lifecycle.spec.ts`

---

### 8. E2E `public-sender-flows` stale success text (`this session — fix commit`)

**Gap:** `drop-upload.tsx` renders `"Your files have been delivered securely."` but the test asserted `"Files delivered securely"` — a case-sensitive substring mismatch (`Files` vs `files`).

**Fix:** Test updated to match actual heading: `"Your files have been delivered securely."`

**File:** `e2e/public-sender-flows.spec.ts`

---

## Verification

| Check | Result |
|-------|--------|
| `tsc -b --noEmit` | CLEAN |
| `npx vitest run` | 21/21 PASS |
| `npx vite build` | SUCCESS (11.56s) |
| `npx playwright test` | **14/14 PASS** |

---

## Files Changed

| File | Nature of change |
|------|-----------------|
| `src/components/vault/FilePreviewModal.tsx` | Cache credential on successful manual entry |
| `src/pages/login.tsx` | Redirect new users to `/files`; init PIN mode from hint; write hint on PIN login |
| `src/components/onboarding/OnboardingWizard.tsx` | Write `abrn_pin_hint` on PIN setup |
| `src/components/share-modal.tsx` | Detect `credential_scheme=pin` in metadata |
| `src/components/vault/CreateShareLinkModal.tsx` | Detect `credential_scheme=pin`; full UI keyed to mode |
| `e2e/owner-trust-flow.spec.ts` | Tab navigation + stale text fix |
| `e2e/agent-key-lifecycle.spec.ts` | Tab navigation + 403 error shape fix |
| `e2e/public-sender-flows.spec.ts` | Stale success-page text fix |

---

## Risk Assessment

**No regressions.** All changes are:
- Additive (new cache writes, new hint key)
- Narrowly targeted (credential-mode detection only added the metadata inspection; password path unchanged)
- Test-only for E2E fixes

The one intentional non-fix: password-based registration and external authentication paths were explicitly not touched per project requirements.

# 12 — One-PIN Trust Flow

Implemented: 2026-03-15  
Verified locally end-to-end: 2026-03-15 late evening

---

## Overview

This work finishes the product rule that had already become the design law for ABRN Drive:

- the user sets one PIN
- that PIN becomes the stable app-level trust key
- normal owner workflows stop asking for repeated per-action PIN input
- the experience stays calm and predictable instead of fragmenting into separate share/upload/action credentials

The implementation preserves the existing zero-knowledge boundary. The raw credential is still kept only in memory inside the browser session. No new server-side decrypt authority was added.

---

## What Changed

### 1. PIN setup now means fully usable PIN trust

`OnboardingWizard.tsx` now asks for the account password during PIN enrollment and uses it to create `private_key_pin_encrypted` immediately.

`settings.tsx` now reuses the same helper path so onboarding and settings do not drift.

Result:
- new users no longer land in the broken state where `pin_set = true` but RSA-based PIN flows still fail
- shared-file decryption can rely on the PIN-backed private-key path immediately after onboarding

### 2. Authenticated shell now enforces PIN setup

`dashboard-layout.tsx` no longer treats PIN setup as a dismissible banner-only suggestion.

Instead:
- users without a PIN are held inside the onboarding flow
- onboarding stays active until it explicitly completes
- normal vault work is blocked until the trust setup is finished

This closes the gap between the product rule and the actual shell behavior.

### 3. Secure Drop creation reuses session trust

`CreateUploadLinkModal.tsx` now checks the session credential cache before asking for manual PIN input.

If a valid session PIN already exists:
- the modal uses it automatically
- the repeated PIN field is removed from the normal happy path
- backend PIN verification remains in place

This makes Secure Drop creation behave like a normal owner workflow instead of a separate security ceremony.

### 4. Shared-file downloads reuse session trust

`shared.tsx` now follows the same trust order used elsewhere:

1. cached RSA private key
2. restore RSA private key from cached session PIN + `private_key_pin_encrypted`
3. manual PIN prompt only if the first two paths are unavailable

Successful manual PIN entry now writes back into the session cache so later shared downloads in the same session stay friction-free.

### 5. Trust helpers and tests were added

Supporting helpers:
- `vaultdrive_client/src/utils/pin-trust.ts`
- `vaultdrive_client/src/utils/pin-enrollment.ts`
- `vaultdrive_client/src/utils/shared-session.ts`

Regression tests:
- `vaultdrive_client/src/utils/pin-trust.test.ts`
- `vaultdrive_client/src/utils/pin-enrollment.test.ts`
- `vaultdrive_client/src/utils/shared-session.test.ts`
- `vaultdrive_client/src/components/layout/dashboard-layout.test.tsx`
- `vaultdrive_client/src/components/upload/CreateUploadLinkModal.test.tsx`
- `vaultdrive_client/src/pages/shared.test.tsx`

Vitest infrastructure was added so the trust-flow logic is no longer validated only by manual testing.

---

## End-to-End Verification

Local browser verification was run against the real app on `http://localhost:8082/abrn/` after rebuilding the frontend.

Verified flow:
1. Create a fresh user account
2. Log in with password
3. Navigate to `/files`
4. Confirm onboarding is required for a user without a PIN
5. Complete PIN setup with account password
6. Create a first folder inside onboarding
7. Confirm onboarding dismisses only after the flow completes
8. Open the Drop Links manager
9. Open the upload-link modal
10. Confirm the modal reuses the cached PIN and does not ask for it again

This is the strongest direct proof that the one-PIN rule now holds in the intended owner flow.

---

## Files Changed

| File | Change |
|------|--------|
| `vaultdrive_client/src/components/onboarding/OnboardingWizard.tsx` | Full PIN enrollment during onboarding, including password-based private-key rewrap |
| `vaultdrive_client/src/pages/settings.tsx` | Reused shared enrollment helper and corrected PIN form behavior |
| `vaultdrive_client/src/components/layout/dashboard-layout.tsx` | Strong PIN enforcement and onboarding lifecycle ownership |
| `vaultdrive_client/src/components/upload/CreateUploadLinkModal.tsx` | Cached-PIN reuse for Secure Drop creation |
| `vaultdrive_client/src/pages/shared.tsx` | Shared-download trust reuse and safer fallback handling |
| `vaultdrive_client/src/utils/pin-trust.ts` | Session trust helpers |
| `vaultdrive_client/src/utils/pin-enrollment.ts` | Shared PIN enrollment helper |
| `vaultdrive_client/src/utils/shared-session.ts` | Shared-download RSA restoration helper |
| `vaultdrive_client/src/vitest.setup.ts` | Test cleanup setup |
| `vaultdrive_client/src/components/layout/dashboard-layout.test.tsx` | Shell enforcement and onboarding completion regression coverage |
| `vaultdrive_client/src/components/upload/CreateUploadLinkModal.test.tsx` | Cached-PIN modal regression coverage |
| `vaultdrive_client/src/pages/shared.test.tsx` | Shared-download session-trust regression coverage |

---

## Security and Product Guarantees Preserved

- The raw PIN/password remains in browser memory only
- Backend PIN verification and lockout are unchanged
- File requests still use uploader-chosen passphrases and remain intentionally separate from the owner PIN
- Secure Drop still uses the owner PIN as the persistent trust key without creating a separate per-link secret

---

## Risks / Follow-Up

1. **Shared-file full browser verification is still lighter than the owner-flow browser verification**
   - Unit and component tests cover the shared trust-recovery logic.
   - A full two-user browser script would still be useful later for cross-account share/download proof.

2. **Frontend bundle size remains large**
   - Production build passes, but Vite still warns about chunk size (`~825 kB` main bundle).
   - This is not a correctness blocker, but it is a performance follow-up item.

3. **Baseline-browser-mapping warning remains informational**
   - Lint passes on the changed files.
   - The warning suggests updating a dev dependency, but it does not block the app build or the trust-flow behavior.

---

## Outcome

ABRN Drive now behaves much closer to the intended trust model:

- set the PIN once
- keep the flow trusted through the session
- do not turn normal protected work into credential hell

This session moves the product from "the rule is written down" to "the rule actually holds in the live owner workflow."

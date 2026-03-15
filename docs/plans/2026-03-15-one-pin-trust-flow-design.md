# ABRN Drive One-PIN Trust Flow Design

## Goal

Make ABRN Drive consistently behave like a single app-level PIN product:
- the user must set a PIN
- that PIN is the stable trust key across normal owner workflows
- the app stops asking for repeated per-action PIN entry in routine protected flows
- file requests keep their separate uploader passphrase model
- zero-knowledge guarantees stay intact

## Current State

The repo already moved most owner vault flows to an in-memory credential cache:
- `vaultdrive_client/src/context/SessionVaultContext.tsx`
- `vaultdrive_client/src/pages/login.tsx`
- `vaultdrive_client/src/pages/files.tsx`
- `vaultdrive_client/src/components/share-modal.tsx`
- `vaultdrive_client/src/components/vault/CreateShareLinkModal.tsx`
- `vaultdrive_client/src/components/vault/BulkDownloadModal.tsx`
- `vaultdrive_client/src/components/vault/FilePreviewModal.tsx`

The remaining gaps are concentrated in three places:
- `vaultdrive_client/src/components/upload/CreateUploadLinkModal.tsx` still requires manual PIN entry for each Secure Drop link
- `vaultdrive_client/src/pages/shared.tsx` still uses its own PIN modal path and does not fully participate in the shared session cache flow
- `vaultdrive_client/src/components/onboarding/OnboardingWizard.tsx` sets `pin_hash` but does not enroll `private_key_pin_encrypted`, which leaves new users partially configured for RSA-based PIN workflows

There is also a product-enforcement gap:
- `vaultdrive_client/src/components/layout/dashboard-layout.tsx` nudges users to set a PIN, but does not strongly block normal app use until the PIN is set

## Requirements

### Product Requirements

- One user-level PIN across the product
- No per-share PIN fragmentation
- No routine repeated password prompts for normal trusted flows
- Calm, predictable, low-friction UX

### Security Requirements

- Do not persist the raw credential outside the existing in-memory session vault
- Do not weaken the current zero-knowledge model
- Keep file-request uploader passphrases separate from the owner PIN
- Preserve PIN verification and lockout on the backend where it remains security-relevant

## Approaches Considered

### Approach 1: Frontend trust-flow completion only

Finish the migration by wiring all remaining owner workflows into the existing `SessionVaultContext` cache.

Changes:
- hide manual PIN fields when a valid cached PIN already exists
- reuse cached PIN and cached RSA private key in `shared.tsx`
- backfill session cache after successful shared-file decrypts
- add stronger PIN setup enforcement in the authenticated shell
- fix onboarding so PIN setup also creates `private_key_pin_encrypted`

Pros:
- smallest architectural change
- consistent with the current implementation direction
- no new backend primitives required
- preserves zero-knowledge boundaries

Cons:
- still relies on the current session-lifetime trust model, so reload/logout clears the calm path until login seeds it again

Recommendation:
- Best option. It closes the UX seams without inventing a new security model.

### Approach 2: Backend session authorization token for PIN-verified actions

After PIN verification, mint a temporary server-side session capability so later protected actions do not need to submit the PIN again.

Pros:
- central server-side notion of trusted session
- fewer frontend checks

Cons:
- adds a new auth layer that the product does not currently need
- increases coupling between crypto authorization and API authorization
- risks weakening the current ciphertext-first and browser-held trust boundary

Recommendation:
- Reject. Too much complexity for a problem already mostly solved in the client.

### Approach 3: Per-feature exception model

Keep existing repeated PIN prompts in adjacent workflows like shared files and Secure Drop creation, and document them as justified exceptions.

Pros:
- minimal code change

Cons:
- directly violates the product rule
- creates the fragmented, exhausting UX the user explicitly rejected
- leaves the repo with two competing trust models

Recommendation:
- Reject. This is exactly the pattern the product is trying to remove.

## Chosen Design

Use Approach 1: complete the existing session trust model and make PIN setup a real prerequisite for the intended app flow.

### Design Summary

1. Treat `SessionVaultContext` as the single client-side authority for in-session trusted use.
2. Ensure every normal owner flow either:
   - uses the cached PIN/private key immediately, or
   - writes back into the cache after one successful PIN-based action.
3. Keep backend PIN checks for operations that intentionally prove fresh possession of the PIN, but remove unnecessary frontend repeated-entry prompts when the session already has that trust established.
4. Upgrade onboarding so "PIN set" means fully usable across RSA-backed flows, not just hash present in the database.
5. Turn PIN setup from a soft nudge into a stronger gate for the authenticated app experience.

## Component Design

### 1. Secure Drop creation uses the cached PIN

File:
- `vaultdrive_client/src/components/upload/CreateUploadLinkModal.tsx`

Changes:
- import `useSessionVault()`
- read the cached credential when the modal opens
- if a cached `pin` credential exists, use it automatically for drop creation
- hide or replace the manual PIN field with a calm confirmation state
- keep backend verification in `handle_drop.go` unchanged for now

Why:
- creating a drop link is a normal owner workflow, not a separate high-security ceremony
- this is the clearest current violation of the one-PIN rule

### 2. Shared-with-me downloads join the same trust flow

File:
- `vaultdrive_client/src/pages/shared.tsx`

Changes:
- use `getCredential`, `setCredential`, and `setPrivateKey` from `SessionVaultContext`
- if the session already has a cached private key, use it as today
- if the session has a cached PIN and `private_key_pin_encrypted`, reconstruct the RSA private key without prompting again
- after a successful manual PIN decrypt, write both the PIN credential and the imported RSA private key back into the session cache

Why:
- the shared-files page currently behaves like an older parallel implementation
- this is a trust-flow consistency bug, not just a cosmetic UX issue

### 3. Onboarding must fully enroll the PIN-backed RSA path

File:
- `vaultdrive_client/src/components/onboarding/OnboardingWizard.tsx`

Changes:
- extend onboarding so setting a PIN also creates `private_key_pin_encrypted`
- reuse the same client-side cryptographic conversion logic already present in `vaultdrive_client/src/pages/settings.tsx`
- require the account password during PIN enrollment, because this is needed to decrypt `private_key_encrypted` and re-encrypt it under the new PIN

Why:
- this fixes the mismatch between `pin_set: true` and real PIN-readiness for shared-file decrypt paths
- it prevents new users from entering a broken middle state

### 4. Stronger PIN enforcement in the authenticated shell

Files:
- `vaultdrive_client/src/components/layout/dashboard-layout.tsx`
- possibly `vaultdrive_client/src/components/protected-route.tsx`

Changes:
- replace the current dismissible warning-only behavior with a stronger guided gate
- allow access to the PIN setup flow, but block normal vault workflows until the PIN is set
- present this as a product requirement, not a warning banner

Why:
- the intended workflow depends on the PIN being present
- a soft banner is not enough if the product rule is "must set a PIN"

## Flows After This Change

### Login with PIN

1. User logs in with PIN
2. `login.tsx` decrypts `private_key_pin_encrypted`
3. `SessionVaultContext` stores the RSA private key and the PIN credential in memory
4. Owner flows proceed without further credential friction during the session

### Login with password when PIN already exists

1. User logs in with password
2. Session still caches the password for legacy password-backed files
3. If the user later performs a PIN-backed action and enters the PIN once, that success backfills the session PIN/private-key path for the rest of the session

### Create Secure Drop link

1. Modal checks `SessionVaultContext`
2. Cached PIN exists -> submit directly with that PIN
3. No repeated PIN field for routine use
4. Backend still verifies the PIN and applies lockout rules if needed

### Download a shared file

1. Page checks for cached private key
2. If absent, checks for cached PIN + `private_key_pin_encrypted`
3. If enough material exists, reconstructs the RSA private key and proceeds without prompting
4. If not, prompt once, then cache the successful result

### First-time onboarding

1. User creates account and signs in
2. Onboarding requires PIN setup before normal vault use
3. Onboarding also asks for account password to derive `private_key_pin_encrypted`
4. Result: the user is fully ready for PIN login, vault use, and receiving shared files

## Error Handling

- If `private_key_pin_encrypted` is missing, show a precise remediation message instead of a generic decrypt failure
- If cached credential type does not match the needed flow, fall back cleanly without poisoning the cache
- If PIN verification fails during Secure Drop creation, preserve backend lockout behavior and surface the server response clearly
- If onboarding cannot complete RSA PIN enrollment, do not mark the user as fully finished with the required trust setup

## What Stays Separate On Purpose

### File requests

Files:
- `vaultdrive_client/src/pages/FileRequestPage.tsx`
- related request handlers

Do not merge file-request uploader passphrases with the owner PIN.

Reason:
- the uploader chooses a passphrase for content they are encrypting client-side
- the owner PIN is the owner's app-level trust key
- mixing them would either expose the owner's PIN or collapse the current zero-knowledge separation

## Affected Files

Primary:
- `vaultdrive_client/src/components/upload/CreateUploadLinkModal.tsx`
- `vaultdrive_client/src/pages/shared.tsx`
- `vaultdrive_client/src/components/onboarding/OnboardingWizard.tsx`
- `vaultdrive_client/src/components/layout/dashboard-layout.tsx`

Related:
- `vaultdrive_client/src/pages/settings.tsx`
- `vaultdrive_client/src/pages/login.tsx`
- `vaultdrive_client/src/context/SessionVaultContext.tsx`
- `handle_drop.go`
- `handle_user_pin.go`

## Verification Goals

- User without PIN cannot proceed into normal vault workflows until setup is complete
- User with PIN logs in once and can create Secure Drop links without re-entering the PIN
- User can download shared files in a session without repeated PIN prompts once the trust path is established
- Newly onboarded user can receive and decrypt shared files without needing a later settings repair step
- File requests still use uploader passphrases and continue to work unchanged

## Recommended Sequence

1. Strongen onboarding and PIN enforcement first so the trust model is coherent for new and current users
2. Remove repeated PIN friction in Secure Drop creation
3. Remove repeated PIN friction in shared-file downloads
4. Run focused regression tests on login, onboarding, shared files, and Secure Drop creation

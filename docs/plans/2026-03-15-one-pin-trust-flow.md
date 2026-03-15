# One-PIN Trust Flow Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make ABRN Drive consistently enforce and use one user-level PIN across normal owner workflows without repeated credential friction.

**Architecture:** Finish the existing in-memory session trust model instead of introducing a new backend auth layer. Wire the remaining owner flows into `SessionVaultContext`, make onboarding produce a fully usable PIN-backed RSA state, and tighten authenticated-app PIN enforcement while keeping file-request passphrases separate.

**Tech Stack:** React, TypeScript, React Router, Web Crypto API, Go HTTP handlers, PostgreSQL-backed user PIN state.

---

### Task 1: Lock the product rule and acceptance criteria in docs

**Files:**
- Create: `docs/plans/2026-03-15-one-pin-trust-flow-design.md`
- Create: `docs/plans/2026-03-15-one-pin-trust-flow.md`

**Step 1: Review the source context**

Read:
- `README.md`
- `docs/SESSION_MEMORY_2026-03-15-pin-credential-cache.md`
- `vaultdrive_client/src/context/SessionVaultContext.tsx`
- `vaultdrive_client/src/components/upload/CreateUploadLinkModal.tsx`
- `vaultdrive_client/src/pages/shared.tsx`
- `vaultdrive_client/src/components/onboarding/OnboardingWizard.tsx`

**Step 2: Confirm the four acceptance rules**

Acceptance rules:
- PIN setup is required for the intended app flow
- Secure Drop creation does not ask for repeated PIN entry when the session already has trust
- Shared-file download does not ask again once the session already has the needed PIN/private key trust material
- File requests keep uploader passphrases separate from the owner PIN

**Step 3: Save the design and plan docs**

Expected result:
- Both docs exist under `docs/plans/`
- Both docs reference the exact files that will be changed

---

### Task 2: Make onboarding fully enroll the PIN-backed RSA state

**Files:**
- Modify: `vaultdrive_client/src/components/onboarding/OnboardingWizard.tsx`
- Reuse patterns from: `vaultdrive_client/src/pages/settings.tsx`
- Reuse crypto from: `vaultdrive_client/src/utils/crypto.ts`

**Step 1: Write the failing scenario mentally and as a manual verification case**

Manual failure to reproduce before coding:
1. Register a new account
2. Complete onboarding PIN setup only
3. Receive a shared file
4. Open `Shared With Me`
5. Expected today: failure because `private_key_pin_encrypted` is missing

**Step 2: Add the missing onboarding inputs and state**

Implement:
- add an account-password field to the PIN setup step or an immediately adjacent sub-step
- keep the existing PIN and confirm-PIN validation

**Step 3: Reuse the settings conversion flow**

Implement the same sequence already used in `settings.tsx`:
- decrypt `private_key_encrypted` with account password
- encrypt the private key with the chosen PIN
- send both `pin` and `private_key_pin_encrypted` to `POST /users/pin`

**Step 4: Only mark onboarding PIN setup complete after full success**

Expected result:
- local user state reflects `pin_set: true`
- session vault caches the PIN credential
- future PIN-backed RSA flows can work immediately

**Step 5: Verify manually**

Verify:
- new user can complete onboarding
- no partial "PIN set but unusable for shared files" state remains

---

### Task 3: Enforce PIN setup for the authenticated app flow

**Files:**
- Modify: `vaultdrive_client/src/components/layout/dashboard-layout.tsx`
- Consider: `vaultdrive_client/src/components/protected-route.tsx`

**Step 1: Identify the current soft gate**

Current behavior:
- a dismissible banner and onboarding modal appear when `pin_set === false`
- the user can still keep using the app shell

**Step 2: Convert the nudge into a product gate**

Implement:
- if authenticated user has `pin_set === false`, keep them inside a guided PIN-setup state
- block normal vault navigation and actions until the setup is complete
- allow only the path needed to finish setup cleanly

**Step 3: Keep the UX calm**

UI requirements:
- no alarmist tone
- explain that the PIN is required because it secures login, uploads, shares, and Secure Drop
- do not frame it as an optional enhancement

**Step 4: Verify manually**

Verify:
- authenticated user without PIN cannot proceed into routine vault work
- after PIN setup, the app opens normally without stale blocking UI

---

### Task 4: Remove repeated PIN entry from Secure Drop creation

**Files:**
- Modify: `vaultdrive_client/src/components/upload/CreateUploadLinkModal.tsx`
- Reference pattern: `vaultdrive_client/src/components/vault/CreateShareLinkModal.tsx`

**Step 1: Add session-vault integration**

Implement:
- import `useSessionVault`
- read the cached credential on modal open
- detect `cached.type === "pin"`

**Step 2: Replace the repeated PIN field behavior**

Implement:
- if cached PIN exists, use it automatically
- show a calm informational state instead of a required manual field
- if no cached PIN exists, fall back to manual PIN entry

**Step 3: Preserve backend verification**

Do not change:
- `handle_drop.go` PIN verification
- backend lockout behavior

**Step 4: Verify manually**

Verify:
- login with PIN -> open create upload link modal -> create link without typing PIN again
- session without cached PIN -> modal still allows safe fallback entry
- server-side bad-PIN errors still surface clearly

---

### Task 5: Remove repeated PIN entry from shared-file download flow

**Files:**
- Modify: `vaultdrive_client/src/pages/shared.tsx`
- Reference patterns: `vaultdrive_client/src/pages/files.tsx`, `vaultdrive_client/src/context/SessionVaultContext.tsx`

**Step 1: Read from the session trust cache first**

Implement:
- add `getCredential`, `setCredential`, `setPrivateKey`, and `getPrivateKey` usage
- if private key is already cached, keep the existing fast path
- if private key is missing but cached PIN plus `private_key_pin_encrypted` exists, reconstruct the RSA private key and continue without prompting

**Step 2: Write successful manual entry back into the session**

Implement:
- after successful manual PIN decrypt, call `setCredential(pin, "pin")`
- call `setPrivateKey(rsaPrivateKey)`

**Step 3: Improve remediation messaging**

Implement:
- if `private_key_pin_encrypted` is missing, show a precise guidance message instead of a generic decrypt failure

**Step 4: Verify manually**

Verify:
- shared-file download in a trusted session does not prompt again
- first manual PIN entry unlocks later shared-file downloads in the same session
- missing `private_key_pin_encrypted` produces clear guidance

---

### Task 6: Run focused verification

**Files:**
- Validate modified files with diagnostics
- Run app checks from the frontend workspace

**Step 1: Run language diagnostics**

Run diagnostics on:
- `vaultdrive_client/src/components/onboarding/OnboardingWizard.tsx`
- `vaultdrive_client/src/components/layout/dashboard-layout.tsx`
- `vaultdrive_client/src/components/upload/CreateUploadLinkModal.tsx`
- `vaultdrive_client/src/pages/shared.tsx`

Expected:
- zero TypeScript/LSP errors

**Step 2: Run targeted frontend verification**

Run from `vaultdrive_client/`:
- the project lint command
- the project typecheck command, if present
- the project build command

Expected:
- all pass

**Step 3: Run manual product checks**

Manual checks:
- password login + no PIN -> forced setup path
- PIN login -> trusted owner flow across Files, Shared, and Secure Drop creation
- onboarding for a brand-new user -> later shared-file decrypt works
- file request page still asks uploader for their own passphrase and still uploads successfully

---

### Task 7: Document rollout notes and edge cases

**Files:**
- Update as needed: `docs/SESSION_MEMORY_2026-03-15-pin-credential-cache.md` or a new session memory file

**Step 1: Record the behavioral change**

Document:
- Secure Drop creation now honors session trust
- Shared-file download now honors session trust
- onboarding now completes RSA PIN enrollment
- PIN setup is now enforced more strongly in the authenticated shell

**Step 2: Record known edge cases**

Document:
- older users who already have `pin_set = true` but no `private_key_pin_encrypted` may need a one-time remediation flow if not auto-migrated
- file requests remain intentionally separate from the owner PIN

---

Plan complete and saved to `docs/plans/2026-03-15-one-pin-trust-flow.md`.

Execution options:
1. Subagent-driven in this session
2. Parallel session using `executing-plans`

# Build Verification — 2026-04-16

## Summary

This pass started as a “before we continue, verify the latest build end to end” request.

The branch already had a large frontend semantic-color migration in progress, plus other unrelated dirty files in the repo. The real job here was not just “run build again.” It was:

1. separate the intended frontend work from unrelated local dirt,
2. verify the current branch honestly,
3. fix the branch-level blockers that made verification unreliable,
4. document the exact current state so the next session can continue safely.

## What Changed

### 1. Login now clears stale in-memory vault state on successful login

**File:** `vaultdrive_client/src/pages/login.tsx`

The login flow now calls `clearVault()` after a successful `/login` response and before storing the new session.

Why this matters:

- stale private keys,
- stale cached file keys,
- stale cached credentials,

should not survive across a newly established authenticated session.

This was a real implementation gap surfaced by `src/pages/login.test.tsx`.

### 2. Folder-share modal now recovers from a bad cached PIN

**File:** `vaultdrive_client/src/components/vault/CreateFolderShareLinkModal.tsx`

The modal no longer traps the user in a loop when an auto-used cached PIN fails.

Current behavior:

- if the cached PIN fails during the private-key decrypt path,
- the modal drops back to the credential step,
- shows a clear recovery message,
- disables cached-PIN reuse for the retry,
- and renders the manual 4-digit PIN input.

This restores the safer UX expected by `CreateFolderShareLinkModal.test.tsx`.

### 3. Upload storage is now configurable

**Files:**

- `upload_storage.go`
- `handle_files.go`
- `handle_drop.go`
- `handle_file_requests.go`
- `handle_v1_core.go`

The backend no longer hardcodes `uploads/` as the only write target. It now uses:

- `UPLOAD_DIR` if set,
- otherwise falls back to `uploads`.

Why this matters:

Local verification was failing because this workspace’s repo-local `uploads/` directory was owned by `daemon` and not writable by the current user. The app itself was fine. The runtime assumption was not.

### 4. Playwright harness now self-bootstraps correctly

**File:** `vaultdrive_client/playwright.config.ts`

The committed E2E harness now does all the boring but necessary local setup itself:

- injects `DB_URL`, `JWT_SECRET`, `BASE_PATH`, `PORT`, and `UPLOAD_DIR` into the managed Go server,
- uses a dedicated default database, `vaultdrive_playwright`,
- creates a dedicated default upload directory, `/tmp/quantix-playwright-uploads`,
- creates the test database if needed,
- runs goose migrations before starting the server,
- then launches the app for Playwright.

This fixes the earlier situation where `npm run test:e2e` depended on hidden local shell setup and a partially migrated shared dev database.

## What Was Verified

### Backend

- `go test ./...` ✅
- `go build ./...` ✅

### Frontend

- `npm run build` ✅
- `npm test` ✅ `72/72 passed`

### Focused regressions

- `src/pages/login.test.tsx` ✅
- `src/components/vault/CreateFolderShareLinkModal.test.tsx` ✅

### End-to-end

- `npm run test:e2e` ✅ `38 passed`

Important detail: the final green E2E run used the updated committed harness, not a one-off hand-edited shell command.

## What Failed Before the Fixes

The branch exposed three real verification blockers before this pass:

1. **Playwright webServer startup failed** because the Go app was launched without `DB_URL` and `JWT_SECRET`.
2. **Upload-related E2E flows failed** because the process tried to write into a repo-local `uploads/` directory that was not writable in this workspace.
3. **Governance-related E2E flows failed** because the shared local `vaultdrive` database was behind migration `044_governance_settings.sql`.

There were also two failing unit tests that turned out to be legitimate implementation drift, not flaky tests.

## Risks / Notes

### Safe now

- The branch is now verifiably runnable end to end.
- The committed Playwright harness is much more honest and reproducible for local contributors.
- The login and cached-PIN flows are safer than before.

### Remaining caution

- The repo still has unrelated dirty files outside this fix set. Those should not be swept into the same commit by accident.
- `vaultdrive_client/src/components/settings/AgentApiKeysSection.tsx` was identified earlier as a likely separate lane because it mixes larger behavior/accessibility changes with UI churn.
- The Go toolchain downloads a newer Go version when running `go run github.com/pressly/goose/v3/cmd/goose@latest ...` during E2E startup. It works, but it is worth remembering if someone wants a faster prebuilt local workflow later.

## Safe to Continue?

Yes.

This branch is now in a state where it is reasonable to continue feature work, docs work, or cleanup work without guessing whether the current build is fundamentally broken.

That was the whole point of this pass.

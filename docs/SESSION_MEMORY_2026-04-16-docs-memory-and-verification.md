# Session Memory — 2026-04-16: Docs, Memory, and Verification Pass

## What Happened

We stopped feature momentum on purpose and did the adult thing: verified the branch before continuing.

The branch already had a large frontend semantic-color migration in progress. The first build result looked good, but that was not enough. We ran fresh backend, frontend, unit, and end-to-end verification and found that the branch had three different kinds of blockers:

1. a real session-safety behavior gap in login,
2. a real recovery-flow behavior gap in the folder-share modal,
3. an unreliable Playwright local harness that depended on hidden env/setup assumptions.

All three are now fixed.

## Critical Facts for Future Sessions

### Login safety boundary

`vaultdrive_client/src/pages/login.tsx` now clears the in-memory session vault **after a successful login response** and **before** storing the new session.

Do not move this earlier in the flow. Clearing before auth success would wipe a valid current session on a bad password attempt.

### Cached PIN fallback behavior

`vaultdrive_client/src/components/vault/CreateFolderShareLinkModal.tsx` now has a real fallback path when an auto-used cached PIN fails.

Important rule:

- only credential-decrypt failure from the cached PIN should trigger the manual fallback,
- generic backend/network errors should not be mislabeled as “bad cached PIN.”

### Upload storage is configurable now

The backend now uses `UPLOAD_DIR` when present. Default is still `uploads`.

This was added because the repo-local `uploads/` directory in this workspace was owned by `daemon` and blocked local E2E runs.

If uploads suddenly fail again in another environment, check:

1. whether `UPLOAD_DIR` is set,
2. whether the path exists,
3. whether the process can write there.

### Playwright local harness defaults

`vaultdrive_client/playwright.config.ts` now defaults to:

- `DB_URL=postgres://postgres:postgres@localhost:5432/vaultdrive_playwright?sslmode=disable`
- `E2E_ADMIN_DB_URL=postgres://postgres:postgres@localhost:5432/postgres?sslmode=disable`
- `E2E_DB_NAME=vaultdrive_playwright`
- `UPLOAD_DIR=/tmp/quantix-playwright-uploads`

It also:

- creates the Playwright database if missing,
- runs goose migrations before server startup,
- then launches the Go app.

This means `npm run test:e2e` is now a real local verification command, not a “works if your machine is already magically set up” command.

## Verification Snapshot

- `go test ./...` ✅
- `go build ./...` ✅
- `npm run build` ✅
- `npm test` ✅ `72/72`
- `npm run test:e2e` ✅ `38 passed`

## Errors We Saw Before Fixing

- `DB_URL environment variable is required` when Playwright tried to start the Go server without backend env
- `permission denied` while writing files into repo-local `uploads/`
- `pq: column "audit_retention_days" does not exist` because the shared local `vaultdrive` DB was behind migration 044
- failing `login.test.tsx` because stale vault state was not cleared on new login
- failing `CreateFolderShareLinkModal.test.tsx` because cached-PIN failure did not fall back to manual entry

## Risks

- There are still unrelated dirty files in the repo outside this exact fix/doc pass.
- Commit carefully. Do not sweep in unrelated backend changes, docs artifacts, or large settings-surface work by accident.
- `AgentApiKeysSection.tsx` looked like a separate lane during investigation and should stay a separate judgment call unless intentionally reviewed.

## Safe Continuation Recommendation

Yes, safe to continue.

The branch is no longer in the ambiguous state where build looked okay but runtime truth was unclear. We have a green backend, green frontend, green unit tests, and green end-to-end harness with reproducible local setup.

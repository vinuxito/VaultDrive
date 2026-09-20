# ABRN Drive frontend (shared QuantiX codebase)

This directory contains the React + TypeScript frontend for QuantiX Drive.

It is not a standalone product shell. The production app is served by the Go
backend under the configured base path (default `/quantix/`), and this
frontend builds into `vaultdrive_client/dist/` for that backend to serve.

## Branding Configuration

All branding (name, colors, logo, base path, API URL) is driven by `VITE_*` env
vars. See:

- `.env` — committed QuantiX defaults (active when no override is present)
- `.env.example` — documented QuantiX defaults you can copy to `.env.local`
- `src/config/branding.ts` — single source of truth for the `branding` object
  consumed by React components

Branded downstream deployments override these values in their own `.env.local`
or build-time environment and may replace `src/components/branding/brand-logo.tsx`
in an overlay to render an alternate logo.

## Stack

- React 19
- TypeScript 5
- Vite 7
- Tailwind CSS 4
- Radix UI primitives
- Vitest + Testing Library

## What Lives Here

- Auth and onboarding UI
- Vault explorer and file-detail trust surfaces
- Public share page
- Secure Drop public upload page
- File Request public upload page
- Settings, Privacy & Trust, and Agent API Keys UI

## Important Product Truths

- Owner trust model: one app-wide 4-digit PIN
- Owner session trust is reused across normal secure flows
- Supported file-content flows use browser Web Crypto and public share links carry the AES key in the URL fragment
- Filenames, sizes and access metadata remain visible to the service
- Secure Drop delivery recovery and account recovery are documented server-coordinated exceptions to browser-only key handling
- Secure Drop and File Request sender experiences must explain what the app can and cannot see in plain language
- Agent UI must stay ciphertext-first and scope-driven

## Commands

Install dependencies:

```bash
npm install
```

Run unit tests:

```bash
npm run test
```

Run trust proof e2e:

```bash
npm run test:e2e
```

This does more than just run Playwright. The current harness:

- builds the frontend,
- creates or reuses a dedicated local test database (`vaultdrive_playwright` by default),
- runs goose migrations against that database,
- starts the Go app with explicit local dev env,
- writes encrypted test uploads into `/tmp/quantix-playwright-uploads` by default,
- then runs the committed Playwright specs.

Use the final coherence verification report for current result counts.

Run the frontend build:

```bash
npm run build
```

Run the local Vite dev server:

```bash
npm run dev
```

Preview the production bundle locally:

```bash
npm run preview
```

## Verification Notes

- The main production-like local path is usually the Go server under `/quantix/`, not the raw Vite dev server.
- Frontend verification is normally paired with backend verification:
  - `cd vaultdrive_client && npm test && npm run build`
  - `cd .. && go test ./... && go build ./...`
- The committed Playwright harness defaults to `http://127.0.0.1:8090/quantix/` and starts its own Go server during `npm run test:e2e`.
- It now injects the minimum required backend env (`DB_URL`, `JWT_SECRET`, `BASE_PATH`, `PORT`, `UPLOAD_DIR`) instead of assuming your shell is preconfigured.
- It defaults to a dedicated database, `vaultdrive_playwright`, so the suite does not collide with a half-migrated local dev database.
- It defaults to a dedicated upload directory, `/tmp/quantix-playwright-uploads`, so the suite does not depend on repo-local file permissions.
- If you need to target a different local database or upload directory, override `E2E_DB_NAME`, `E2E_DB_URL`, `E2E_ADMIN_DB_URL`, or `E2E_UPLOAD_DIR`.
- Remote/proxied testing must use the dedicated external runner with both targets explicitly set:
  `E2E_BASE_URL='https://reviewed-host/abrn/' E2E_API_BASE_URL='https://reviewed-host/api' npm run test:e2e:external -- <reviewed-spec-list>`.

Historical snapshot from 2026-09-20 (v12 Browser Verification & Closeout Checkpoint):

- `npm run build` ✅ (`dist/index.html` SHA-256: `b7d936260f80847870464ab25462a02fb2acd97375a571415d8f9593ff0cdc27`)
- `npm run typecheck` ✅ (0 errors)
- `npm test` ✅ (104/104 test files, 502/502 passed)
- `npm run test:e2e` (Playwright) ✅ (`v11-sovereign-vault-ux.spec.ts` 1/1 passed in 10.3s on port 8094)
- `playwright-cli` (interactive browser audit) ✅ (clean rendering, login navigation, EN/ES toggle, 0 console errors)
- Live public parity verified at `https://abrndrive.filemonprime.net/abrn/` (matching SHA-256 seal)
- [Browser Closeout Report](../docs/reports/2026-09-20-v12-browser-verification-and-closeout.md) | [Browser Closeout Dashboard](../docs/reports/2026-09-20-v12-browser-verification-and-closeout.html) | [Browser Closeout Memory](../docs/memories/session-2026-09-20-v12-browser-verification-and-closeout.md)

Historical snapshot from 2026-09-17 (v12 Sovereign File Manager Recovery, Verification & Closeout Checkpoint):

- `npm run build` ✅ (`dist/index.html` SHA-256: `b7d936260f80847870464ab25462a02fb2acd97375a571415d8f9593ff0cdc27`)
- `npm run typecheck` ✅ (0 errors)
- `npm test` ✅ (104/104 test files, 502/502 passed)
- `npm run test:e2e` (Playwright) ✅ (`v11-sovereign-vault-ux.spec.ts` 1/1 passed in 11.2s on port 8094)
- Live public parity verified at `https://abrndrive.filemonprime.net/abrn/` (matching SHA-256 seal)
- [Closeout Report](../docs/reports/2026-09-17-v12-recovery-verification-and-closeout.md) | [Closeout Dashboard](../docs/reports/2026-09-17-v12-recovery-verification-and-closeout.html) | [Closeout Memory](../docs/memories/session-2026-09-17-v12-recovery-verification-and-closeout.md)

Historical snapshot from 2026-09-17 (v12 Sovereign File Manager Evolution Checkpoint):

- `npm run build` ✅ (`dist/index.html` SHA-256: `b7d936260f80847870464ab25462a02fb2acd97375a571415d8f9593ff0cdc27`)
- `npm run typecheck` ✅ (0 errors)
- `npm test` ✅ (104/104 test files, 502/502 passed)
- `npm run test:e2e` (Playwright) ✅ (`v11-sovereign-vault-ux.spec.ts` 1/1 passed in 10.4s)
- Live public parity verified at `https://abrndrive.filemonprime.net/abrn/` (matching SHA-256 seal)
- [Verification Report](../docs/reports/2026-09-17-v12-file-manager-evolution-verification.md) | [Dashboard](../docs/reports/2026-09-17-v12-file-manager-evolution-verification.html) | [Session Memory](../docs/memories/session-2026-09-17-v12-sovereign-file-manager-evolution.md)

Historical snapshot from 2026-09-17 (Recovery & E2E Verification Checkpoint):

- `npm run build` ✅ (`dist/index.html` SHA-256: `859275e8e74058e11a5b2afab79f6645633155ad67d0947e4208867167f583bf`)
- `npm run typecheck` ✅ (0 errors)
- `npm test` ✅ (101/101 test files, 490/490 passed)
- `npm run test:e2e` (Playwright) ✅ (`v11-sovereign-vault-ux.spec.ts` 1/1 passed)
- Live public parity verified at `https://abrndrive.filemonprime.net/abrn/` (matching SHA-256 seal)
- [Verification Report](../docs/reports/2026-09-17-recovery-verification-and-closeout.md) | [Dashboard](../docs/reports/2026-09-17-recovery-verification-and-closeout.html) | [Memory](../docs/memories/session-2026-09-17-recovery-verification-and-closeout.md)

Historical snapshot from 2026-06-24 (not current release acceptance):

- `npm run build` ✅
- `npm test` ✅ (133/133)
- `npm run test:e2e` ✅ (48/48)

The current release decision belongs in [`../docs/reports/2026-09-16-ui-ux-coherence-verification.md`](../docs/reports/2026-09-16-ui-ux-coherence-verification.md). Five-person unassisted journeys, native zoom/assistive technology, physical devices, passkeys, browser/OS save behavior, reboot survival and restore evidence remain separate manual gates until that report records them.


## Key Files

- `src/App.tsx` - route map and basename handling
- `src/pages/files.tsx` - main vault explorer
- `src/components/vault/TrustRail.tsx` - per-file protection and access rail
- `src/components/vault/FileSecurityTimeline.tsx` - security timeline
- `src/components/vault/AccessPanel.tsx` - access visibility and revoke controls
- `src/components/settings/AgentApiKeysSection.tsx` - delegated-power UI
- `src/components/onboarding/OnboardingWizard.tsx` - trust briefing + PIN setup
- `src/pages/drop-upload.tsx` - public Secure Drop sender flow
- `src/pages/FileRequestPage.tsx` - public File Request sender flow
- `playwright.config.ts` - Playwright trust proof harness
- `e2e/` - committed trust proof end-to-end specs

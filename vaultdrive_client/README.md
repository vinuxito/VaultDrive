# ABRN Drive / QuantiX Drive Frontend

This directory contains the shared React + TypeScript frontend used by both
ABRN Drive and QuantiX Drive.

It is not a standalone product shell. The production app is served by the Go
backend, usually under `/quantix/` (or `/abrn/` for the ABRN deployment), and
this frontend builds into `vaultdrive_client/dist/` for that backend to serve.

## Branding Configuration

All branding (name, colors, logo, base path, API URL) is driven by `VITE_*` env
vars. See:

- `.env` — committed QuantiX defaults (active when no override is present)
- `.env.example` — documented QuantiX defaults you can copy to `.env.local`
- `.env.abrn` — ABRN Drive downstream overrides; activate with
  `cp .env.abrn .env.local && npm run build`
- `src/config/branding.ts` — single source of truth for the `branding` object
  consumed by React components

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
- Public share links carry the AES key in the URL fragment
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

- The main production-like local path is usually the Go server at
  `http://localhost:8082/quantix/` (or `/abrn/` under the ABRN override), not
  the raw Vite dev server.
- Frontend verification is normally paired with backend verification:
  - `cd vaultdrive_client && npm run test && npm run build`
  - `cd .. && go test ./... && go build ./...`
- The committed Playwright harness defaults to `http://127.0.0.1:8090/<base>/`
  and starts its own Go server against the current repo code during
  `npm run test:e2e`.
- If you need to target a proxied or remote environment, override
  `E2E_BASE_URL` and `E2E_API_BASE_URL` explicitly.
- Current verified state for ABRN Drive on this branch:
  - `npx vitest run` → **88/88 passing**
  - `npm run build` → **clean**
  - `npx playwright test e2e/upload-link-lifecycle.spec.ts` → **4/4 passing**
  - `go test ./...` + `go build ./...` from repo root → **clean**
- The focused browser proof now explicitly covers the empty-folder owner path:
  - owner opens an empty folder
  - the UI steers them into **Create Upload Link** instead of dead-ending in **Share Folder**
  - upload-link creation succeeds with the same folder preselected

## Key Files

- `src/App.tsx` - route map and basename handling
- `src/pages/files.tsx` - main vault explorer
- `src/components/vault/TrustRail.tsx` - per-file protection and access rail
- `src/components/vault/FileSecurityTimeline.tsx` - security timeline
- `src/components/vault/AccessPanel.tsx` - access visibility and revoke controls
- `src/components/settings/AgentApiKeysSection.tsx` - delegated-power UI
- `src/components/onboarding/OnboardingWizard.tsx` - trust briefing + PIN setup
- `src/components/folders/FolderActionEntryPanel.tsx` - explicit inbound vs outbound folder action chooser
- `src/components/links/ProtectedLinkCopyField.tsx` - shared PIN-gated protected copy surface
- `src/utils/protected-link-copy.ts` - copy validation and masked-link helpers
- `src/pages/drop-upload.tsx` - public Secure Drop sender flow
- `src/pages/FileRequestPage.tsx` - public File Request sender flow
 - `playwright.config.ts` - self-hosted Playwright trust proof harness
 - `e2e/` - committed end-to-end owner and sender flow proofs
- `playwright.config.ts` - Playwright trust proof harness
- `e2e/` - committed trust proof end-to-end specs

## Documentation

- Root product docs: `../README.md`
- Docs index: `../docs/INDEX.md`
- Trust UX hardening: `../docs/13_TRUST_UX_HARDENING.md`
- Trust proof harness checkpoint: `../docs/15_TRUST_PROOF_HARNESS.md`
- Latest verification doc: `../docs/26_LINK_FLOW_UX_REDESIGN_VERIFICATION.md`
- Latest session context: `../docs/SESSION_MEMORY_2026-04-16-empty-folder-share-upload-handoff.md`
- HTML verification report: `../docs/empty-folder-share-upload-handoff-report.html`

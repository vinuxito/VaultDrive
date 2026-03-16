# ABRN Drive Frontend

This directory contains the React + TypeScript frontend for ABRN Drive.

It is not a standalone product shell. The production app is served by the Go backend, usually under `/abrn/`, and this frontend builds into `vaultdrive_client/dist/` for that backend to serve.

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

- The main production-like local path is usually the Go server at `http://localhost:8082/abrn/`, not the raw Vite dev server.
- Frontend verification is normally paired with backend verification:
  - `cd vaultdrive_client && npm run test && npm run build`
  - `cd .. && go test ./... && go build ./...`
- Current browser smoke coverage has been exercised against the live local app flow:
  - fresh signup
  - password login
  - onboarding / PIN setup
  - vault open
  - settings trust surfaces render

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

## Documentation

- Root product docs: `../README.md`
- Docs index: `../docs/INDEX.md`
- Trust UX hardening: `../docs/13_TRUST_UX_HARDENING.md`
- Latest session context: `../docs/SESSION_MEMORY_2026-03-16-build-verification-readme-refresh.md`

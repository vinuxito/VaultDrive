# QuantiX Drive Frontend

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
  `http://localhost:8082/quantix/`, not the raw Vite dev server.
- Frontend verification is normally paired with backend verification:
  - `cd vaultdrive_client && npm run test && npm run build`
  - `cd .. && go test ./... && go build ./...`
- The committed Playwright harness defaults to `http://127.0.0.1:8090/quantix/`
  and starts its own Go server against the current repo code during
  `npm run test:e2e`.
- If you need to target a proxied or remote environment, override
  `E2E_BASE_URL` and `E2E_API_BASE_URL` explicitly.

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

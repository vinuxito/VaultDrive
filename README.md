# ABRN Drive

ABRN Drive is the ABRN-branded deployment of the QuantiX Drive codebase: a browser-encrypted file vault with controlled sharing, Secure Drop intake, recovery, audit history and scoped automation.

The trust boundary is specific. Supported browser flows encrypt file contents before upload and the service stores ciphertext, while filenames, sizes and access metadata remain visible to the service. Secure Drop includes server-managed delivery-key recovery, and account recovery uses server-coordinated custodian state. Those exceptions are documented behavior; this repository does not claim universal zero knowledge.

## Current release status (2026-09-16)

The UI/UX coherence implementation is prepared and verified in the environments recorded by the project, but it is **not declared production-ready or deployed by this documentation update**. The coordinated release couples the reviewed backend, ABRN frontend and schema migration 50. Schema 49→50 must use the private staged release bundle; do not build in the shared application tree, run ad hoc migrations, or restart the service separately.

- [Coordinated ABRN release procedure](docs/runbooks/abrn-coherence-release.md)
- [Canonical release installer](deploy/release/README.md)
- [Trust-copy contract](docs/trust-copy-contract.md)
- [Final coherence verification report](docs/reports/2026-09-16-ui-ux-coherence-verification.md) — release owner supplies final counts, build identity and verdict
- [Seven-step coherence roadmap](docs/roadmaps/2026-09-14-ui-ux-coherence-upgrade-roadmap/index.md)

The following human gates remain outstanding unless the final report records otherwise: five-person unassisted journeys; native 200% zoom/reflow and assistive-technology review; physical phone/tablet coverage; real passkey behavior; actual browser/OS save-and-open behavior; reboot survival; and a coherent database/binary/frontend restore drill.

## Historical verification snapshots

These figures describe earlier dated checkpoints. They are retained for traceability and are not current release acceptance:

- **2026-09-17 v11 Sovereign Vault UI/UX 7-Iteration Hardening checkpoint:** 101 test files passed (490/490 tests, 0 failed, 100% pass rate); strict TypeScript compiler clean (0 errors); production bundle published (`e9fa42fc65283cc995424610c5e0631c94862d22ee9878689ed3dce5d1a3a593`); Golden SHA-256 seal, cipher specs, live route HUD, batch transfer slips, and i18n verified live. [Report](docs/reports/2026-09-16-v11-sovereign-vault-ux-verification.md) | [Executive Dashboard](docs/reports/2026-09-16-v11-sovereign-vault-ux-verification.html) | [Session Memory](docs/SESSION_MEMORY_2026-09-17-v11-sovereign-vault-ux-hardening.md) | [Roadmap Index](docs/plans/v11-sovereign-vault-ux-index.md).
- **2026-09-14 frontend lint checkpoint:** 265 unit tests passed, 1 skipped; 30 staged browser tests and 6 published smoke tests. [Report](docs/reports/2026-09-14-frontend-lint-verification.md).
- **2026-09-14 six-template contrast checkpoint:** 246 unit tests passed, 1 skipped; 30 public browser tests; 426 recorded visual states. [Report](docs/reports/2026-09-14-theme-contrast-verification.md).
- **2026-09-14 download/PIN checkpoint:** 162 frontend tests passed, 1 skipped; four local and four then-public browser regressions passed. [Report](docs/reports/2026-09-14-download-pin-verification.md).
- **2026-09-14 service recovery checkpoint:** the then-installed service was active/enabled and readiness saw 439 stored files. Reboot and authenticated journeys were not exercised. [Report](docs/reports/2026-09-14-service-recovery-verification.md).
- Older reports and counts elsewhere in this README are historical source records; use the 2026-09-16 final report for the release decision.

## Build and deployment boundary

Local development commands below are for isolated development environments. ABRN production release uses `deploy/release/` from a clean isolated checkout and a private user-owned stage. It preserves `/etc/abrndrive/runtime.env` and existing systemd configuration, backs up the database/binary/frontend together, runs bundled Goose v3.28.0, stops only `abrndrive.service`, and fails closed after the schema-50 boundary. No ordinary repository command implies authorization to deploy or restart a service.

## What It Does

- **Store** — AES-256-GCM encrypted file vault. PIN-based access, session key cache, inline preview, vault-wide search via pg_trgm.
- **Share** — Time-limited public links with the AES key in the URL fragment (never reaches the server). Expiry, access tracking, instant revoke.
- **Collect** — Public drop portals with required-document checklists, reusable collection templates, and intake analytics. File Requests for per-recipient secure intake.
- **Collaborate** — Share files and folders with users and groups via browser-side RSA key wrapping. Group management with member-level access control.
- **Access Center** — Unified owner surface for all outbound access: file share links, folder share links, and drop routes, filtered by status.
- **Skin** — Six built-in interface skins (QuantiX, Light, Dark, Cyberpunk, Elegant, Business) selectable per user. Default is the dark neon QuantiX aesthetic. All UI elements (buttons, borders, panels, dropdowns, shadows) are fully theme-aware via CSS custom properties — no hardcoded hex anywhere. Preference persisted in `localStorage`.
- **Delegate** — Per-user Agent API Keys with granular scopes (`files:list`, `files:read_metadata`, `activity:read`, etc.), last-used tracking, and full revocability for AI agents and external systems.
- **Audit** — Filterable audit log with CSV/JSON export; governance settings for retention, stale-link auto-expiry, and failed-access alerting.
- **Control** — Stable `/api/v1/` surface, short-lived JWTs with refresh flow, per-route rate limiting, and one-time SSE tickets.
- **Trust UX** — Recorded access routes, mutation outcomes and supported audit events are surfaced without turning missing history into a safety claim. See the trust-copy contract for legacy and recovery limits.
- **Help** — In-app Help Center (`/help`) with User Guide and Admin Guide. Fully localized (EN/ES). Admin sections hidden from non-admin users.
- **Mobile** — Responsive layout with bottom navigation, safe-area insets for notched devices, and WCAG-compliant 44px touch targets.
- **Accessible** — Skip-to-content link, visible focus rings, ARIA landmarks, semantic HTML, and `prefers-reduced-motion` support.
- **Sovereign Vault UX (v11)** — Luxury spatial desktop interaction: universal pointer cursors across all interactive elements, smooth auto-scroll reset to top on folder navigation, return-scroll modal anchoring, Vim-style traversal (`J`/`K`/`Enter`/`Space`/`Backspace`/`X`), "The Lens" optical focus aperture animation, instant PIN tumbler auto-submit with procedural Web Audio micro-haptics, slide-out Cryptographic Passport drawer with Golden SHA-256 seal copy and live route HUD, full-window illuminated drag aura, Executive Staging Dock with verifiable cryptographic transfer slips, and frosted obsidian Privacy Shutter with 3-minute inactivity auto-lock.

---

## Architecture

```
┌─────────────────────┐   HTTPS    ┌────────────────────────────┐
│  React SPA (Vite)   │──────────▶│  Go HTTP server (net/http)   │
│  Browser encryption │            │  JWT auth, rate limiting     │
└─────────────────────┘            │  Stable /api/v1/ surface     │
                                   └──────────┬───────────────────┘
                                              │
                                              ▼
                                    ┌─────────────────────┐
                                    │  PostgreSQL + goose │
                                    │  Ciphertext blobs   │
                                    └─────────────────────┘
```

- **Backend** — Go 1.24 HTTP server in a single binary. JWT auth, per-user RSA key envelopes, pg_trgm search, per-route rate limiting, SSE ticketing. `DB_URL` and `JWT_SECRET` validated at startup with explicit fatal errors.
- **Frontend** — React + TypeScript + Vite SPA. Supported file-content flows use browser Web Crypto. The service stores ciphertext but can see operational metadata; Secure Drop delivery recovery and account recovery have documented server-coordinated exceptions. Styled with Tailwind CSS v4 + shadcn/ui, fully themed via CSS custom properties (`[data-theme]` on `<html>`).
- **Database** — PostgreSQL 16, schema managed by pinned [goose](https://github.com/pressly/goose) migrations in `sql/schema/`. The coherence release requires the coordinated schema 49→50 procedure.
- **Deployment** — The native ABRN service runs the installed Go binary and serves `vaultdrive_client/dist` from its configured working directory. Release artifacts are installed together through the private staged procedure.

---

## Quickstart (Local Dev)

The fastest path is Docker Compose. It boots Postgres, runs migrations, creates the uploads directory, and starts the server under `/quantix/`.

```bash
# 1. Clone
git clone https://github.com/vinuxito/QuantiX-Drive.git
cd QuantiX-Drive

# 2. Boot the stack
docker compose up --build

# 3. Open the app
open http://localhost:8090/quantix/
```

The compose stack uses local-dev secrets. For a real deployment, override these via environment variables or a `.env` file (see **Configuration** below).

### Without Docker

If you want to run the binary directly:

```bash
# Prerequisites: Go 1.24+, Node 22+, PostgreSQL 16, goose

# 1. Start Postgres (or: docker compose up postgres -d)

# 2. Apply migrations
goose -dir sql/schema postgres \
  "postgres://postgres:postgres@localhost:5432/vaultdrive?sslmode=disable" up

# 3. Build the frontend
cd vaultdrive_client
npm install
npm run build
cd ..

# 4. Create the uploads directory (required — the server will not create it automatically
#    if the process user lacks write access to the working directory)
mkdir -p uploads

# 5. Run the backend
DB_URL="postgres://postgres:postgres@localhost:5432/vaultdrive?sslmode=disable" \
JWT_SECRET="local-dev-secret-minimum-32-characters-long" \
PRODUCT_NAME="QuantiX Drive" \
PRODUCT_SLUG=quantix-drive \
BASE_PATH=/quantix/ \
AGENT_KEY_PREFIX=qxak_ \
PORT=8090 \
go run .
```

> **Note on `uploads/`:** The server stores encrypted file blobs under `uploads/` relative to its working directory. In production, the process user (e.g. `daemon`) may not have write access to the working directory — pre-create the directory and set ownership before starting the service.
> ```bash
> sudo mkdir -p /srv/quantix-drive/uploads
> sudo chown <service-user>:<service-user> /srv/quantix-drive/uploads
> ```

---

## Configuration

All runtime configuration is env-driven — there is no baked-in product identity. The variables below are the full public surface.

### Required

| Variable | Purpose |
|----------|---------|
| `DB_URL` | Postgres connection string (with `sslmode` param) |
| `JWT_SECRET` | HS256 signing secret (minimum 32 characters) |
| `PORT` | HTTP listen port (defaults to `8090`) |

### Runtime storage

| Variable | Default | Purpose |
|----------|---------|---------|
| `UPLOAD_DIR` | `uploads` | Directory where encrypted upload blobs are written. Useful for dev, CI, and Playwright runs where the repo-local `uploads/` directory is not the right writable target. |

### Product branding

| Variable | Default | Purpose |
|----------|---------|---------|
| `PRODUCT_NAME` | `QuantiX Drive` | Display name used in email, audit, and UI copy |
| `PRODUCT_SLUG` | `quantix-drive` | URL-safe identifier used in manifest and internal keys |
| `BASE_PATH` | `/quantix/` | URL prefix the SPA is served under (must match frontend build) |
| `AGENT_KEY_PREFIX` | `qxak_` | Prefix for newly minted agent API keys (no underscores inside the prefix — the separator before the random part is `_`) |
| `AGENT_KEY_LEGACY_PREFIXES` | *(empty)* | Comma-separated list of legacy prefixes kept valid for verification |
| `PUBLIC_BASE_URL` | *(derived)* | Absolute URL advertised in outbound email and OAuth redirects |
| `CORS_ALLOWED_ORIGINS` | *(empty)* | Comma-separated list of CORS origins |
| `ADMIN_BOOTSTRAP_EMAILS` | *(empty)* | Comma-separated emails auto-promoted to admin on startup |

See `config.go` for the complete list (SMTP, rate-limit tunables, feature flags).

### Frontend branding

At build time, the Vite plugin in `vaultdrive_client/vite.config.ts` reads `VITE_*` variables and regenerates `public/manifest.json` automatically:

| Variable | Default | Purpose |
|----------|---------|---------|
| `VITE_BRAND_NAME` | `QuantiX Drive` | Window title and manifest name |
| `VITE_BRAND_SHORT_NAME` | `QuantiX Drive` | Mobile short name |
| `VITE_BRAND_THEME_COLOR` | `#4f46e5` | PWA theme color |
| `VITE_BRAND_BACKGROUND_COLOR` | `#0f172a` | PWA background color |
| `VITE_BRAND_ICON_PATH` | `vault.svg` | Path to the manifest icon (relative to `BASE_PATH`) |
| `VITE_BRAND_ICON_TYPE` | `image/svg+xml` | MIME type for the manifest icon |
| `VITE_API_BASE_URL` | `{BASE_PATH}api` | API prefix the SPA talks to |

All branding lives in `vaultdrive_client/src/config/branding.ts`. Downstream overlays can swap the logo component at `vaultdrive_client/src/components/branding/brand-logo.tsx` or replace `public/vault.svg` entirely.

---

## Deployment (GHCR + Docker)

Every push to `main` publishes an OCI image to GHCR via `.github/workflows/ci.yml`:

```
ghcr.io/vinuxito/quantix-drive:latest
ghcr.io/vinuxito/quantix-drive:sha-<short>
```

To run in production, pull the image and feed it a populated environment:

```bash
docker run -d \
  --name quantix-drive \
  -p 8090:8090 \
  -v /srv/quantix-drive/uploads:/app/uploads \
  -e DB_URL="postgres://..." \
  -e JWT_SECRET="$(openssl rand -base64 32)" \
  -e PRODUCT_NAME="QuantiX Drive" \
  -e BASE_PATH=/quantix/ \
  -e AGENT_KEY_PREFIX=qxak_ \
  -e PUBLIC_BASE_URL="https://quantixdrive.example.com" \
  -e CORS_ALLOWED_ORIGINS="https://quantixdrive.example.com" \
  -e ADMIN_BOOTSTRAP_EMAILS="admin@example.com" \
  ghcr.io/vinuxito/quantix-drive:latest
```

> Mount a host volume for `uploads/` so encrypted blobs survive container restarts.

Run `goose -dir sql/schema postgres "$DB_URL" up` once against your Postgres instance before first boot. Front the container with a TLS-terminating reverse proxy (Caddy, nginx, Cloudflare Tunnel) on `BASE_PATH`.

---

## Testing & CI

### Backend

```bash
# Run from an isolated development checkout, never the live shared tree.
go test -race ./...
go vet ./...
go build ./...
```

### Frontend unit tests

```bash
cd vaultdrive_client
npm test          # vitest
npx tsc --noEmit  # type-check src/ (tsconfig.app.json)
```

### End-to-End (Playwright)

The local E2E harness self-boots a Go server, migrates an isolated Playwright database, and writes encrypted test uploads into a dedicated temporary directory. The earlier **41/41 result dated 2026-05-22 is historical**; current release acceptance comes from the linked 2026-09-16 report.

```bash
# Self-bootstrapped local harness (recommended)
cd vaultdrive_client

# Default local run. Bootstraps its own database + Go server.
npm run test:e2e

# Run a single spec
npx playwright test agent-key-lifecycle

# Run with UI (headed)
npx playwright test --headed

# Override an isolated local database/upload directory
E2E_DB_NAME=vaultdrive_playwright_alt \
E2E_UPLOAD_DIR=/tmp/quantix-e2e-alt-uploads \
npx playwright test
```

External execution requires the dedicated runner and both explicit environment targets; it never silently reuses the local harness:

```bash
E2E_BASE_URL='https://reviewed-host.example/abrn/' \
E2E_API_BASE_URL='https://reviewed-host.example/api' \
npm run test:e2e:external -- <reviewed-spec-list>
```

E2E spec files live in `vaultdrive_client/e2e/`. Helper functions (account creation, login, onboarding) are in `vaultdrive_client/e2e/helpers/trust.ts`.

**Important:**

- The E2E harness uses an isolated local Postgres database by default: `vaultdrive_playwright`.
- On startup, Playwright runs the full goose migration set against that database before it launches `go run .`.
- Test uploads are written to `E2E_UPLOAD_DIR` (default `/tmp/quantix-playwright-uploads`) instead of the repo-local `uploads/` directory.
- Each run creates real accounts using unique `qa-{timestamp}-{suffix}@example.com` addresses.
- The loopback rate-limiter bypass (`isLoopbackIP()` in `middleware_ratelimit.go`) ensures parallel workers from `127.x.x.x` never hit the 5/min PIN or 10/min login limits.

#### E2E Coverage

| Spec | What it tests |
|------|--------------|
| `owner-trust-flow.spec.ts` | Signup, onboarding, PIN login, action receipts |
| `file-upload-flow.spec.ts` | Browser-side AES-256-GCM encryption, vault display, metadata |
| `drop-full-cycle.spec.ts` | Drop link creation, anonymous upload, owner download, PIN recovery |
| `share-link-lifecycle.spec.ts` | Share link create/access/revoke, AES key stays in fragment |
| `upload-link-lifecycle.spec.ts` | Upload link creation, anonymous delivery, expiry |
| `group-crud.spec.ts` | Group create, member management, delete |
| `group-sharing.spec.ts` | File sharing with groups, access revocation |
| `public-sender-flows.spec.ts` | Drop sender routes, folder uploads, file requests |
| `agent-key-lifecycle.spec.ts` | Agent key create/introspect/scope-deny/revoke/audit, Filemon operator |
| `trust-safety-ux.spec.ts` | PIN UX, empty states, upload link trace receipts, encryption footer |

### CI

The `ci` workflow runs on every push and PR against `main`:

- **Backend**: `go test -race ./...`, `go vet ./...`, `go build`
- **Frontend**: `npm ci`, `npm test` (vitest), `npx tsc --noEmit`, `npm run build`
- **Migrations**: goose runs against a real Postgres 16 service container
- **Build verification**: asserts `dist/index.html` contains the `/quantix/` base path

---

## Rate Limiting

Per-route rate limits enforced in `middleware_ratelimit.go` using a sliding window per client IP:

| Route group | Limit | Middleware |
|-------------|-------|-----------|
| Login (`POST /api/login`) | 10 req/min | `middlewareRateLimitLogin` |
| PIN (`POST /api/users/pin`, `PUT /api/users/pin`) | 5 req/min | `middlewareRateLimitPIN` |
| All other routes | 100 req/min | `middlewareRateLimit` |

**Loopback bypass:** `127.0.0.0/8` and `::1` are exempt from the login and PIN rate limiters. This allows parallel E2E test workers running locally to complete without hitting 429 errors. The global 100 req/min limit still applies to loopback (the test suite stays well under it).

In production, set `X-Forwarded-For` or `X-Real-IP` headers correctly in your reverse proxy so the correct client IP is rate-limited.

---

## Agent API Keys

Agent keys let external systems (AI agents, automation tools, webhooks) access the API with scoped, revocable credentials.

Keys are created per-user from the Settings > Advanced tab or via `POST /api/v1/agent-keys`. Each key has:
- A human-readable name
- One or more permission scopes (`files:list`, `files:read_metadata`, `activity:read`, `api_keys:read`, etc.)
- Optional notes
- Status (`active` / `revoked`)
- A `last_used_at` timestamp updated on every authenticated request

Keys are prefixed with `AGENT_KEY_PREFIX` (default: `qxak_`). The plaintext key is shown once at creation and never stored — only the hash is persisted.

Use the **Filemon operator** in Settings > Advanced to test a key interactively: paste the raw key, pick an endpoint, click Run, and see the exact HTTP request and response the key produces.

---

## Theming & Skins

QuantiX Drive ships six built-in interface skins. The default is **QuantiX** — a dark neon aesthetic matching the quantixmexico.net landing page.

### Available skins

| Skin | Background | Primary accent | Mode |
|------|-----------|---------------|------|
| **QuantiX** (default) | `#0a0a1a` deep navy | `#01fff7` cyan + `#ea12ff` magenta | Dark |
| **Light** | `#faf8f5` warm cream | `#7d4f50` burgundy | Light |
| **Dark** | `#1e2330` slate | `#c4999b` light burgundy | Dark |
| **Cyberpunk** | `#0d0d0d` near-black | `#f0ff00` neon yellow + `#ff0090` hot pink | Dark |
| **Elegant** | `#1a1208` deep warm dark | `#b8860b` gold | Dark (serif headings) |
| **Business** | `#f8fafc` clean white | `#1e40af` corporate blue | Light |

### How it works

- **CSS custom properties** (`[data-theme="X"]` selectors on `<html>`) override all shadcn/ui tokens, so every component rethemes without code changes.
- **Dark skins** also add the `.dark` class so Tailwind `dark:` utilities work.
- **Full color consistency** — all 70+ component and page files use semantic Tailwind classes (`bg-primary`, `border-border`, `bg-card`, `bg-muted`, `bg-popover`, `text-muted-foreground`) rather than hardcoded hex values. No `bg-[#hex]` arbitrary values in application code.
- **Tailwind Build Guardrails** — Enforced in `index.css` by mapping standard palettes (`slate`, `gray`, `zinc`, `neutral`, `stone`) to `initial`. Default Tailwind colors will not compile, preventing hardcoded color drift.
- **Pre-commit Styling Hooks** — A Git pre-commit hook (`.git/hooks/pre-commit`) automatically scans staged files, scrubs raw slates and hex overrides using cleanup scripts, and stages the sanitized files before commit.
- **FOUC prevention** — an inline `<script>` in `index.html` sets `data-theme` before React mounts, eliminating the flash of unstyled content.
- **Preference** is stored in `localStorage` under key `quantixdrive-skin`. Migrates old `vaultdrive-ui-theme` values automatically.
- **Pixel-Perfect Scrollbar Insets** — Scrollable panels use the `.scrollable-panel` helper to style thumbs dynamically to match skins and keep tracks transparent, avoiding clipped rounded borders.
- **Circular Theme Reveal & SPA Navigation Transitions** — Uses the native View Transitions API (`startViewTransition()`) to animate skin changes with a circular clip-path ripple expanding from the user's cursor, and page changes with a smooth slide-and-fade, keeping the sidebar and header pinned. Safely falls back to instant swaps on unsupported devices and respects system `prefers-reduced-motion` settings.

### Changing the skin

Users pick a skin from **Settings → Account → Appearance** (6-swatch visual grid). The nav bar theme-toggle button cycles through all skins and shows a gradient dot matching the active palette.

### QuantiX-specific visuals

- Ambient background orbs: three overlapping `radial-gradient` ellipses (cyan + magenta) with `background-attachment: fixed`, visible through glassmorphic cards.
- Gradient scrollbar: cyan → magenta (WebKit) + `scrollbar-color` (Firefox).
- `--glass-border-strong: 1px solid rgba(1, 255, 247, 0.20)` for cyan-tinted glass borders.


### Adding a new skin

1. Add a block `[data-theme="myname"] { ... }` to `vaultdrive_client/src/styles/skins.css` defining all shadcn CSS variables.
2. Add a `SkinMeta` entry to the `SKINS` array in `src/components/theme-provider.tsx`.
3. Add `"myname"` to the `VALID` and (if dark) `DARK` arrays in `vaultdrive_client/index.html`.

No component code changes required.

---

## Upstream / Downstream Model

QuantiX Drive is designed to be deployed two ways:

1. **As-is**, configured entirely via environment variables.
2. **As an upstream for a branded downstream overlay**, where a private fork adds product-specific assets, copy, and integrations without modifying core logic.

Downstream overlays should:

- Track this repository as `upstream` and rebase/merge forward regularly.
- Only override: `.env*` files, `public/` assets, `vaultdrive_client/src/components/branding/*`, and any downstream-only workflows.
- Keep core logic (`handle_*.go`, `main.go`, `sql/schema/*`) unmodified so upstream updates apply cleanly.
- Set `AGENT_KEY_LEGACY_PREFIXES` to preserve any pre-existing agent keys minted before the split.

---

## Security

- Supported file-content flows encrypt with AES-256-GCM in the browser before upload; the service stores ciphertext while retaining operational metadata such as filenames, sizes and access records.
- Normal owner, user and group sharing uses client-side key wrapping. Secure Drop delivery-key recovery and account recovery are explicit server-coordinated exceptions documented in the trust contract.
- Short-lived JWTs (30 min) with refresh token rotation. SSE connections use one-time tickets.
- Per-route rate limiting: login 10/min, PIN 5/min, global 100/min. Loopback IPs exempt from login/PIN limits (dev/CI only).
- All error responses from API handlers return JSON — no plain-text error leakage.
- Admin promotion is env-driven (`ADMIN_BOOTSTRAP_EMAILS`) — no hardcoded grants in source or migrations.

Report security issues privately to the repository owner.

---

## Docs

Detailed session logs and feature documentation live in `docs/`:

The pass counts and completion language in the dated documents below describe their historical checkpoints. They do not replace the current release report or the outstanding manual gates listed above.

| Doc | Contents |
|-----|---------|
| `docs/INDEX.md` | Full index of all feature docs |
| `docs/11_TRUST_API_AGENT_KEYS.md` | Agent API key design and scopes |
| `docs/15_TRUST_PROOF_HARNESS.md` | E2E test harness design |
| `docs/22_DROP_KEY_RECOVERY.md` | Drop link PIN-based key recovery |
| `docs/24_SECURITY_GOVERNANCE_PRODUCTIZATION.md` | Audit log, governance settings |
| `docs/25_QA_SESSION_2026-04-12.md` | Full QA pass log — 38/38 E2E green |
| `docs/26_SKIN_SYSTEM_2026-04-12.md` | Skin system design, all 6 themes, FOUC fix, verification |
| `docs/27_THEME_COLOR_CONSISTENCY_2026-04-12.md` | Full color consistency fix — 70 files, 3 Python scripts, replacement map, main.go panic fix |
| `docs/28_BUILD_VERIFICATION_2026-04-16.md` | End-to-end build verification pass, session-vault cleanup fix, cached-PIN recovery fix, Playwright isolated-db harness update |
| `docs/SESSION_MEMORY_2026-04-16-docs-memory-and-verification.md` | Durable checkpoint for this session, including what changed, what was verified, risks, and why the branch is safe to continue |
| `docs/qa-report-2026-04-16.html` | Visual verification report covering backend, frontend, unit, and end-to-end validation |
| `docs/reports/2026-05-22-qa-feature-coverage-report.html` | Comprehensive Hackathon 2026-05-22 QA Pass report — 41/42 E2E passed |
| `docs/memories/2026-05-22-hackathon-victory-lap.md` | Final Hackathon 2026-05-22 polish, UI speed enhancements, and victory memory |
| `docs/memories/session-2026-05-22-i18n-completion.md` | i18n implementation and hardcoded string removal across the UI |
| `docs/memories/2026-05-22-hackathon-victory.md` | Hackathon Victory memory detailing E2E test suite reliability, dynamic base path fixes, and rate limiter loopback bypass |
| `docs/memories/session-2026-05-22-e2e-demo-victory.md` | Final E2E Demo victory with Playwright Golden Path matching the beautiful new UI, executing flawlessly in 31 seconds |
| `docs/memories/session-2026-05-23-decoupling-environments.md` | Decoupled ABRN Drive from QuantiX Drive |
| `docs/memories/session-2026-05-23-ux-phase.md` | Undeniable UX Phase: Cmd+K, Optimistic UI, SWR Hover Prefetching, and Framer Motion micro-animations |
| `docs/memories/session-2026-05-23-verification-closeout.md` | Verification & closeout of UX phase — all checks passed, testTimeout fix applied |
| `docs/reports/2026-05-23-ux-phase-verification.md` | UX Phase verification report (Markdown) |
| `docs/reports/2026-05-23-ux-phase-verification.html` | UX Phase verification report (HTML — browser-readable) |
| `docs/memories/session-2026-05-24-ux-roadmap-steps1-4.md` | Phase V UX Roadmap Steps 1-4: Theme Coherence, Language Switcher, Toast System, i18n Completion |
| `docs/reports/2026-05-24-ux-roadmap-steps1-4-verification.md` | UX Roadmap Steps 1-4 verification report (Markdown) |
| `docs/reports/2026-05-24-ux-roadmap-steps1-4-verification.html` | UX Roadmap Steps 1-4 verification report (HTML — browser-readable) |
| `docs/memories/session-2026-06-09-couch-recovery-closeout.md` | Final Couch Recovery verification session memory (flaky test resolved, E2E green) |
| `docs/reports/2026-06-09-couch-recovery-closeout-verification.md` | Final closeout verification markdown report |
| `docs/reports/2026-06-09-couch-recovery-closeout-verification.html` | Final closeout verification HTML report (browser-readable) |

---

## License

See `LICENSE`.

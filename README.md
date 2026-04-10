# QuantiX Drive

> Zero-knowledge encrypted cloud drive. Browser-side encryption, scoped agent access, and full auditability — deploy under your own brand and domain.

QuantiX Drive is a self-hostable file control plane where every file is encrypted in the browser before it ever reaches the server. The server stores ciphertext only. Owners share time-limited links, collect files from partners without accounts, and delegate scoped access to AI agents or external systems — all without compromising the zero-knowledge boundary.

QuantiX Drive is designed as a reusable **upstream product**. Deployments brand and configure it through environment variables; downstream overlays (e.g. an internal enterprise fork) only need to override configuration, assets, and optionally a handful of branding components.

---

## What It Does

- **Store** — AES-256-GCM encrypted file vault. PIN-based access, session key cache, inline preview, vault-wide search via pg_trgm.
- **Share** — Time-limited public links with the AES key in the URL fragment (never reaches the server). Expiry, access tracking, instant revoke.
- **Collect** — Public drop portals with required-document checklists, reusable collection templates, and intake analytics. File Requests for per-recipient secure intake.
- **Collaborate** — Share files and folders with users and groups via zero-knowledge RSA key exchange.
- **Access Center** — Unified owner surface for all outbound access: file share links, folder share links, and drop routes, filtered by status.
- **Delegate** — Per-user Agent API Keys with granular scopes, last-used tracking, and full revocability for AI agents and external systems.
- **Audit** — Filterable audit log with CSV/JSON export; governance settings for retention, stale-link auto-expiry, and failed-access alerting.
- **Control** — Stable `/api/v1/` surface, short-lived JWTs with refresh flow, per-route rate limiting, and one-time SSE tickets.

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

- **Backend** — Go 1.24 HTTP server in a single binary. JWT auth, per-user RSA key envelopes, pg_trgm search, per-route rate limiting, SSE ticketing.
- **Frontend** — React + TypeScript + Vite SPA. All crypto in-browser via Web Crypto; backend never sees plaintext.
- **Database** — PostgreSQL 16, schema managed by [goose](https://github.com/pressly/goose) migrations in `sql/schema/`.
- **Deployment** — Multi-stage Dockerfile produces a single static binary with embedded frontend assets. CI publishes OCI images to GHCR.

---

## Quickstart (Local Dev)

The fastest path is Docker Compose. It boots Postgres, runs migrations, and starts the server under `/quantix/`.

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

# 4. Run the backend
DB_URL="postgres://postgres:postgres@localhost:5432/vaultdrive?sslmode=disable" \
JWT_SECRET="local-dev-secret-minimum-32-characters-long" \
PRODUCT_NAME="QuantiX Drive" \
PRODUCT_SLUG=quantix-drive \
BASE_PATH=/quantix/ \
AGENT_KEY_PREFIX=qx_ak \
PORT=8090 \
go run .
```

---

## Configuration

All runtime configuration is env-driven — there is no baked-in product identity. The variables below are the full public surface.

### Required

| Variable | Purpose |
|----------|---------|
| `DB_URL` | Postgres connection string (with `sslmode` param) |
| `JWT_SECRET` | HS256 signing secret (minimum 32 characters) |
| `PORT` | HTTP listen port (defaults to `8090`) |

### Product branding

| Variable | Default | Purpose |
|----------|---------|---------|
| `PRODUCT_NAME` | `QuantiX Drive` | Display name used in email, audit, and UI copy |
| `PRODUCT_SLUG` | `quantix-drive` | URL-safe identifier used in manifest and internal keys |
| `BASE_PATH` | `/quantix/` | URL prefix the SPA is served under (must match frontend build) |
| `AGENT_KEY_PREFIX` | `qx_ak` | Prefix for newly minted agent API keys |
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
  -e DB_URL="postgres://..." \
  -e JWT_SECRET="$(openssl rand -base64 32)" \
  -e PRODUCT_NAME="QuantiX Drive" \
  -e BASE_PATH=/quantix/ \
  -e AGENT_KEY_PREFIX=qx_ak \
  -e PUBLIC_BASE_URL="https://quantixdrive.example.com" \
  -e CORS_ALLOWED_ORIGINS="https://quantixdrive.example.com" \
  -e ADMIN_BOOTSTRAP_EMAILS="admin@example.com" \
  ghcr.io/vinuxito/quantix-drive:latest
```

Run `goose -dir sql/schema postgres "$DB_URL" up` once against your Postgres instance before first boot. Front the container with a TLS-terminating reverse proxy (Caddy, nginx, Cloudflare Tunnel) on `BASE_PATH`.

---

## Testing & CI

The `ci` workflow runs on every push and PR against `main`:

- **Backend**: `go test -race ./...`, `go vet ./...`, `go build`
- **Frontend**: `npm ci`, `npm test` (vitest), `npx tsc --noEmit`, `npm run build`
- **Migrations**: goose runs against a real Postgres 16 service container
- **Build verification**: asserts `dist/index.html` contains the `/quantix/` base path

Run the same checks locally:

```bash
# Backend
go test -race ./... && go vet ./...

# Frontend
cd vaultdrive_client
npm test && npx tsc --noEmit && npm run build
```

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

- All file content is AES-256-GCM encrypted in the browser before upload. The server stores ciphertext only.
- Per-user RSA key envelopes protect symmetric keys; the server never sees plaintext keys.
- Short-lived JWTs (30 min) with refresh token rotation. SSE connections use one-time tickets.
- Per-route rate limiting: login 10/min, PIN 5/min, global 100/min.
- Admin promotion is env-driven (`ADMIN_BOOTSTRAP_EMAILS`) — no hardcoded grants in source or migrations.

Report security issues privately to the repository owner.

---

## License

See `LICENSE`.

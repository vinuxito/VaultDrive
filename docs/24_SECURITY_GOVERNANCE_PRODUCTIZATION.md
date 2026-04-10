# Session 24 — Security Hardening, Governance & Collection Productization

**Date:** April 10, 2026
**Branch:** `gnhf/make-sure-we-can-upl-56c5d2`
**Base plan:** `docs/plans/2026-04-09-master-remaining-build-plan.md`

---

## Summary

7-iteration implementation session covering the highest-priority remaining items from the master plan:
security hardening (JWT lifetime, rate limiting, SSE ticket system), audit governance, performance
(lazy loading, bundle splitting), and product surface (Access Center, collection templates, sender
checklist, intake analytics).

Additionally: full Go module rename from `github.com/Pranay0205/VaultDrive` →
`github.com/vinuxito/VaultDrive` across all 41 Go files.

---

## Iteration 1 — Security Foundations

### JWT Lifetime Reduction
**File:** `handle_login.go`
- Changed JWT lifetime from 30 days → **30 minutes**
- Short-lived tokens mean a stolen JWT expires fast

### Rate Limiting Middleware
**File:** `middleware_ratelimit.go` (NEW)
- Sliding window rate limiter using stdlib `sync.Mutex` + `map[string][]time.Time`
- `loginRateLimiter`: 10 req/min per IP on `POST /api/login`
- `pinRateLimiter`: 5 req/min per IP on `POST /api/users/pin`
- `globalRateLimiter`: 100 req/min per IP (global middleware)
- Background purge goroutine every 5 minutes cleans stale entries
- Returns `Retry-After: 60` header on 429

### Refresh Token Endpoints
**File:** `handle_auth_refresh.go` (NEW)
- `POST /api/auth/refresh` — validates refresh token from Bearer header, issues new 30-min JWT
- `POST /api/auth/revoke` — revokes refresh token

### SSE One-Time Ticket System
**File:** `handle_events.go` (MODIFIED)
- Added `sseTickets sync.Map` with 30-second expiry
- `POST /api/events/ticket` — exchanges JWT for a one-time UUID ticket
- `GET /api/events` — prefers `?ticket=` (validates + deletes), falls back to `?token=`
- Tickets never expose the JWT in the URL

### Protected Route — Client-Side Token Expiry
**File:** `vaultdrive_client/src/components/protected-route.tsx` (REWRITE)
- `decodeJWTPayload(token)`: base64url decodes JWT payload
- `isTokenExpired(token)`: checks `exp` claim with 10-second clock skew buffer
- Exports `handleUnauthorized()` for global 401 handling
- Clears localStorage immediately on expiry detection

---

## Iteration 2 — Audit Infrastructure

### Dynamic Audit Log Filtering + CSV Export
**File:** `handle_audit.go` (REWRITE)
- `parseAuditQueryParams()` extracts: action, resource_type, resource_id, from, to, limit, offset
- `fetchAuditLogs()` builds dynamic SQL with args slice (no sqlc regen needed)
- `handlerExportAuditLogs` — CSV or JSON, 10,000 row cap, `X-Export-Truncated` header

### Security Posture Endpoint
**File:** `handle_activity.go` (MODIFIED)
- `GET /api/v1/security-posture` now returns: stale agent keys count + never-used links count
- Both queried in single raw SQL with no N+1

---

## Iteration 3 — Vault Search + CI Gates

### Filename Search
**File:** `handle_list_files.go` (MODIFIED)
**Migration:** `sql/schema/041_files_search_index.sql` (NEW)
- `?q=` parameter on `GET /api/files` — case-insensitive substring match
- pg_trgm extension + GIN index for performance at scale

### CI/CD Gates
**File:** `.github/workflows/backend-deploy.yml` (MODIFIED)
- Added before Docker build: `setup-go@v5`, `go test -race ./...`, `go vet ./...`, `go build`

**File:** `.github/workflows/azure-static-web-apps-proud-dune-0024f9810.yml` (MODIFIED)
- Added before deploy: `setup-node@v4`, `npm ci`, `npx vitest run`, `npm run build`

---

## Iteration 4 — Module Rename

**All 41 Go files:** `github.com/Pranay0205/VaultDrive` → `github.com/vinuxito/VaultDrive`
**File:** `go.mod` — module name updated

---

## Iteration 5 — Performance

### Lazy Loading
**File:** `vaultdrive_client/src/App.tsx` (REWRITE)
- 8 authenticated pages converted to `React.lazy()`: Dashboard, Files, Shared, Profile, Settings, Groups, Admin, AdminTests
- Suspense layout route wraps Outlet (`<Route element={<Suspense>…}>`)
- `PageLoader` spinner component for fallback

### Circular Dependency Fix
**Files:** `AgentOperationsSection.tsx`, `ControlPlaneStatusSection.tsx`
- Changed `from "../../hooks"` → `from "../../hooks/useSSE"` to break rollup circular dep warning

### SSE Hook Rewrite
**File:** `vaultdrive_client/src/hooks/useSSE.ts` (REWRITE)
- `obtainSSETicket()` — calls `POST /api/events/ticket` with Authorization header
- Tab visibility: pause on hidden, reconnect on visible
- Exponential backoff: `5000ms * 2^n`, capped at 30,000ms
- Calls `handleUnauthorized()` on 401 from ticket endpoint

### Drop Token Intake Analytics
**File:** `handle_drop.go` (MODIFIED)
- `handlerListDropTokens` now includes: `link_name`, `description`, `last_upload_at` (single JOIN aggregation query), `files_uploaded` as proper int32

### SSE Burst Toast Consolidation
**File:** `vaultdrive_client/src/components/layout/dashboard-layout.tsx` (MODIFIED)
- 800ms debounce via `useRef` burst buffer
- Single event → specific message; burst of N → "N new activities" consolidated toast

---

## Iteration 6 — Collection Productization

### DB Migrations
- **042:** `upload_link_templates` table — id, user_id, name, description, default_message, checklist_items JSONB, branding_tag, timestamps
- **043:** `checklist_items JSONB` column on `upload_tokens`

### Collection Templates CRUD
**File:** `handle_collection_templates.go` (NEW)
- `GET /api/v1/collection-templates` — list owner's templates
- `POST /api/v1/collection-templates` — create
- `PUT /api/v1/collection-templates/{id}` — update (uses `r.PathValue("id")`)
- `DELETE /api/v1/collection-templates/{id}` — delete

### Shares List Endpoint
**File:** `handle_shares.go` (NEW)
- `GET /api/v1/shares` — unified list of file share links + folder share links
- Status logic: active / expired / revoked / never_used / stale (>30 days no access)
- Single query per type (no N+1)

### Checklist on Drop Token Info
**File:** `handle_drop.go` (MODIFIED)
- `handlerDropTokenInfo` response now includes `checklist_items` from migration 043 column

### Access Center Page
**File:** `vaultdrive_client/src/pages/access-center.tsx` (NEW)
- Route: `/access-center` (lazy-loaded)
- Tabs: All / Share Links / Drop Routes
- Per-status filter bar: All / Active / Expired / Revoked / Never used / Stale
- Per-item: resource name, type badge, status badge, access count, last accessed, copy/open actions
- Sidebar nav item: "Access Center" with ShieldCheck icon

### Sender Checklist UI
**File:** `vaultdrive_client/src/pages/drop-upload.tsx` (MODIFIED)
- `TokenInfo` interface extended with `checklist_items?: string[]`
- Checklist section above upload area (only shown if items exist)
- Checkboxes with line-through on tick, "Checklist complete" confirmation on all-checked

---

## Iteration 7 — Governance Settings

### DB Migration
- **044:** `audit_retention_days` (default 365), `auto_expire_stale_days` (nullable = disabled), `failure_alert_threshold` (default 3) — added to `users` table

### Governance Settings API
**File:** `handle_governance.go` (NEW)
- `GET /api/v1/governance/settings` — returns per-user governance config
- `PUT /api/v1/governance/settings` — updates with validation (retention 30–3650 days, threshold 1–100)
- Correct NULL-set behavior: `CASE WHEN $3 THEN $4 ELSE NULL END` — disabling auto-expire sets column to NULL

### Settings → Governance Tab
**File:** `vaultdrive_client/src/pages/settings.tsx` (MODIFIED)
- New "Governance" tab alongside Account / Security / Advanced
- Audit retention period dropdown (30d / 90d / 1yr / Forever)
- Auto-expire toggle + days input
- Failed access alert threshold input
- Save button with loading/saved feedback

---

## Bugs Fixed During Verification

| Bug | Location | Fix |
|-----|----------|-----|
| `extractPathSegment` manual path parse | `handle_collection_templates.go` | Replaced with `r.PathValue("id")` (Go 1.22+) |
| Governance update kept old stale-days when disabling | `handle_governance.go` | Changed `ELSE auto_expire_stale_days` → `ELSE NULL` |
| Dead `retentionDays`/`alertThreshold` vars | `handle_governance.go` | Replaced `QueryRowContext` + scan with `ExecContext` |
| Circular rollup dependency | `useSSE.ts` re-exported via barrel | Direct import in settings components |
| `<Suspense>` as non-Route child of Routes | `App.tsx` | Nested layout route pattern |

---

## Verification Results

| Check | Result |
|-------|--------|
| `go build ./...` | CLEAN |
| `go vet ./...` | CLEAN |
| `tsc --noEmit` | CLEAN |
| `npx vitest run` | **66/66** (19 test files) |
| `go test -race ./...` | PASS |
| `npm run build` | CLEAN, no warnings |

---

## New Endpoints Summary

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/refresh` | Bearer refresh token | Exchange refresh token for new 30-min JWT |
| POST | `/api/auth/revoke` | Bearer refresh token | Revoke refresh token |
| POST | `/api/events/ticket` | Bearer JWT | Obtain one-time SSE connection ticket |
| GET | `/api/v1/shares` | JWT (middlewareAuth) | List all share links for authenticated user |
| GET | `/api/v1/collection-templates` | JWT | List collection templates |
| POST | `/api/v1/collection-templates` | JWT | Create collection template |
| PUT | `/api/v1/collection-templates/{id}` | JWT | Update collection template |
| DELETE | `/api/v1/collection-templates/{id}` | JWT | Delete collection template |
| GET | `/api/v1/governance/settings` | JWT | Get per-user governance settings |
| PUT | `/api/v1/governance/settings` | JWT | Update per-user governance settings |

---

## New DB Migrations

| Migration | Description |
|-----------|-------------|
| 041 | pg_trgm extension + GIN index on files.filename |
| 042 | `upload_link_templates` table |
| 043 | `checklist_items JSONB` on `upload_tokens` |
| 044 | Governance columns on `users` table |

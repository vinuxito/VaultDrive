# ABRN Drive — Master Remaining Build Plan

**Date:** 2026-04-09
**Scope:** Everything planned but not yet implemented, synthesized from all prior plan documents.
**Excludes:** Email features (intentionally removed from product scope).
**Priority order:** Security first, then governance, then product surface, then developer ecosystem, then polish.

---

## Table of Contents

1. [Auth / Session / Deploy Safety Gaps](#1-auth--session--deploy-safety-gaps)
2. [Compliance-Grade Audit & Governance](#2-compliance-grade-audit--governance)
3. [Unified Outside Access Center + Vault Search](#3-unified-outside-access-center--vault-search)
4. [Client Collection Workflow Productization](#4-client-collection-workflow-productization)
5. [Performance & Shell Scalability](#5-performance--shell-scalability)
6. [Agent Integration Kit](#6-agent-integration-kit)
7. [Luxury UI Polish — Steps 2–7](#7-luxury-ui-polish--steps-27)
8. [AI Agent API Platform](#8-ai-agent-api-platform)
9. [Standalone Known Gaps](#9-standalone-known-gaps)

---

## 1. Auth / Session / Deploy Safety Gaps

**Category:** Security
**Why first:** The trust model is strong cryptographically but the operational edges are weaker than the product's own posture. These are real attack surface gaps, not polish items.

---

### Task 1.1 — Harden `protected-route.tsx` auth check

**File:** `vaultdrive_client/src/components/protected-route.tsx`

**Current problem:** Auth state is determined by token presence in `localStorage`. An expired or invalid token keeps the user in the authenticated shell until the next API call fails.

**What to implement:**
- On mount, validate the stored JWT by either:
  - Decoding the expiry claim client-side (`exp` field) and immediately redirecting to `/login` if the token is expired.
  - OR making a lightweight `GET /api/users/me` call on route entry and treating a 401 response as a forced logout.
- When a 401 is returned from any API call in the app, trigger a centralized logout + redirect rather than silently failing.
- Add a global Axios/fetch interceptor or a shared response handler that catches 401s and clears the session.

**Files to touch:**
- `vaultdrive_client/src/components/protected-route.tsx` — add expiry check logic
- `vaultdrive_client/src/utils/api.ts` (or equivalent fetch wrapper) — add 401 interceptor
- `vaultdrive_client/src/pages/login.tsx` — ensure redirect destination is preserved in state so users land back after re-auth

**Definition of done:**
- A user with an expired token is redirected to login on route entry, not after the first failed data fetch.
- Any 401 from any endpoint triggers logout.

---

### Task 1.2 — Replace URL query-string SSE bearer auth

**File:** `handle_events.go`

**Current problem:** The SSE endpoint accepts the JWT as a URL query parameter (`?token=...`). Query strings are logged by every reverse proxy, web server access log, and browser history. This exposes long-lived bearer tokens.

**What to implement:**
- Accept the JWT via a short-lived one-time ticket instead of the raw bearer token in the URL.
- Implementation option A (preferred — minimal backend change):
  - Add `POST /api/events/ticket` — authenticated endpoint that returns a single-use, short-TTL (30 seconds) opaque token stored in a small in-memory map in the server.
  - The SSE endpoint accepts `?ticket=...`, looks up the ticket, validates it, and immediately invalidates it after one use.
  - The ticket maps to the validated user ID so downstream event filtering still works.
- Implementation option B (alternative): Accept the JWT in the `Authorization` header even for SSE by initiating the connection with a `fetch` + `ReadableStream` rather than the browser `EventSource` API (which does not support custom headers).
  - Requires updating `vaultdrive_client/src/hooks/useSSE.ts` (or equivalent) to use `fetch` instead of `EventSource`.

**Files to touch:**
- `handle_events.go` — ticket validation, single-use map, ticket expiry cleanup goroutine
- `main.go` — register `POST /api/events/ticket` route
- `vaultdrive_client/src/hooks/useSSE.ts` — obtain ticket before connecting, pass ticket not raw JWT

**Definition of done:**
- The SSE connection URL contains no JWT or long-lived credential.
- Apache / nginx access logs no longer capture bearer tokens.

---

### Task 1.3 — Shorten JWT lifetime and finish refresh token path

**File:** `handle_login.go`

**Current problem:** JWT lifetime is long enough that a stolen token is dangerous for an extended window. No refresh mechanism forces periodic re-validation.

**What to implement:**
- Shorten access JWT to 15–30 minutes.
- Add a refresh token:
  - On login, issue both an access JWT (15–30m) and a refresh token (7 days, stored as `HttpOnly; SameSite=Strict` cookie, not in localStorage).
  - Add `POST /api/auth/refresh` — validates the refresh cookie, issues a new access JWT.
  - Add `POST /api/auth/logout` — invalidates the refresh token server-side (requires a `refresh_tokens` table or in-memory set of revoked tokens).
- Frontend should call `/api/auth/refresh` automatically when the access token is near expiry or when a 401 is received.

**New DB migration needed:** `refresh_tokens` table — columns: `id`, `user_id`, `token_hash` (SHA-256 of the token, never store raw), `expires_at`, `revoked_at`.

**Files to touch:**
- `sql/schema/NNN_refresh_tokens.sql` — new migration
- `sql/queries/refresh_tokens.sql` — insert, validate, revoke queries
- `internal/database/refresh_tokens.sql.go` — regenerated via `sqlc generate`
- `handle_login.go` — issue refresh token, set `HttpOnly` cookie
- `handle_auth_refresh.go` — new file, refresh endpoint
- `main.go` — register refresh and logout routes
- `vaultdrive_client/src/utils/api.ts` — auto-refresh logic on 401 or near-expiry
- `vaultdrive_client/src/pages/login.tsx` — stop storing JWT in localStorage (use memory + refresh cookie model)

**Definition of done:**
- Access tokens expire in ≤30 minutes.
- A page refresh does not log the user out (refresh cookie handles re-auth transparently).
- Logout revokes the refresh token server-side.

---

### Task 1.4 — Rate limiting on auth endpoints

**File:** `main.go`, `handle_login.go`, `handle_user_pin.go`

**Current problem:** Password login, PIN verification, and other auth-sensitive endpoints have no server-side rate limiting. Brute force is unconstrained.

**What to implement:**
- Use a token-bucket or sliding-window rate limiter per IP for:
  - `POST /api/auth/login` — max 10 attempts per minute per IP, with exponential backoff after 5 failures.
  - `POST /api/users/pin` (PIN verification) — max 5 attempts per minute per user (already has lockout logic; add IP-level pre-check).
  - `POST /api/auth/refresh` — max 60 per hour per IP.
- Options for implementation:
  - Pure Go: use `golang.org/x/time/rate` with a `sync.Map` keyed by IP.
  - Or a Redis-backed counter if Redis is already in the stack (check `go.mod`).
- Return `429 Too Many Requests` with a `Retry-After` header.
- Log rate-limit events to the audit table.

**Files to touch:**
- `middleware_ratelimit.go` — new file, generic rate limiter middleware
- `main.go` — apply middleware to auth routes specifically
- `handle_login.go` — integrate with rate limiter
- `handle_user_pin.go` — integrate with rate limiter

**Definition of done:**
- Sending 20 login requests in 10 seconds from the same IP returns 429 after the 10th.
- Rate limit events appear in the audit log.

---

### Task 1.5 — Add real test gates to CI deploy workflows

**Files:** `.github/workflows/backend-deploy.yml`, `.github/workflows/azure-static-web-apps-proud-dune-0024f9810.yml`

**Current problem:** Deploy pipelines either have no test gates or have them commented out / skipped. A breaking change can ship without any automated verification.

**What to implement for `backend-deploy.yml`:**
```yaml
- name: Run Go tests
  run: go test ./...

- name: Run Go vet
  run: go vet ./...

- name: Build backend binary
  run: go build -o abrndrive ./...
```
These must run before the deploy step. If any fail, the workflow must stop.

**What to implement for the frontend workflow:**
```yaml
- name: Install frontend deps
  run: cd vaultdrive_client && npm ci

- name: Run frontend tests
  run: cd vaultdrive_client && npx vitest run

- name: Build frontend
  run: cd vaultdrive_client && npm run build
```
These must also gate the deploy step.

**Stretch goal:** Run the Playwright E2E suite against a staging build before deploy. At minimum, tag the E2E job as `if: github.ref == 'refs/heads/main'` so it runs only on main but does not block feature branch CI.

**Definition of done:**
- A commit that breaks `go test ./...` or `vitest run` cannot merge/deploy via CI.
- Both workflow files have explicit test steps before deploy steps.

---

## 2. Compliance-Grade Audit & Governance

**Category:** Commercialization / Enterprise trust
**Why:** The audit infrastructure (`audit.go`, `/api/v1/audit`, `AuditLogSection.tsx`) already exists. What is missing is the reporting and governance layer that makes it useful for real review workflows.

---

### Task 2.1 — Audit log filtering

**Files:** `handle_audit.go` (or wherever `GET /api/v1/audit` is handled), `vaultdrive_client/src/components/settings/AuditLogSection.tsx`

**Current state:** Audit log displays as a raw event stream. No filters.

**What to implement (backend):**
- Add query parameters to `GET /api/v1/audit`:
  - `?actor_id=` — filter by user ID
  - `?action=` — filter by event type (e.g., `file.downloaded`, `share.created`)
  - `?resource_type=` — filter by resource type (`file`, `drop_link`, `share`, `agent_key`)
  - `?from=` and `?to=` — ISO 8601 date range filter
  - `?limit=` and `?offset=` — pagination (default limit 100, max 500)
- Update the SQL query in `sql/queries/audit.sql` to accept these as optional WHERE clauses.
- Regenerate `internal/database/audit.sql.go` via `sqlc generate`.

**What to implement (frontend `AuditLogSection.tsx`):**
- Add a filter bar above the audit table with:
  - Date range picker (from / to)
  - Action type dropdown (populated from a known set of event types)
  - Actor search input (user email or ID)
  - Resource type selector
- Filters are applied via URL query params on `GET /api/v1/audit`.
- Add a clear-filters button.
- Show the total matching event count above the table.

**Definition of done:**
- Filtering by any combination of date range, actor, action type, resource type returns the correct subset.
- Pagination works correctly under all filter combinations.

---

### Task 2.2 — Exportable audit reports

**Files:** `handle_audit.go`, `vaultdrive_client/src/components/settings/AuditLogSection.tsx`

**What to implement (backend):**
- Add `GET /api/v1/audit/export` — accepts the same filter parameters as the audit list endpoint.
- Returns either:
  - `?format=csv` → `Content-Type: text/csv`, `Content-Disposition: attachment; filename="audit-{date}.csv"`
  - `?format=json` → `Content-Type: application/json` with the full filtered event list
- CSV columns: `timestamp`, `actor_email`, `action`, `resource_type`, `resource_id`, `resource_name`, `ip_address`, `result`
- Cap export at 10,000 rows. If the filter matches more, return a header `X-Export-Truncated: true` and the first 10,000 rows.

**What to implement (frontend):**
- Add an "Export" dropdown button in `AuditLogSection.tsx` with options: "Export CSV" and "Export JSON".
- The export uses the currently active filters — if the user has filtered to last 7 days + action=file.downloaded, the export reflects that.
- Show a loading indicator while the export is being generated.

**Definition of done:**
- A filtered audit view can be exported to CSV or JSON.
- The downloaded file is correctly named and formatted.
- Exports over 10,000 events are truncated with a visible warning.

---

### Task 2.3 — Dashboard anomaly summaries

**Files:** `vaultdrive_client/src/pages/dashboard.tsx`, potentially a new `handle_governance.go`

**What to implement:**
- Add `GET /api/v1/governance/summary` — returns a JSON object with:
  - `stale_links` — count of upload links / share links not accessed in 30+ days but still active
  - `stale_agent_keys` — count of agent keys not used in 30+ days but still active
  - `expiring_soon` — count of links expiring in the next 7 days
  - `repeated_access_failures` — count of resources that had 3+ failed access attempts in the last 24h
  - `links_never_used` — count of links created more than 7 days ago with zero opens

**Frontend:** Add a "Governance" card row to `dashboard.tsx` (below the existing stat cards) with:
- Each anomaly type shown as a pill/badge — e.g., "3 stale links", "1 key unused for 30d"
- Each pill is clickable and navigates to the relevant management surface with the appropriate filter pre-applied.
- If all anomaly counts are zero, show a calm "No governance alerts" state with a shield icon.

**Definition of done:**
- Dashboard shows live governance counts.
- Clicking a governance pill navigates to the right surface with filters set.
- Zero-alert state is calm and reassuring, not empty.

---

### Task 2.4 — Retention & governance settings

**Files:** `vaultdrive_client/src/pages/settings.tsx` (or a new Settings tab), `handle_governance.go`, DB migration

**What to implement:**
- Add a new "Governance" tab to the settings page (alongside Security, Notifications, etc.).
- Settings to expose:
  - **Audit log retention period** — dropdown: 30 days / 90 days / 1 year / Forever. Stored per-user in the DB. A background job (or on-demand purge) deletes older audit events based on this setting.
  - **Auto-expire stale links** — toggle + number-of-days input. If enabled, upload links and share links inactive for N days are automatically revoked.
  - **Alert threshold for repeated failures** — number input. How many failed access attempts on a resource before it surfaces in governance summaries. Default 3.
- DB migration to add a `governance_settings` table or add columns to `users`: `audit_retention_days`, `auto_expire_stale_days`, `failure_alert_threshold`.

**Definition of done:**
- Settings are persisted and respected by governance summary and audit export.
- Changing retention period takes effect on next audit export.

---

## 3. Unified Outside Access Center + Vault Search

**Category:** Product
**Why:** Access governance is powerful but fragmented. Shares, file requests, upload routes, agent keys are all individually understandable but not yet unified. This is the biggest visible product leap.

---

### Task 3.1 — Outside Access Center page

**New file:** `vaultdrive_client/src/pages/access-center.tsx`
**New route in `App.tsx`:** `/access-center` inside `<ProtectedRoute>`
**New nav item in `sidebar.tsx`:** "Access Center" with a shield/key icon

**What to render:**
A single owner-facing surface with tabs or a segmented control for:
1. **Share Links** — existing public share tokens (from `GET /api/v1/files/{id}/access-summary` aggregated, or a new `GET /api/v1/shares` list endpoint)
2. **Upload Routes** — existing Secure Drop links (from `GET /api/drop/tokens`)
3. **File Requests** — (from `GET /api/v1/file-requests`)
4. **Agent Keys** — (from `GET /api/v1/agent-keys`)

**Per-item display for each type:**
- Name / label / associated file or folder
- Created date
- Last accessed date (or "Never accessed")
- Expiry date (or "No expiry")
- Status badge: Active / Expired / Revoked / Never Used / Stale (not accessed in 30d)
- Actions: Copy link / Open / Revoke / Edit expiry

**Filtering:**
- Global status filter bar: All / Active / Expired / Revoked / Never Used / Stale
- Filter applies across all tabs simultaneously so the user can see all their stale access at once.
- Date range filter: "Created between..."
- Text search: filters by name, associated file name, or associated folder name.

**Backend work needed:**
- `GET /api/v1/shares` — list all share tokens for the authenticated user, with status, last-accessed, and associated file info. (Currently share token queries exist but are per-file. Need a user-level list.)
- Update `GET /api/drop/tokens` (or a new endpoint) to include `last_upload_at`, `total_uploads`, `never_used` flag.
- Update `GET /api/v1/file-requests` to include `total_responses`, `last_response_at`.

**Definition of done:**
- All external access types are visible in one surface.
- Owner can revoke any access type from this surface.
- Status filters work across all tabs.

---

### Task 3.2 — PostgreSQL-backed vault search

**Files:** `handle_list_files.go`, `sql/queries/files_with_drop_source.sql`, `vaultdrive_client/src/pages/files.tsx`

**Current state:** The README documents `GET /api/v1/files?q=` as a planned foundation but it is not implemented on the backend.

**What to implement (backend):**
- Add `?q=` query parameter to `GET /api/files` (or `/api/v1/files`).
- Search against `files.name` using `ILIKE '%query%'` (good enough for MVP; can add `pg_trgm` GIN index later for performance).
- Search scope: only files owned by the authenticated user (respects existing ownership filter).
- Return the same response shape as the normal file list, so the frontend can use the same rendering code.
- Add a GIN index on `files.name` for trgm similarity search:
  ```sql
  CREATE EXTENSION IF NOT EXISTS pg_trgm;
  CREATE INDEX IF NOT EXISTS idx_files_name_trgm ON files USING gin(name gin_trgm_ops);
  ```
  Put this in a new migration `NNN_files_search_index.sql`.

**What to implement (frontend):**
- Add a search input to the top of `files.tsx` (above the file list, below the toolbar).
- Debounce input by 300ms before firing the API call.
- While searching, show a subtle spinner in the search input.
- If `q` is non-empty, show results across all folders (remove the current folder-filter scope so search is vault-wide).
- Show the matched folder context for each result (e.g., a small breadcrumb: "📁 ABRN Clientes / 2025").
- Empty search state: "No files match '{query}'" with a clear-search button.

**Definition of done:**
- Typing in the search box returns matching files from across the vault within 500ms.
- Clearing the search returns the normal folder view.
- Search results show folder context for each file.

---

## 4. Client Collection Workflow Productization

**Category:** Product
**Why:** Secure Drop and File Requests are the most commercially promising parts. They are strong primitives but not yet repeatable client workflows.

---

### Task 4.1 — Reusable collection templates

**DB migration:** Add `upload_link_templates` table — columns: `id`, `user_id`, `name`, `description`, `default_message`, `checklist_items` (JSONB array of strings), `branding_tag`, `created_at`.

**Backend endpoints:**
- `GET /api/v1/collection-templates` — list owner's templates
- `POST /api/v1/collection-templates` — create
- `PUT /api/v1/collection-templates/{id}` — update
- `DELETE /api/v1/collection-templates/{id}` — delete

**Frontend — Template Manager:**
- New section in the Secure Drop management panel (or a sub-tab in `UploadLinksSection`): "Templates".
- Owner can create a template with: name, client-facing instructions (the current `description` field), a client message template, and a checklist of required document names.
- When creating a new Secure Drop link via `CreateUploadLinkModal.tsx`, add a "Load from template" dropdown that pre-fills the form fields.

**Definition of done:**
- Owner can save a template and reuse it to create new drop links with one click.
- Template list is paginated if > 10 templates.

---

### Task 4.2 — Required-document checklists on the sender page

**Files:** `vaultdrive_client/src/pages/drop-upload.tsx`, `handle_drop.go`

**What to implement:**
- When a drop link is created with a checklist (array of required document names stored in the upload token), the sender page shows a checklist section above the upload area.
- Each checklist item has a checkbox that the sender can tick off as they upload each document.
- Checklist items are purely UI guidance — they do not enforce file names or block upload. They are a cognitive aid.
- After all checklist items are ticked, show a "Checklist complete" confirmation before the final send.
- The checklist items are stored in a new `checklist_items` JSONB column on `upload_tokens`.

**Backend:** Add `checklist_items JSONB` to `upload_tokens` (migration). Include it in the token info response from `GET /api/drop/{token}`.

**Definition of done:**
- Drop links created with a checklist show the checklist to the sender.
- Completing the checklist triggers a calm confirmation UI.

---

### Task 4.3 — Intake analytics

**Files:** `handle_drop.go`, `handle_file_requests.go`, `vaultdrive_client/src/components/upload/UploadLinksSection.tsx`, `vaultdrive_client/src/components/vault/FileRequestsSection.tsx`

**What to implement (backend):**
- Track and expose per-link analytics:
  - `total_opens` — how many times the sender page was loaded (already tracked as `access_count` on upload tokens? Verify and expose)
  - `total_uploads` — how many files were successfully uploaded through this link
  - `last_upload_at` — timestamp of last successful upload
  - `total_file_requests_responses` — for file request links, how many responses received
  - `completed_at` — if the owner manually marks a collection as complete
- Add `POST /api/v1/drop-links/{id}/complete` — owner marks a collection link as complete (sets status, does not revoke).

**What to implement (frontend):**
- In `UploadLinksSection.tsx` per-link card: add a small analytics row — "3 uploads · Last upload 2 days ago · 12 opens".
- In `FileRequestsSection.tsx` per-request card: "2 responses · Last response 5 days ago".
- Add a "Mark complete" button to each link. Completed links show a green "Complete" badge instead of "Active".

**Definition of done:**
- Every collection link shows a real upload count and last activity date.
- Owners can mark collections as complete.

---

## 5. Performance & Shell Scalability

**Category:** Scalability
**Why:** The April 7 session explicitly flagged the bundle as "too big." Premium UX degrades under slow load.

---

### Task 5.1 — Route-level lazy loading

**File:** `vaultdrive_client/src/App.tsx`

**What to implement:**
Convert heavy authenticated pages to dynamic imports:

```tsx
const Settings = lazy(() => import('./pages/settings'))
const Admin = lazy(() => import('./pages/admin'))
const SharedPage = lazy(() => import('./pages/shared'))
const Dashboard = lazy(() => import('./pages/dashboard'))
```

Wrap the router in `<Suspense fallback={<PageSkeleton />}>`.

Create a `PageSkeleton` component that matches the shell chrome (sidebar + header) with animated shimmer content placeholders so the layout shift is minimal.

**Also lazy-load heavy modals:**
- `FilePreviewModal` — already large; load only when a preview is triggered.
- `BulkDownloadModal`
- `CreateUploadLinkModal`

Pattern for modal lazy loading:
```tsx
const FilePreviewModal = lazy(() => import('./components/vault/FilePreviewModal'))
// Render inside Suspense with a spinner fallback
```

**Definition of done:**
- `vite build` no longer shows the main chunk over the size warning threshold.
- Initial authenticated page load is measurably faster (measure with Lighthouse or `vite-bundle-analyzer`).

---

### Task 5.2 — Further manual chunk splitting

**File:** `vaultdrive_client/vite.config.ts`

**What to implement:**
Extend `manualChunks` to split:
- `vendor-crypto` — Web Crypto utilities and any crypto-adjacent libraries
- `vendor-ui` — Radix UI / shadcn components
- `vendor-motion` — Framer Motion (if added) or animation utilities
- `vendor-charts` — any charting library used in dashboard or audit
- `page-admin` — admin page tree
- `page-settings` — settings page tree

Use `vite-bundle-visualizer` to identify the current largest chunks and prioritize splitting them.

**Definition of done:**
- The main chunk is under 500KB gzipped.
- No single chunk is over 1MB uncompressed.
- Build warnings about chunk size are resolved.

---

### Task 5.3 — List scalability (virtual scrolling for large vaults)

**Files:** `vaultdrive_client/src/pages/files.tsx`, `vaultdrive_client/src/components/settings/AuditLogSection.tsx`

**Current problem:** File lists and audit logs render all rows in the DOM. On a vault with hundreds of files or thousands of audit events, this causes jank.

**What to implement:**
- Add virtual scrolling to the file list in `files.tsx` using `@tanstack/react-virtual` (or `react-window`).
  - Row height is fixed (each file row has a known height), making this straightforward.
  - The virtual list renders only the visible rows + an overscan buffer.
- Add pagination or virtual scrolling to `AuditLogSection.tsx` — 100 rows per page with previous/next controls is acceptable as an alternative to virtual scroll for this use case.

**Definition of done:**
- A vault with 500+ files renders without jank.
- Audit log with 1000+ events is usable without browser freeze.

---

### Task 5.4 — SSE and background UI tightening

**Files:** `vaultdrive_client/src/hooks/useSSE.ts` (or equivalent), `vaultdrive_client/src/components/layout/dashboard-layout.tsx`

**What to implement:**
- SSE connection should only be established when the user is authenticated and the tab is visible (`document.visibilityState === 'visible'`).
- Add a `visibilitychange` listener — pause/close SSE when the tab is backgrounded, reconnect when it returns to foreground. This prevents idle tabs from holding open connections indefinitely.
- Add exponential backoff on SSE reconnect (currently if the SSE endpoint returns an error, behavior may be undefined).
- Throttle toast notifications — if 10 drop-upload events arrive within 5 seconds, consolidate them into a single "10 new files uploaded" toast rather than 10 separate toasts.

**Definition of done:**
- Background tabs do not hold open SSE connections.
- SSE reconnects gracefully after network interruption.
- Burst upload events produce one consolidated toast.

---

## 6. Agent Integration Kit

**Category:** Commercialization / Developer ecosystem
**Why:** The API v1 + scoped agent key infrastructure already exists. What is missing is packaging.

---

### Task 6.1 — Webhook / event delivery system

**New files:** `handle_webhooks.go`, DB migration for `webhooks` and `webhook_deliveries` tables

**DB schema:**
```sql
CREATE TABLE webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  secret TEXT NOT NULL,  -- stored hashed; used for HMAC-SHA256 signature
  events TEXT[] NOT NULL, -- e.g. ARRAY['file.uploaded', 'share.created']
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id UUID REFERENCES webhooks(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  response_status INT,
  delivered_at TIMESTAMPTZ,
  next_retry_at TIMESTAMPTZ,
  attempt_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Backend endpoints:**
- `GET /api/v1/webhooks` — list owner's webhooks
- `POST /api/v1/webhooks` — create webhook (body: `{ url, secret, events[] }`)
- `PUT /api/v1/webhooks/{id}` — update
- `DELETE /api/v1/webhooks/{id}` — delete
- `GET /api/v1/webhooks/{id}/deliveries` — delivery log for a specific webhook
- `POST /api/v1/webhooks/{id}/test` — send a test event to the endpoint

**Event types to support:** `file.uploaded`, `file.shared`, `file.downloaded`, `share.created`, `share.revoked`, `drop_link.created`, `drop_link.upload_received`, `file_request.created`, `file_request.response_received`

**Delivery mechanism:**
- After each relevant action in the existing handlers (e.g., after a successful file upload in `handle_drop.go`), look up the owner's active webhooks that include the event type and queue a delivery.
- Delivery: `POST` to the webhook URL with body `{ event, timestamp, data: {...} }` and header `X-ABRN-Signature: sha256={HMAC-SHA256 of body with the stored secret}`.
- Retry policy: 3 attempts with exponential backoff (1m, 5m, 30m). After 3 failures, mark delivery as `failed`.
- Use a goroutine pool or a ticker-based background worker to process the `webhook_deliveries` table.

**Frontend — Webhook settings section:**
- New section in Settings → Advanced (or a new "Integrations" tab): Webhook management.
- Form: URL, secret (generate button), event checkboxes.
- Delivery log table per webhook: timestamp, event type, response status, latency.

**Definition of done:**
- Creating a webhook and triggering a file upload results in an HTTP POST to the configured URL.
- Signature verification works (documented + testable with the test endpoint).
- Failed deliveries are retried and shown in the delivery log.

---

### Task 6.2 — OpenAPI 3.1 specification

**New file:** `openapi.yaml` at project root

**What to implement:**
A complete machine-readable spec for all `/api/v1/` endpoints. Include:
- Auth methods: Bearer JWT and Agent API Key (`X-Agent-Key` header)
- All request/response schemas (derive from existing Go handler structs and sqlc models)
- Error response envelope: `{ error: string, code: string }`
- All existing v1 endpoints: files, shares, agent-keys, audit, file-requests, groups, webhooks (new)
- Parameter descriptions, examples, and required/optional annotations

**Tooling:** Use `swaggo/swag` or hand-author the YAML. If hand-authored, validate with `openapi-generator validate` in CI.

**CI step:** Add a job in `.github/workflows/` that runs `npx @redocly/cli lint openapi.yaml` to catch spec drift.

**Definition of done:**
- `openapi.yaml` passes Redocly lint with zero errors.
- Every `/api/v1/` endpoint is documented.

---

### Task 6.3 — Interactive API documentation

**Files:** `main.go` (new static routes), `openapi.yaml`

**What to implement:**
- Serve Swagger UI at `/api/docs` — embed the Swagger UI static assets in the Go binary using `go:embed` and serve them with the `openapi.yaml` file.
- Serve Redoc at `/api/redoc` as an alternative view.
- Include a "Try It" flow: pre-fill the server URL and provide instructions for using an Agent API Key for auth.
- Add a version badge (`X-API-Version` header on all v1 responses, value from a build-time constant).
- Gate these routes: only accessible when `ABRN_SHOW_API_DOCS=true` env var is set, so they can be disabled in environments where they should not be public.

**Definition of done:**
- Visiting `/api/docs` shows a fully functional Swagger UI.
- Every endpoint can be tried with a valid agent key.

---

### Task 6.4 — SDK snippets & Quick Start guide

**New file:** `docs/api-quickstart.md`

**Content to write:**
1. Overview of the auth model (JWT for interactive, Agent Key for automation)
2. How to create an Agent API Key (with screenshots or cURL)
3. cURL examples for: list files, upload file (multipart), create share link, list share links, revoke share link, create drop link
4. Python (requests) equivalents for the same 6 operations
5. JavaScript (fetch) equivalents
6. Go (net/http) equivalents
7. Rate limiting headers explanation (`X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`)
8. Error handling patterns (401, 403, 429, 5xx)

**Also expose on the frontend:**
- New page `vaultdrive_client/src/pages/developers.tsx` at route `/developers`.
- This is a static page with the quick-start content rendered as a readable guide.
- Linked from the footer and from the Agent API Keys section in Settings.

**Definition of done:**
- A developer who has never seen ABRN Drive can authenticate and list their files using only the quick-start guide.

---

### Task 6.5 — MCP Server

**New directory:** `mcp-server/` at the project root

**What to implement:**
An MCP (Model Context Protocol) tool server that wraps the ABRN Drive API v1.

Tools to expose:
| MCP Tool | Underlying API |
|---|---|
| `list_files` | `GET /api/v1/files` |
| `upload_file` | `POST /api/v1/files` |
| `download_file_metadata` | `GET /api/v1/files/{id}` |
| `create_share_link` | `POST /api/v1/files/{id}/share-link` |
| `list_shares` | `GET /api/v1/shares` |
| `revoke_share` | `DELETE /api/v1/shares/{id}` |
| `create_drop_link` | `POST /api/drop/tokens` |
| `list_drop_links` | `GET /api/drop/tokens` |
| `list_file_requests` | `GET /api/v1/file-requests` |
| `list_groups` | `GET /api/v1/groups` |

**Auth:** Each tool call passes an Agent API Key via an env var or MCP client config (`ABRN_AGENT_KEY`).

**Transport:** Stdio for local use, SSE for remote.

**Language:** Go (can share types with the main server) or TypeScript (using the official MCP SDK for easier distribution).

**Config example for Claude Desktop:**
```json
{
  "mcpServers": {
    "quantix-drive": {
      "command": "abrn-mcp",
      "env": {
        "ABRN_AGENT_KEY": "your-key-here",
        "ABRN_BASE_URL": "https://abrndrive.filemonprime.net"
      }
    }
  }
}
```

**Definition of done:**
- An LLM can list and share ABRN Drive files via Claude Desktop or another MCP client.
- At least 5 tools work end-to-end with a real agent key.

---

## 7. Luxury UI Polish — Steps 2–7

**Category:** Product polish
**Source plan:** `2026-03-23-luxury-ui-and-agent-api-design.md`
**Prerequisite:** Step 1 (design token system) is complete. `luxury-tokens.css` and `motion-presets.ts` exist.

---

### Task 7.1 — Glass Panel Components + Elevated Cards (Step 2)

**New file:** `vaultdrive_client/src/components/ui/GlassPanel.tsx`
**New file:** `vaultdrive_client/src/components/ui/ElevatedCard.tsx`
**Modify:** `vaultdrive_client/src/components/ui/modal.tsx` (or equivalent) — wrap with glass treatment
**Modify:** `vaultdrive_client/src/components/layout/dashboard-layout.tsx`

**`GlassPanel` props:**
```tsx
interface GlassPanelProps {
  children: ReactNode
  blur?: 'sm' | 'md' | 'lg'    // maps to backdrop-blur-(8|16|24)px
  border?: boolean               // subtle 1px rgba white border
  innerGlow?: boolean            // inner box shadow in warm tone
  className?: string
}
```

**`ElevatedCard` props:**
- Layered box-shadow using the luxury token shadow scale
- `whileHover` Framer Motion: `translateY(-2px)` + shadow increase
- `whileTap`: `scale(0.98)` + shadow reduce

**`LuxuryModal`:**
- Replace current modal overlay with `GlassPanel` as the modal content wrapper
- Framer Motion `AnimatePresence` entry: `y: 20, opacity: 0` → `y: 0, opacity: 1` using `spring` preset
- Exit: reverse with shorter duration
- Backdrop: `backdrop-blur(4px)` on the overlay

**Dashboard layout changes:**
- Sidebar: apply `GlassPanel` with `blur="sm"` and `border`
- Main content area: subtle gradient mesh background from luxury token (CSS custom property `--gradient-mesh`)
- Top nav: glass treatment, not solid

**Definition of done:**
- `GlassPanel` and `ElevatedCard` are importable and used in at least 3 existing surfaces.
- The dashboard layout has glass sidebar and gradient mesh background.
- All existing tests still pass after the style changes.

---

### Task 7.2 — Micro-Interactions + State Transitions (Step 3)

**Files:** Spread across button components, file cards, upload components, `App.tsx`

**Button press:**
- Wrap all `<Button>` components with Framer Motion `whileTap: { scale: 0.97 }` and a subtle `boxShadow` reduction.
- Use `spring` preset from `motion-presets.ts` for release bounce.

**Toggle/switch:**
- Replace or wrap existing toggle inputs with Framer Motion spring physics. The knob overshoots slightly on toggle using `type: 'spring', stiffness: 500, damping: 25`.

**File card hover:**
- In the file list rows: on `whileHover`, apply `translateY(-1px)` and a soft warm glow ring (`box-shadow: 0 0 0 2px var(--color-burgundy-200)`).
- Stagger action buttons in on hover using `variants` + `staggerChildren: 0.05`.

**Upload progress:**
- In `drop-upload.tsx` progress bar: replace the current bar with a "liquid fill" animation — the fill uses a shimmer sweep overlay that moves left-to-right using `@keyframes`.

**Page transitions:**
- Wrap `<Routes>` in `<AnimatePresence mode="wait">`.
- Each page component wraps its root element in `<motion.div>` with `variants={{ hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0 } }}`.

**Skeleton loaders:**
- All existing skeleton loaders: replace the plain gray pulse with a warm glass shimmer (`background: linear-gradient(90deg, var(--skeleton-base) 25%, var(--skeleton-shine) 50%, var(--skeleton-base) 75%)`).

**Success/error states:**
- Success action (file shared, link copied): brief particle burst using a simple CSS animation or a lightweight confetti burst (no heavy library needed — 6–8 positioned `<span>` elements with random translate + fade keyframes).
- Error state: gentle horizontal shake (`@keyframes shake: 0%,100%{transform:translateX(0)} 25%{transform:translateX(-4px)} 75%{transform:translateX(4px)}`).

**Definition of done:**
- All primary CTAs have spring press animation.
- Page transitions are smooth crossfades.
- Upload progress has shimmer.
- Tests still pass (Framer Motion animations can be mocked in tests).

---

### Task 7.3 — Dashboard Luxury Treatment (Step 4)

**File:** `vaultdrive_client/src/pages/dashboard.tsx`

**What to implement:**
- **Background:** Apply the gradient mesh CSS from `luxury-tokens.css` to the dashboard page container. The mesh uses 3–4 radial gradients in warm burgundy and neutral tones with a slow `@keyframes` color drift (50s loop, `animation-timing-function: ease-in-out`).
- **Security posture gauge:** Replace or supplement the existing stat cards with a radial SVG gauge that shows a "trust score" composed of: PIN set + active links / total links + audit activity. The arc fills with a Framer Motion `pathLength` animation from 0 to the score value on mount.
- **Stat cards:** Add `useCountUp` hook — on mount, numbers count up from 0 to their actual value over 800ms using `easeOut`.
- **Card entry:** Stagger the 4 stat cards with `staggerChildren: 0.1` so they appear sequentially on page load.
- **Recent files section:** Replace the plain list with `ElevatedCard` rows, each with a color-coded file-type icon (e.g., PDF → red, image → teal, doc → blue).
- **Activity feed:** Replace the "coming soon" state (the `GET /api/activity` endpoint needs to be implemented — see Task 9.1) with a timeline UI using `FileSecurityTimeline` pattern. Each event has an animated dot indicator that pulses once on entry.
- **Attention block:** If there are governance alerts (from Task 2.3), show a warm amber glow card with `pulse` animation on first view (add to page once, using `sessionStorage` to only pulse the first time per session).

**Definition of done:**
- Dashboard has gradient mesh background with color drift.
- Stats animate in with stagger and count-up.
- Security gauge fills on load.

---

### Task 7.4 — Vault Explorer + File Management Polish (Step 5)

**Files:** `vaultdrive_client/src/components/vault/VaultTree.tsx`, `vaultdrive_client/src/components/folders/FolderTree.tsx`, `vaultdrive_client/src/pages/files.tsx`, `vaultdrive_client/src/components/vault/BulkActionBar.tsx`

**What to implement:**
- **Folder tree expand/collapse:** Wrap folder children in Framer Motion `AnimatePresence` + `variants={{ open: { height: 'auto', opacity: 1 }, closed: { height: 0, opacity: 0 } }}` with `overflow: hidden`.
- **Selected item glow:** The active tree item gets `box-shadow: 0 0 0 2px var(--color-burgundy-300), 0 0 12px var(--color-burgundy-200)` with a transition.
- **File list rows:**
  - Glass row on hover: `background: var(--glass-hover-bg)` transition.
  - Checkbox: spring animation on check — the check mark draws in using `pathLength` from 0 to 1.
- **Bulk action bar:** Wrap in Framer Motion `AnimatePresence` with slide-up entry (`y: 40 → y: 0`) and glass background from `luxury-tokens.css`.
- **File preview modal:** Make it edge-to-edge (full-screen on mobile). Add pinch-to-zoom gesture support for images using Framer Motion `drag` constraints.
- **Upload dropzone:** Animated gradient border on drag-over (`@keyframes dash-border` with `stroke-dashoffset` animation on an SVG border). Add particle drop effect when files land (same lightweight particle approach as success state in Task 7.2).
- **Share modal:** Convert to a stepped wizard with Framer Motion progress dots. Step 1: Choose recipient / link type. Step 2: Configure expiry. Step 3: Copy link confirmation.

**Definition of done:**
- Folder expand/collapse is animated.
- Bulk action bar slides in and out.
- File checkboxes have spring animation.

---

### Task 7.5 — Settings, Admin & Secondary Pages Polish (Step 6)

**Files:** `vaultdrive_client/src/pages/settings.tsx`, `vaultdrive_client/src/pages/admin.tsx`, `vaultdrive_client/src/pages/login.tsx`, `vaultdrive_client/src/components/onboarding/OnboardingWizard.tsx`

**Settings:**
- Replace the current tab/section navigation with a pill-style tab indicator. The active tab has a burgundy background that slides smoothly between tabs using `layoutId` in Framer Motion.
- Form inputs: add floating label animation — on focus, the label scales down and moves up. On blur with value, it stays up. Use CSS transitions, not JS.

**Admin table:**
- Glass-row alternating background: even rows get `var(--glass-subtle-bg)`.
- Inline edit mode: when editing a cell, it transitions with a gentle border glow appearance.

**Login page:**
- Full-bleed gradient mesh background (same token as dashboard).
- The login card is centered, uses `GlassPanel` with `blur="lg"` and `innerGlow`.
- Entry animation: card fades in with `y: 20 → y: 0` on page load.

**Onboarding wizard:**
- Replace current step transitions with horizontal slide + fade: steps slide left on advance, right on back.
- Progress indicator: 3 dots that fill with burgundy as steps complete, with spring scale animation on fill.

**Definition of done:**
- Login page uses glass card and gradient mesh.
- Settings tabs slide between sections.
- Onboarding steps slide horizontally.

---

### Task 7.6 — Performance + Bundle Optimization + Final QA (Step 7)

This is largely covered by Phase 5 (Performance & Shell Scalability). Additional luxury-specific items:

- **`prefers-reduced-motion` graceful degradation:** All Framer Motion animations must check `usePrefersReducedMotion()` (already exists from Step 1) and either skip or use instant transitions when the user prefers reduced motion.
- **Glass fallback:** On devices with `@media (prefers-reduced-transparency)` or low GPU, fall back to solid `background-color` instead of `backdrop-blur`. Implement by checking the media query and toggling a `.no-glass` class on `<body>`.
- **Dark mode verification pass:** Go through every new glass component and ensure the `.dark` class variants look correct. Glass in dark mode should intensify (more opacity, deeper blur).
- **Lighthouse audit:** Run Lighthouse against `/dashboard`, `/files`, and `/` (login). Target: Performance ≥ 90, Accessibility = 100.
- **Visual snapshot baselines:** Add Playwright `toHaveScreenshot()` assertions for the dashboard, login page, and file list. Store baselines in `tests/e2e/snapshots/`.

**Definition of done:**
- `prefers-reduced-motion` disables all non-essential animations.
- Glass effects have a solid fallback.
- Lighthouse Performance ≥ 90 on dashboard.
- Visual snapshots exist for 3 key pages.

---

## 8. AI Agent API Platform

**Category:** Commercialization / Developer ecosystem
**Source plan:** `2026-03-23-luxury-ui-and-agent-api-design.md` Plan 2

Note: Tasks 6.2 (OpenAPI spec), 6.3 (interactive docs), 6.4 (SDK snippets), and 6.5 (MCP server) cover the core platform. The items below cover the remaining steps.

---

### Task 8.1 — Rate limiting per agent key + response headers (Step 7, part 1)

**Files:** `middleware_actor.go` (or new `middleware_ratelimit.go`), `handle_v1_core.go`

**What to implement:**
- Per agent-key rate limiting: 100 requests per minute per key (default).
- Store limits in a `sync.Map` keyed by agent key ID. Use `golang.org/x/time/rate`.
- Add response headers to all `/api/v1/` responses:
  - `X-RateLimit-Limit: 100`
  - `X-RateLimit-Remaining: 87` (decremented per request)
  - `X-RateLimit-Reset: 1712700000` (Unix timestamp of next window reset)
- When the limit is exceeded, return `429 Too Many Requests` with a JSON body: `{ "error": "rate limit exceeded", "retry_after": 42 }`.
- Allow per-key limit overrides stored in the `agent_api_keys` table (add a `rate_limit_per_minute INT DEFAULT 100` column).

**Definition of done:**
- 101 requests in 60 seconds from one key returns 429 on the 101st.
- All three rate limit headers are present on every v1 response.

---

### Task 8.2 — API key usage dashboard (Step 7, part 2)

**Files:** `vaultdrive_client/src/components/settings/AgentApiKeysSection.tsx`, `handle_v1_core.go` or new `handle_agent_analytics.go`

**What to implement (backend):**
- Track per-key request counts in a `agent_key_usage` table: `key_id`, `date` (truncated to day), `request_count`, `error_count`.
- Increment atomically on each authenticated v1 request.
- Add `GET /api/v1/agent-keys/{id}/usage?days=30` — returns daily request/error counts for the last N days.

**What to implement (frontend):**
- In `AgentApiKeysSection.tsx`, each key card expands to show a usage sparkline (simple bar or line chart using only CSS or a lightweight SVG implementation — no chart library dependency).
- Show: total requests this month, error rate, last used timestamp.
- If a key has never been used, show "Never used" with a gentle amber tint.

**Definition of done:**
- Each agent key shows daily usage for the last 30 days.
- Error rate is visible per key.

---

### Task 8.3 — Developer landing page (Step 7, part 3)

**New file:** `vaultdrive_client/src/pages/developers.tsx`
**Route:** `/developers` (accessible without auth for discoverability, but shows limited info when not logged in)

**Content:**
- Hero section: "Build on ABRN Drive" with a code snippet showing a `curl` list-files example.
- Three feature blocks: API v1, Agent API Keys, Webhooks — each with a short description and link to the relevant docs.
- "Get Started" CTA: links to Settings → Agent API Keys for authenticated users, or to login for unauthenticated users.
- Link to `/api/docs` (Swagger UI) and `/api/redoc`.
- Footer note: link to `openapi.yaml` for download.

**Definition of done:**
- `/developers` is reachable and renders correctly both authenticated and unauthenticated.
- All links to docs and API references work.

---

## 9. Standalone Known Gaps

These are specific items called out explicitly in existing docs that are not part of a larger plan phase.

---

### Task 9.1 — Implement `GET /api/activity` endpoint

**Source:** `docs/08_UPGRADE_PLAN_V1.md` Known Gaps, section 1.

**Context:** The `activity_log` table and `broadcastToUser` SSE infrastructure already exist. The dashboard calls `GET /api/activity` and gracefully handles the 404 by showing "Activity feed coming soon". This should be implemented.

**What to implement:**
- New handler for `GET /api/activity` in a new file `handle_activity.go` or added to an existing handler file.
- SQL query: `SELECT * FROM activity_log WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`.
- Response: array of activity events with `id`, `event_type`, `resource_type`, `resource_id`, `resource_name`, `actor_email`, `created_at`, `metadata` (JSONB).
- Supports `?limit=` and `?offset=` for pagination (default limit 20).
- Register the route in `main.go`.

**Frontend update (`dashboard.tsx`):**
- Remove the "Activity feed coming soon" fallback.
- Render the actual activity timeline with event icons and relative timestamps.

**Definition of done:**
- `GET /api/activity` returns 200 with the user's recent activity.
- Dashboard activity feed shows real events.

---

### Task 9.2 — Fix the malformed Goose migration

**Source:** `docs/SESSION_MEMORY_2026-04-07-sharing-war-room.md` "Things that still hurt" section 1.

**Context:** There is an older malformed Goose migration in the migration chain. This has required direct SQL workarounds during local development and has the potential to block clean local setup for new contributors.

**What to do:**
1. Identify the malformed migration: `goose -dir sql/schema status` to find which migration fails or is in a bad state.
2. If the migration is already applied in production (i.e., the schema change is correct but the SQL file is syntactically malformed), create a new "repair" migration that is a no-op but correctly signals to Goose that it is applied.
3. If the migration was never correctly applied, fix the SQL and add a `-- +goose Up` / `-- +goose Down` header.
4. Verify `goose -dir sql/schema up` runs cleanly from scratch in a fresh local DB.

**Definition of done:**
- `goose status` shows all migrations as applied with no errors on a fresh local DB.
- No more direct SQL workarounds needed during local setup.

---

### Task 9.3 — Additive-only share sync review + removal policy decision

**Source:** `docs/SESSION_MEMORY_2026-04-07-sharing-war-room.md` "Things that still hurt" section 4.

**Context:** Shared folder links are currently additive. Files added to a shared folder are synced into the existing share link. Files removed or moved out are NOT removed from the share. This is a product choice, not a technical limitation.

**What to decide and implement:**
- **Option A (current behavior — keep):** Document clearly in the UI that "a shared folder link always shows files as of the time the link was last updated." Add a visible "Last synced: [date]" label to shared links. No code change needed beyond the label.
- **Option B (explicit removal):** Add a `revoke file from link` action in the shared-links management panel in Files. Owner can manually deselect files from an existing share. This requires a `DELETE /api/v1/folder-share-links/{id}/files/{file_id}` endpoint and a corresponding removal UI.

**Recommendation:** Implement Option A immediately (just add the label). Then implement Option B as a follow-up in the same PR or the next session. The label prevents user confusion now; explicit removal closes the governance gap later.

**Definition of done:**
- Each shared folder link shows a "Last synced" timestamp.
- (Option B) Owner can remove individual files from a share link.

---

## Execution Order

| Priority | Task | Rationale |
|---|---|---|
| 1 | 1.1 Protected route auth hardening | Immediate security gap |
| 2 | 1.2 SSE bearer token fix | Operational security |
| 3 | 1.3 JWT + refresh tokens | Session security |
| 4 | 1.4 Rate limiting | Brute force protection |
| 5 | 1.5 CI deploy gates | Prevents regressions shipping |
| 6 | 9.2 Fix malformed migration | Unblocks clean local dev |
| 7 | 9.1 Activity endpoint | Removes 404 from dashboard |
| 8 | 2.1 Audit filtering | Governance foundation |
| 9 | 2.2 Audit export | Governance deliverable |
| 10 | 2.3 Anomaly summaries | Dashboard governance card |
| 11 | 3.2 Vault search | High daily-use impact |
| 12 | 3.1 Unified access center | Biggest visible product leap |
| 13 | 5.1 Lazy loading | Bundle size fix |
| 14 | 5.2 Chunk splitting | Bundle size fix |
| 15 | 4.1 Collection templates | Productize drop links |
| 16 | 4.2 Sender checklist | Productize drop links |
| 17 | 4.3 Intake analytics | Collection workflow analytics |
| 18 | 5.3 Virtual scrolling | Large vault scalability |
| 19 | 5.4 SSE tightening | Background tab efficiency |
| 20 | 6.1 Webhooks | Developer ecosystem |
| 21 | 6.2 OpenAPI spec | Developer ecosystem |
| 22 | 6.3 Interactive docs | Developer ecosystem |
| 23 | 6.4 SDK snippets | Developer ecosystem |
| 24 | 6.5 MCP server | Developer ecosystem |
| 25 | 8.1 Per-key rate limiting | API platform |
| 26 | 8.2 Key usage dashboard | API platform |
| 27 | 8.3 Developer page | API platform |
| 28 | 7.1 Glass panel components | UI polish |
| 29 | 7.2 Micro-interactions | UI polish |
| 30 | 7.3 Dashboard luxury | UI polish |
| 31 | 7.4 Vault explorer polish | UI polish |
| 32 | 7.5 Settings/Admin/Login polish | UI polish |
| 33 | 7.6 Performance QA + snapshots | UI polish gate |
| 34 | 2.4 Governance settings | Governance advanced |
| 35 | 9.3 Share sync policy | Product decision |

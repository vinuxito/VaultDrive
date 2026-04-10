# Session Memory — April 10, 2026
## Security Hardening, Governance & Collection Productization

**Branch:** `gnhf/make-sure-we-can-upl-56c5d2`
**Status at close:** All green — 66/66 frontend tests, Go race-clean, zero build warnings

---

## What Was Done

### Security hardening (7 sub-items)
- JWT lifetime: 30 days → **30 minutes**
- Sliding-window rate limiting: login (10/min), PIN (5/min), global (100/min)
- Refresh token flow: `POST /api/auth/refresh` + `POST /api/auth/revoke`
- SSE one-time ticket: `POST /api/events/ticket` → UUID ticket expires in 30s
- Client-side JWT expiry detection in `protected-route.tsx` (checks `exp` claim, 10s buffer)
- SSE hook rewritten to use ticket system + tab visibility API + exponential backoff
- CI gates: `go test -race`, `go vet`, `go build`, `vitest run`, `vite build` on every push

### Audit & governance
- Dynamic audit log filtering with raw SQL (action, resource_type, date range, pagination)
- CSV/JSON export with 10k row cap and `X-Export-Truncated` header
- Security posture endpoint extended with stale agent keys + never-used links
- **Governance settings tab in Settings page** — retention period, auto-expire stale links, failure alert threshold
- `GET/PUT /api/v1/governance/settings` endpoints
- Migration 044: governance columns on `users` table

### Performance
- 8 authenticated pages lazy-loaded via React.lazy + Suspense layout route
- Fixed rollup circular dep: settings components import directly from `hooks/useSSE.ts`
- SSE burst toast: 800ms debounce, N events → single "N new activities" toast

### Product surface
- **Vault search:** `?q=` param on `GET /api/files`, pg_trgm GIN index (migration 041)
- **Access Center page** (`/access-center`): unified view of share links + drop routes, per-status filter bar, copy/open actions
- **Collection templates CRUD** (`/api/v1/collection-templates`): name, description, checklist_items JSONB, branding_tag
- **Drop token intake analytics:** `link_name`, `description`, `last_upload_at` in list response
- **Sender checklist:** drop-upload.tsx renders required document checklist when `checklist_items` exists
- Migration 042: `upload_link_templates` table
- Migration 043: `checklist_items` on `upload_tokens`

### Module rename
- All 41 Go files: `github.com/Pranay0205/VaultDrive` → `github.com/vinuxito/VaultDrive`

---

## Bugs Found & Fixed During Verification

| Bug | Severity | Fix |
|-----|----------|-----|
| Governance update: disabling auto-expire kept old value instead of setting NULL | High | `ELSE NULL` in CASE expression |
| Collection template handlers used manual path parse instead of `r.PathValue("id")` | Medium | Replaced with Go 1.22 `r.PathValue` |
| Dead `retentionDays`/`alertThreshold` scan vars | Low | Replaced with `ExecContext` |
| Circular rollup dep in lazy chunk | Low | Direct import path |

---

## Architecture Notes

- **SSE ticket pattern:** stateless-ish `sync.Map`, 30s TTL, single-use. No DB needed. Auto-cleaned by goroutine.
- **Collection templates vs drop tokens:** templates are reusable blueprints; checklist_items live on both the template AND the actual token (copied at creation time, not referenced).
- **Governance settings:** stored as columns on `users` (not a separate table). Simple, avoids join. COALESCE provides defaults if columns don't exist yet (safe for rolling migrations).
- **Access Center:** reads from two endpoints (`/api/v1/shares` and `/api/drop/tokens`). Status is derived client-side (consistent with how settings page derives PIN state).

---

## Pending / Not Implemented

- **Collection template frontend:** the template manager UI in UploadLinksSection was not built — only the backend. The "Load from template" dropdown in CreateUploadLinkModal is not connected yet.
- **Governance enforcement:** settings are persisted but not yet enforced (no background job pruning audit logs based on `audit_retention_days`; no cron for auto-expiring stale links).
- **File requests analytics** (`last_response_at`, `total_responses`) — `POST /api/v1/drop-links/{id}/complete` not built.
- **Virtual scrolling** for large vaults — not implemented.
- **Webhooks / OpenAPI / MCP server** — developer ecosystem left for a future session.
- **UI polish pass** — glass panels, micro-interactions, luxury dashboard — not touched.

---

## Key File Locations

| File | Description |
|------|-------------|
| `middleware_ratelimit.go` | Sliding window rate limiter (login/PIN/global) |
| `handle_auth_refresh.go` | Refresh + revoke token endpoints |
| `handle_events.go` | SSE ticket issuance + EventSource handler |
| `handle_audit.go` | Dynamic audit filtering + CSV/JSON export |
| `handle_governance.go` | Governance settings GET/PUT |
| `handle_shares.go` | Unified share link list (file + folder) |
| `handle_collection_templates.go` | Collection template CRUD |
| `vaultdrive_client/src/hooks/useSSE.ts` | Rewritten SSE hook with ticket + backoff |
| `vaultdrive_client/src/pages/access-center.tsx` | Access Center page |
| `vaultdrive_client/src/components/layout/dashboard-layout.tsx` | Burst toast consolidation |
| `sql/schema/041_files_search_index.sql` | pg_trgm GIN index |
| `sql/schema/042_collection_templates.sql` | Collection templates table |
| `sql/schema/043_upload_token_checklist.sql` | checklist_items on upload_tokens |
| `sql/schema/044_governance_settings.sql` | Governance columns on users |

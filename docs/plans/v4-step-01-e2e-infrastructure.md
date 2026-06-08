# Step 1 — E2E Infrastructure Restoration

**Parent:** [v4 Production Launch Index](./v4-production-launch-index.md)  
**Phase:** I — Foundation Verified  
**Status:** ✅ DONE  
**Commits:** `3eb90a0`, `28e068e`  
**Date:** 2026-05-23  
**Deployed:** Both platforms verified healthy

---

## Why This Matters

E2E tests are the safety net. Without them, every change is a gamble. The Playwright suite was broken because the `webServer` block was commented out and the API URL was wrong. We can't ship production code without a green E2E bar.

## The Problem

All 42 E2E tests failed with the same error: `404 page not found` at the login page. Every test timed out at the `registerAccount` helper because no backend was running on port 8090.

### Root Causes Found (3)

1. **`webServer` commented out** — `playwright.config.ts` had the entire `webServer` block commented out. Without it, Playwright expected a pre-existing server on `localhost:8090`, but nothing was there.

2. **Wrong API URL** — `.env.test` had `VITE_API_URL="/api"`, but the Go backend mounts all routes under `/quantix/` via `http.StripPrefix`. The SPA's fetch calls to `/api/login` hit `http://127.0.0.1:8090/api/login`, but Go only accepts `/quantix/api/login`.

3. **Stale Docker container** — A Docker container (`quantix-drive_quantix-drive_1`) was occupying port 8090, configured as ABRN Drive with `BASE_PATH=/abrn/`, `PRODUCT_NAME=ABRN Drive`. Not usable for QuantiX E2E.

## What We Did

### 1. Stopped the stale Docker container
```bash
docker stop quantix-drive_quantix-drive_1
```

### 2. Recreated E2E database with fresh schema
```bash
psql "postgres://postgres:postgres@localhost:5432/postgres?sslmode=disable" \
  -c "DROP DATABASE IF EXISTS vaultdrive_playwright"
psql "postgres://postgres:postgres@localhost:5432/postgres?sslmode=disable" \
  -c "CREATE DATABASE vaultdrive_playwright"
go run github.com/pressly/goose/v3/cmd/goose@latest \
  -dir sql/schema postgres \
  "postgres://postgres:postgres@localhost:5432/vaultdrive_playwright?sslmode=disable" up
# Result: 45 migrations applied
```

### 3. Uncommented `webServer` in playwright.config.ts
**File:** `vaultdrive_client/playwright.config.ts` — lines 47-59

The `webServer` block now auto-bootstraps:
1. `npm run build -- --mode test` — builds frontend with `.env.test` vars
2. `cd ..` — moves to project root
3. `mkdir -p "$UPLOAD_DIR"` — creates upload directory
4. Creates `vaultdrive_playwright` database if it doesn't exist
5. `goose up` — runs all pending migrations
6. `go run .` — starts Go backend on port 8090

`reuseExistingServer: !process.env.CI` — in dev, reuses an existing server if one is already running.

### 4. Fixed `.env.test` API URL
**File:** `vaultdrive_client/.env.test` — line 26

```diff
-VITE_API_URL="/api"
+VITE_API_URL="/quantix/api"
```

This matches Go's `StripPrefix` routing: a request to `/quantix/api/login` → strip `/quantix` → `/api/login` → matches the API route handler.

## Verification

| Check | Result |
|-------|--------|
| Port 8090 free | ✅ Docker container stopped |
| E2E database created | ✅ 45 migrations applied |
| Go backend starts on 8090 | ✅ `{"status":"ok"}` at `/quantix/api/healthz` |
| SPA loads at `/quantix/login` | ✅ HTTP 200 |
| Single test: owner trust flow | ✅ Passed in 15.5s |
| **Full suite: 42 tests** | **✅ 42 passed (3.2m)** |
| Production build restored | ✅ `npm run build` — 23 assets, 17.87s |
| QuantiX prod healthy | ✅ healthz 200 |
| ABRN prod healthy | ✅ healthz 200 |

## Files Changed

| File | Change |
|------|--------|
| `vaultdrive_client/playwright.config.ts` | Uncommented `webServer` block |
| `vaultdrive_client/.env.test` | `VITE_API_URL` → `/quantix/api` |

## Evidence

- Commit `3eb90a0`: `chore: verify and close out UX phase — fix test timeouts, document E2E infrastructure gap`
- Commit `28e068e`: `fix(e2e): restore Playwright infrastructure — 42/42 green bar`
- Session memory: `docs/memories/session-2026-05-23-verification-closeout.md`
- Verification report: `docs/reports/2026-05-23-ux-phase-verification.html`

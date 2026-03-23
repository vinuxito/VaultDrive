# Session Memory — March 23, 2026 — Force Password Change + Luxury Design Tokens

## Session Overview

This session covered two parallel tracks: the beginning of a luxury UI polish plan (Step 1 of 7) and a full force-password-change security feature, including a bug fix for admin DELETE user 500 errors.

## Work Completed

### 1. Luxury Design Token System (Plan 1, Step 1)

Laid the design foundation for the luxury fintech UI upgrade:

- **`luxury-tokens.css`** — 280+ lines: burgundy palette (50-900), warm neutrals, glassmorphism tokens, layered shadow system, typography scale, spacing scale, timing tokens, gradient mesh backgrounds, utility classes, reduced motion support
- **`motion-presets.ts`** — Framer Motion presets: springs (gentle/snappy/dramatic/micro), tweens (fast/normal/slow), composite transitions, animation variants, hover/tap states, reduced motion fallbacks
- **`motion-presets.test.ts`** — 6 test cases verifying spring physics, tween durations, variant shapes
- **`usePrefersReducedMotion.ts`** — React hook for `prefers-reduced-motion` media query
- **`index.css`** — Inter font import, luxury token integration, antialiased rendering, heading typography
- **`elegant-complete.css`** — Bridged legacy CSS variables to luxury tokens, fixed dark mode selectors from `@media` to `.dark` class

### 2. Admin DELETE User 500 Fix

- **Root cause**: `group_file_shares.created_by` and `file_versions.created_by` FK references to `users(id)` had no cascade rules
- **Fix**: Migration 036 added `ON DELETE CASCADE` to `group_file_shares` and `ON DELETE SET NULL` to `file_versions`

### 3. Force Password Change Feature (Full Implementation)

Complete admin-to-user security gate:

**Backend (Go):**
- Migration 037: `force_password_change BOOLEAN NOT NULL DEFAULT FALSE`
- 3 new sqlc queries: SetForcePasswordChange, ClearForcePasswordChange, UpdateUserPrivateKeyEncrypted
- `handle_change_password.go` — NEW: validates old password, hashes new, saves re-encrypted private key, clears force flag
- `handle_admin.go` — forcePasswordChangeHandler (with self-guard), auto-flag on admin password reset (with error handling), force_password_change in user list response
- `middleware_auth.go` — force gate blocks all endpoints except change-password (using const path)
- `main.go` — 2 new route registrations
- `handle_login.go` — `force_password_change` field in login response

**Frontend (React/TypeScript):**
- `force-password-change.tsx` — NEW: full-screen gate page, no escape, ABRN branded, private key re-encryption, SessionVault initialization
- `login.tsx` — stores force flag in localStorage, redirects to gate page before vault key loading
- `protected-route.tsx` — checks force flag, redirects if set
- `App.tsx` — route registration outside ProtectedRoute
- `admin.tsx` — ShieldAlert force button per user, confirmation dialog, disabled when already flagged
- `crypto.ts` — NEW: `encryptPrivateKeyWithPassword()` mirrors Go's encryption format

### 4. Code Review Fixes

Two automated code reviews identified and resolved:
- Admin self-flag prevention (backend)
- Const path for middleware gate
- Silent error discard on auto-flag after password reset
- Private key re-encryption (was missing entirely)
- SessionVault initialization after forced password change

## Key Decisions

- **Private key re-encryption**: Done client-side to maintain zero-knowledge model. If decryption fails (admin reset password differently), change still succeeds — user needs to re-enroll keys separately
- **Force page outside ProtectedRoute**: Necessary because ProtectedRoute wraps DashboardLayout, and the force page must be a standalone full-screen gate
- **localStorage flag is UX only**: Backend middleware is the authoritative gate. Frontend flag can be tampered with via DevTools but backend blocks all API calls regardless
- **PIN login + force change**: User must know the current password (set by admin) to change it. PIN login redirects to force page too, but user enters the admin-set password, not their PIN

## Build State at Session End

| Check | Result |
|-------|--------|
| `go build ./...` | CLEAN |
| `go vet ./...` | CLEAN |
| `tsc --noEmit` | CLEAN |
| `npx vite build` | SUCCESS |
| `npx vitest run` | 10 files, 27 tests PASS |

## Remaining Work

### Plan 1: Luxury UI Polish (Steps 2-7 not started)
2. Glassmorphic card components
3. Typography and hierarchy
4. Motion system integration (Framer Motion presets ready)
5. Navigation redesign
6. Color system rollout
7. Final polish and QA

### Plan 2: AI Agent API (Not started)
7-step plan documented in `docs/plans/2026-03-23-luxury-ui-and-agent-api-design.md`

### Known Risks
- Vite chunk size warning (~646 kB main bundle) — code splitting recommended
- No E2E test for the force password change flow yet
- Rate limiting not implemented on change-password endpoint

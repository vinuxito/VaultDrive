# Session: Production Polish — Theme & Dark Mode Sweep

**Date:** 2026-05-22 → 2026-05-23  
**Scope:** Full dark theme audit, WCAG contrast fixes, glass token completeness, .env production fix  
**Status:** ✅ Complete

---

## What Was Wrong

### 1. QuantiX-Drive wouldn't load in production
The `.env.production` file had **ABRN-Drive** values (`VITE_BASE_PATH=/abrn/`, `VITE_API_URL=.../abrn/api`).  
Assets loaded from `/abrn/assets/` instead of `/quantix/assets/` → blank page with MIME errors.

**Fix:** Corrected `.env.production` to use `/quantix/` paths. Rebuilt. Service restarted.

### 2. Dark theme muted text was unreadable
The `Dark` skin had `--muted-foreground: 220 9% 46%` — a **2.59:1** contrast ratio on cards (fails WCAG AA 4.5:1).  
All other skins passed.

**Fix:** Bumped to `220 12% 65%` → **4.91:1** on cards, **6.04:1** on background. Passes WCAG AA.

### 3. Hardcoded light-mode Tailwind classes across 12 files
Components used `bg-emerald-100`, `text-emerald-700`, `bg-white`, etc. without `dark:` variants.  
Result: bright white/pastel badges, cards, and text on dark backgrounds.

**Files fixed:**
| File | What |
|------|------|
| `TrustRail.tsx` | `statePill()` — 4 badge color sets |
| `AccessPanel.tsx` | `stateClasses()` — 3 badge color sets |
| `dashboard.tsx` | `statCards` — 3 icon bg + text colors |
| `access-center.tsx` | `STATUS_BADGE` map — 4 status badges + filter buttons + share card icon |
| `AuditLogSection.tsx` | `actionTone()` — 2 badge color sets |
| `CreateShareLinkModal.tsx` | Receipt text emerald-800/700 |
| `CreateFolderShareLinkModal.tsx` | Receipt text emerald-800/700 |
| `FileRequestsSection.tsx` | Receipt text emerald-900/800 |
| `drop-upload.tsx` | 9 separate issues: bg-white, bg-emerald-50, focus:bg-white, receipt text |
| `login.tsx` | Register password input inconsistent styling |
| `skins.css` | Missing glass tokens in Light, Dark, Business skins |

### 4. Glass tokens incomplete in 3 skins
Light, Dark, and Business skins only had `--glass-bg` and `--glass-border`.  
Components referencing `--glass-bg-hover`, `--glass-bg-heavy`, `--glass-bg-subtle`, `--glass-border-strong`, etc. got `undefined`.

**Fix:** Added all 8 missing tokens to each skin with values tuned to their color palette.

---

## Pattern for Future Theme Work

When adding colored badges/pills, ALWAYS use this pattern:

```tsx
// ❌ Bad — invisible on dark themes
"bg-emerald-100 text-emerald-700 border-emerald-200"

// ✅ Good — works on all themes  
"bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800"

// ✅ Also good — opacity-based (dark-safe without dark: variant)
"bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
```

For card backgrounds:
```tsx
// ❌ Bad
"bg-white" or "bg-white/80"

// ✅ Good  
"bg-card" or "bg-card/80" or "bg-background"
```

For focus states:
```tsx
// ❌ Bad
"focus:bg-white"

// ✅ Good
"focus:bg-background"
```

---

## How to Prevent DB Port Conflicts

See `docs/ops/database-port-safety.md` for the full runbook.  
TL;DR: Both ABRN and QuantiX use `localhost:5433` (system Postgres). Docker exposes `5432`.  
Never use `5432` in production env files.

---

## Verification

- Contrast ratios verified via Python script for all 6 skins
- All files compile without TypeScript errors
- Production build succeeds: `✓ built in ~30s`
- Service restarts cleanly: `Server listening on port 8083`
- Login page returns `200` with correct asset paths (`/quantix/assets/...`)
- JS serves with correct MIME type `text/javascript; charset=utf-8`

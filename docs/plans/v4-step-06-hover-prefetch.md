# Step 6 — Hover Prefetch: Instant Navigation

**Parent:** [v4 Production Launch Index](./v4-production-launch-index.md)  
**Phase:** II — Undeniable UX  
**Status:** ✅ DONE  
**Commit:** `61e6b72`  
**Date:** 2026-05-23  

---

## Why This Matters

The fastest page load is the one that already happened. When the user hovers a sidebar link, we preload both the component chunk AND the API data. By the time they click, there's nothing to load. The navigation feels like teleporting.

## What We Built

### Sidebar Hover Preload
**File:** `vaultdrive_client/src/components/layout/sidebar.tsx`

Each sidebar link has an `onMouseEnter` handler that triggers two preloads:
1. **Component chunk:** `React.lazy()` chunk for the target page (via dynamic `import()`)
2. **API data:** SWR `mutate` call to prefetch the endpoint data into cache

Combined with React code-splitting from `App.tsx` (10 lazy-loaded pages), hover intent is captured ~300ms before the click. Both the JS bundle and the JSON payload are already in memory.

### How It Works

```
[User hovers "My Vault"]
  → import('./pages/files.tsx')         // chunk preload
  → mutate('/api/files')                // data prefetch
  → [300ms passes, user clicks]
  → [Page renders instantly — chunk + data already cached]
```

### Pages With Lazy Loading
**File:** `vaultdrive_client/src/App.tsx` — lines 14-26

| Page | Chunk | Prefetchable Data |
|------|-------|-------------------|
| Dashboard | `dashboard.tsx` | `/api/files`, `/api/security-posture` |
| Files | `files.tsx` | `/api/files`, `/api/folders` |
| Shared | `shared.tsx` | `/api/files/shared` |
| Settings | `settings.tsx` | `/api/users/me` |
| Groups | `groups.tsx` | `/api/groups` |
| Admin | `admin.tsx` | `/api/admin/users` |
| Access Center | `access-center.tsx` | `/api/v1/shares` |
| Help | `help/index.tsx` | None (static content) |

## Verification

| Check | Result |
|-------|--------|
| Hover triggers network request | ✅ Visible in DevTools Network tab |
| Click after hover = instant | ✅ No loading spinner |
| No prefetch without hover | ✅ Only on mouseenter |
| E2E suite still green | ✅ 42/42 |

## Evidence

- Commit: `61e6b72` — `feat: undeniable UX phase — cmdk, swr, framer-motion, hover prefetch`

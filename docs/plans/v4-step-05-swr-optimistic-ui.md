# Step 5 — SWR Optimistic UI

**Parent:** [v4 Production Launch Index](./v4-production-launch-index.md)  
**Phase:** II — Undeniable UX  
**Status:** ✅ DONE  
**Commit:** `61e6b72`  
**Date:** 2026-05-23  

---

## Why This Matters

When a user stars a file, they shouldn't wait 200ms for the server to respond before seeing the star change. Optimistic UI updates the screen instantly, then reconciles with the server in the background. The app feels zero-latency. This is what separates "it works" from "it's fast."

## What We Built

### SWR Global Configuration
**File:** `vaultdrive_client/src/main.tsx`

```tsx
<SWRConfig value={{
  fetcher: (url) => fetch(url, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
  revalidateOnFocus: true,
}}>
```

Auto-injects auth token into every SWR fetch. Revalidates stale data when the user switches back to the tab.

### File List with SWR
**File:** `vaultdrive_client/src/pages/files.tsx` — line 232

```tsx
const { data: myFiles, mutate: mutateMyFiles } = useSWR<FileData[]>(
  `${API_URL}/files`,
  { onError: (err) => { if (err.status === 401) navigate('/login'); } }
);
```

### Optimistic Star Toggle
**File:** `vaultdrive_client/src/pages/files.tsx` — lines 671-687

When the user clicks the star:
1. **Immediately** update the local SWR cache (`mutate` with new data)
2. **In background** send the API request
3. **On success** revalidate to sync with server truth
4. **On failure** roll back the optimistic update

The user sees the star change in <16ms (one frame).

### Test Setup
**File:** `vaultdrive_client/src/vitest.setup.ts`

SWR cache is cleared between tests to prevent cross-test contamination:
```tsx
beforeEach(() => { cache.clear(); });
```

`MotionGlobalConfig.skipAnimations = true` prevents framer-motion from causing test timeouts.

## Current SWR Coverage

| Endpoint | SWR? | Notes |
|----------|------|-------|
| `/api/files` | ✅ | Full optimistic UI |
| `/api/files/shared` | ❌ | Manual fetch — Step 9 |
| `/api/folders` | ❌ | Manual fetch — Step 9 |
| `/api/drop/tokens` | ❌ | Manual fetch — Step 9 |
| `/api/groups` | ❌ | Manual fetch — Step 9 |
| `/api/file-requests` | ❌ | Manual fetch — Step 9 |
| `/api/activity` | ❌ | Manual fetch — Step 9 |

## Verification

| Check | Result |
|-------|--------|
| File list loads via SWR | ✅ |
| Star toggle is instant | ✅ Optimistic update |
| 401 redirects to login | ✅ |
| Tab focus revalidates | ✅ |
| Tests clear SWR cache | ✅ |
| E2E suite still green | ✅ 42/42 |

## Evidence

- Commit: `61e6b72` — `feat: undeniable UX phase — cmdk, swr, framer-motion, hover prefetch`

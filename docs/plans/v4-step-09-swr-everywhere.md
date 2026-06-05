# Step 9 — SWR Everywhere

**Parent:** [v4 Production Launch Index](./v4-production-launch-index.md)  
**Phase:** III — Production Polish  
**Status:** 🔲 TODO  
**Priority:** HIGH — Foundation for instant UI  

---

## Why This Matters

Step 5 gave us SWR for `/api/files`. The rest of the app still uses manual `useState` + `useEffect` + `fetch`. That means: no caching, no revalidation, no optimistic updates, no prefetching. Every page load re-fetches everything. Every tab switch re-fetches everything. The app feels fast for files but normal everywhere else.

## Current SWR Coverage

| Endpoint | SWR? | Used By |
|----------|------|---------|
| `GET /api/files` | ✅ | Files page |
| `GET /api/files/shared` | ❌ | Shared page |
| `GET /api/folders` | ❌ | Files page (folder sidebar) |
| `GET /api/drop/tokens` | ❌ | Files page (upload links) |
| `GET /api/groups` | ❌ | Groups page |
| `GET /api/groups/:id` | ❌ | Group detail page |
| `GET /api/file-requests` | ❌ | File requests section |
| `GET /api/activity` | ❌ | Dashboard activity feed |
| `GET /api/security-posture` | ❌ | Dashboard security widget |
| `GET /api/v1/shares` | ❌ | Access center |
| `GET /api/admin/users` | ❌ | Admin page |
| `GET /api/users/me` | ❌ | Profile/Settings |

## Implementation Plan

### 1. Create Custom Hooks Directory

**New directory:** `vaultdrive_client/src/hooks/`

Each hook follows the same pattern:

```tsx
// src/hooks/useSharedFiles.ts
import useSWR from 'swr';
import { API_URL } from '../utils/api';
import { useNavigate } from 'react-router-dom';

export function useSharedFiles() {
  const navigate = useNavigate();
  return useSWR<SharedFileData[]>(`${API_URL}/files/shared`, {
    onError: (err) => {
      if (err.status === 401) navigate('/login');
    },
  });
}
```

### 2. Hooks to Create

| Hook | Endpoint | File |
|------|----------|------|
| `useSharedFiles()` | `/api/files/shared` | `src/hooks/useSharedFiles.ts` |
| `useFolders()` | `/api/folders` | `src/hooks/useFolders.ts` |
| `useDropTokens()` | `/api/drop/tokens` | `src/hooks/useDropTokens.ts` |
| `useGroups()` | `/api/groups` | `src/hooks/useGroups.ts` |
| `useGroup(id)` | `/api/groups/:id` | `src/hooks/useGroup.ts` |
| `useFileRequests()` | `/api/file-requests` | `src/hooks/useFileRequests.ts` |
| `useActivity()` | `/api/activity` | `src/hooks/useActivity.ts` |
| `useSecurityPosture()` | `/api/security-posture` | `src/hooks/useSecurityPosture.ts` |
| `useShares()` | `/api/v1/shares` | `src/hooks/useShares.ts` |
| `useAdminUsers()` | `/api/admin/users` | `src/hooks/useAdminUsers.ts` |
| `useCurrentUser()` | `/api/users/me` | `src/hooks/useCurrentUser.ts` |

### 3. Refactor Pages

For each page, replace the manual fetch pattern:

```tsx
// BEFORE (manual)
const [sharedFiles, setSharedFiles] = useState<SharedFileData[]>([]);
const [loading, setLoading] = useState(true);
useEffect(() => {
  fetch(`${API_URL}/files/shared`, { headers: { Authorization: `Bearer ${token}` } })
    .then(r => r.json())
    .then(setSharedFiles)
    .finally(() => setLoading(false));
}, []);

// AFTER (SWR)
const { data: sharedFiles, isLoading, mutate } = useSharedFiles();
```

### 4. Add Optimistic Updates

For mutation endpoints (create folder, delete file, revoke share), add optimistic updates:

```tsx
async function createFolder(name: string) {
  // Optimistic update
  await mutate(
    (prev) => [...prev, { id: 'temp', name, created_at: new Date() }],
    false
  );
  // Server request
  await fetch(`${API_URL}/folders`, { method: 'POST', body: JSON.stringify({ name }) });
  // Revalidate
  mutate();
}
```

### 5. Update Hover Prefetch

With all endpoints using SWR, the sidebar hover preload becomes more powerful:

```tsx
onMouseEnter={() => {
  // Prefetch chunk
  import('../pages/shared');
  // Prefetch data
  mutate(`${API_URL}/files/shared`);
}}
```

## Verification

| Check | Expected Result |
|-------|----------------|
| Every authenticated page uses SWR | ✅ No manual `useState+fetch` for GET endpoints |
| Tab focus revalidates all pages | ✅ Data stays fresh |
| Optimistic updates on mutations | ✅ Instant UI feedback |
| 401 redirects work everywhere | ✅ Consistent auth handling |
| No manual `fetch()` for authenticated GETs | ✅ Grep returns 0 results |
| E2E suite still green | ✅ 42+ |

## Files to Change

| File | Change |
|------|--------|
| `src/hooks/` (new directory) | 11 new hook files |
| `src/pages/shared.tsx` | Replace manual fetch with `useSharedFiles()` |
| `src/pages/files.tsx` | Replace folders/dropTokens manual fetch with hooks |
| `src/pages/dashboard.tsx` | Replace activity/security-posture manual fetch |
| `src/pages/access-center.tsx` | Replace shares manual fetch |
| `src/pages/groups.tsx` | Replace groups manual fetch |
| `src/pages/settings.tsx` | Replace user profile manual fetch |
| `src/pages/admin.tsx` | Replace admin users manual fetch |

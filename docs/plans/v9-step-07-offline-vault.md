# v9 — Step 7: Offline Vault Mode
> **Operation Go Live** | Step 7 of 7
> **Index**: [v9-go-live-index.md](./v9-go-live-index.md)
> **Estimated Time**: ~3 hours
> **Priority**: 🟡 Medium — Critical differentiator for field-use and air-gapped scenarios

---

## Problem Statement

The previous plan deferred offline-first as "too complex with zero-knowledge encryption." It conflated two very different things:

- **Offline writes** (creating shares, uploading, editing) = truly complex, deferred correctly.
- **Offline reads** (browsing the file list + downloading already-fetched files) = doable with a service worker and a simple cache strategy.

**What we build:** A read-only offline mode.
- The file metadata list is cached in the service worker cache after each successful SWR fetch.
- Files that the user has previously previewed (Step 4) are stored as **decrypted blobs** in IndexedDB.
- When the network is offline, the service worker serves the cached metadata list and the stored blobs.
- The UI shows a clear "Offline Mode" banner.

**What we do NOT build (still correctly deferred):**
- Offline uploads
- Offline sharing
- Offline PIN key changes
- Conflict resolution

---

## Architecture

```
Online session:
  SWR fetches /api/files → service worker intercepts → caches response in Cache API

Preview request (Step 4 integration):
  User previews a file → decrypted blob is stored in IndexedDB under file ID

Offline session:
  SWR tries /api/files → network fails → service worker returns cached response
  User opens a previously viewed file → served from IndexedDB blob
  UI shows "📴 Offline Mode" banner
```

---

## Exact Files to Create/Modify

### NEW: `vaultdrive_client/src/workers/vault.sw.ts` (Service Worker)

This is the service worker that handles the offline cache. It uses the standard **Cache API + network-first strategy** for API responses:

```typescript
/// <reference lib="webworker" />

const CACHE_NAME = "vaultdrive-offline-v1";
const API_CACHE_ROUTES = ["/api/files", "/api/files/shared", "/healthz"];

self.addEventListener("install", () => {
  (self as ServiceWorkerGlobalScope).skipWaiting();
});

self.addEventListener("activate", (event) => {
  (event as ExtendableEvent).waitUntil(
    (self as ServiceWorkerGlobalScope).clients.claim()
  );
});

self.addEventListener("fetch", (event) => {
  const fetchEvent = event as FetchEvent;
  const url = new URL(fetchEvent.request.url);

  // Only intercept GET requests to API cache routes
  const shouldCache = API_CACHE_ROUTES.some((route) =>
    url.pathname.startsWith(route)
  );

  if (!shouldCache) return;

  fetchEvent.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      try {
        // Network first — try to get fresh data
        const networkResponse = await fetch(fetchEvent.request);
        if (networkResponse.ok) {
          // Cache a clone of the response
          cache.put(fetchEvent.request, networkResponse.clone());
        }
        return networkResponse;
      } catch {
        // Network failed — serve from cache
        const cached = await cache.match(fetchEvent.request);
        if (cached) return cached;
        // Nothing cached either — return an offline response
        return new Response(
          JSON.stringify({ error: "offline", cached: false }),
          {
            status: 503,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
    })()
  );
});
```

---

### NEW: `vaultdrive_client/src/hooks/useOfflineVault.ts`

Handles:
1. Service worker registration
2. Network status detection
3. IndexedDB caching of decrypted file blobs (called from `InlinePreview.tsx` after successful decrypt)
4. Reading cached blobs back when offline

```typescript
import { useEffect, useState, useCallback } from "react";

const DB_NAME = "vaultdrive-offline-db";
const STORE_NAME = "decrypted-blobs";
const DB_VERSION = 1;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function cacheDecryptedBlob(
  fileId: string,
  filename: string,
  buffer: ArrayBuffer
): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, "readwrite");
  const store = tx.objectStore(STORE_NAME);
  store.put({ buffer, filename, cachedAt: Date.now() }, fileId);
  return new Promise((res, rej) => {
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
}

export async function getOfflineCachedBlob(
  fileId: string
): Promise<{ buffer: ArrayBuffer; filename: string } | null> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, "readonly");
  const store = tx.objectStore(STORE_NAME);
  return new Promise((resolve) => {
    const req = store.get(fileId);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => resolve(null);
  });
}

export async function listCachedFileIds(): Promise<string[]> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, "readonly");
  const store = tx.objectStore(STORE_NAME);
  return new Promise((resolve) => {
    const req = store.getAllKeys();
    req.onsuccess = () => resolve(req.result as string[]);
    req.onerror = () => resolve([]);
  });
}

export async function clearOfflineCache(): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, "readwrite");
  tx.objectStore(STORE_NAME).clear();
}

/** React hook — registers service worker and tracks online/offline state */
export function useOfflineVault() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [swRegistered, setSwRegistered] = useState(false);

  useEffect(() => {
    // Register service worker
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/vault.sw.js", { scope: "/" })
        .then(() => setSwRegistered(true))
        .catch(console.error);
    }

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return { isOnline, swRegistered };
}
```

---

### MODIFY: `vaultdrive_client/src/App.tsx`

Register the offline vault hook at the root level and surface the offline banner:

```tsx
import { useOfflineVault } from "./hooks/useOfflineVault";
import { WifiOff } from "lucide-react";

// Inside App():
const { isOnline } = useOfflineVault();

// In JSX, above <CommandPalette />:
{!isOnline && (
  <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 flex items-center gap-2 rounded-xl border border-yellow-500/30 bg-card px-4 py-2 text-xs text-yellow-400 shadow-xl">
    <WifiOff className="h-3.5 w-3.5" />
    Offline Mode — browsing cached data only
  </div>
)}
```

---

### MODIFY: `vaultdrive_client/src/components/files/InlinePreview.tsx`

After successful decryption, cache the blob:

```typescript
import { cacheDecryptedBlob } from "../../hooks/useOfflineVault";

// In the worker.onmessage handler, after setting state to "ready":
cacheDecryptedBlob(fileId, filename, buffer).catch(console.error);
```

---

### Build integration: `vite.config.ts`

Ensure the service worker is bundled as a separate entry:

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  worker: {
    format: "es",
  },
  build: {
    rollupOptions: {
      input: {
        main: "./index.html",
        "vault.sw": "./src/workers/vault.sw.ts",
      },
      output: {
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name === "vault.sw") return "vault.sw.js";
          return "assets/[name]-[hash].js";
        },
      },
    },
  },
});
```

---

## Verification Checklist

- [ ] `npm run build` green with new service worker entry.
- [ ] In DevTools → Application → Service Workers → `vault.sw.js` is registered.
- [ ] Visit `/files` while online → check Cache API in DevTools → `/api/files` response is cached.
- [ ] Preview a file → check IndexedDB in DevTools → blob is stored under file ID.
- [ ] Toggle DevTools → Network → "Offline" → refresh page → file list still loads from cache.
- [ ] In offline mode, clicking "Preview" on a previously viewed file → opens from IndexedDB.
- [ ] "📴 Offline Mode" banner appears at the bottom when offline.
- [ ] Go back online → banner disappears → fresh data loads.
- [ ] Upload button and Share button are disabled (or show warning) when offline.

---

## Commit Message

```
feat(v9/step-7): add offline vault read mode via service worker cache + IndexedDB blob store
```

---

## 🏁 End of v9 Plan

When all 7 steps are committed, write a session memory at:
`docs/memories/SESSION_MEMORY_v9-go-live-2026-07-10.md`

Include:
- What was built in each step
- Build/test pass results
- Known limitations
- Proposed v10 targets

*← [v9-step-06-zk-signatures.md](./v9-step-06-zk-signatures.md) | Back to [v9-go-live-index.md](./v9-go-live-index.md)*

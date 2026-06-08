# Step 14 — Bundle Diet v2: Below 300KB

**Parent:** [v4 Production Launch Index](./v4-production-launch-index.md)  
**Phase:** V — Performance & Lighthouse  
**Status:** 🔲 TODO  
**Priority:** MEDIUM — Performance perception  

---

## Why This Matters

The main JS chunk is 468 KB (143 KB gzip). For a Lighthouse Performance score ≥ 90, we need to get it below 300 KB gzip total. Every KB of JavaScript is parse time on mobile devices. A 3G connection in Mexico City takes 2+ seconds just to download the main chunk.

## Current Bundle Analysis

| Chunk | Size | Gzip | Contents |
|-------|------|------|----------|
| `index-*.js` | 468 KB | 143 KB | React, Router, SWR, i18n, all shared components |
| `files-*.js` | 197 KB | 46 KB | Files page (2452 lines!) |
| `motion-*.js` | 125 KB | 41 KB | Framer Motion |
| `radix-*.js` | 103 KB | 30 KB | Radix UI primitives |
| **Total** | **893 KB** | **260 KB** | |

## Strategies

### 1. Split `files.tsx` (Highest Impact)

`files.tsx` is 2452 lines — an entire application in one file. Split into focused components:

| New File | Extracted From | Approximate Size |
|----------|---------------|-----------------|
| `src/components/vault/FileGrid.tsx` | Grid/list view rendering | ~400 lines |
| `src/components/vault/FileActions.tsx` | Context menus, bulk actions | ~300 lines |
| `src/components/vault/FolderSidebar.tsx` | Folder tree sidebar | ~200 lines |
| `src/components/vault/UploadZone.tsx` | Drag-and-drop upload area | ~250 lines |
| `src/components/vault/FileSearch.tsx` | Search and filter controls | ~150 lines |
| `src/pages/files.tsx` | Orchestration only | ~500 lines |

### 2. Lazy-Load i18n Namespaces

Currently all translation JSONs are bundled upfront. Load them on demand:

```tsx
// i18n config
i18n.init({
  partialBundledLanguages: true,
  ns: ['common'], // Only load common namespace upfront
  // help, admin, vault loaded on demand
});
```

### 3. Dynamic Import Framer Motion

Only load `framer-motion` on pages that actually animate:

```tsx
// Instead of: import { motion, AnimatePresence } from 'framer-motion';
const motion = lazy(() => import('framer-motion').then(m => ({ default: m.motion.div })));
```

Or accept the 41KB gzip cost since animations are core UX.

### 4. Web Worker for Crypto

Move `hash-wasm` (Argon2id) to a web worker:

```tsx
// src/workers/crypto.worker.ts
self.onmessage = async (e) => {
  const { argon2id } = await import('hash-wasm');
  const result = await argon2id({ password: e.data.password, ... });
  self.postMessage(result);
};
```

This removes `hash-wasm` from the main bundle entirely.

### 5. Tree-Shake Radix

Only import used Radix components:
```tsx
// Before (barrel import)
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';

// After (direct import)
import { Root, Trigger, Content } from '@radix-ui/react-dropdown-menu';
```

### 6. Analyze with Visualizer

```bash
npx vite-bundle-visualizer
# Opens interactive treemap showing exact chunk composition
```

## Target

| Chunk | Current | Target |
|-------|---------|--------|
| `index-*.js` | 143 KB gzip | < 100 KB gzip |
| `files-*.js` | 46 KB gzip | < 30 KB gzip (after split) |
| `motion-*.js` | 41 KB gzip | 41 KB (accept or lazy) |
| `radix-*.js` | 30 KB gzip | < 25 KB gzip |
| **Total** | **260 KB gzip** | **< 200 KB gzip** |

## Verification

| Check | Expected Result |
|-------|----------------|
| `npm run build` output | Main chunk < 300 KB raw |
| `npx vite-bundle-visualizer` | No unexpected large dependencies |
| Lighthouse Performance | ≥ 90 on mobile |
| All pages still load | ✅ No broken lazy imports |
| E2E suite still green | ✅ 42+ |

## Files to Change

| File | Change |
|------|--------|
| `src/pages/files.tsx` | Split into 5-6 focused components |
| `src/i18n/index.ts` | Lazy namespace loading |
| `src/utils/crypto.ts` | Move Argon2id to web worker |
| `vite.config.ts` | Optimize chunking strategy |

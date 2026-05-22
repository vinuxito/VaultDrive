# Step 8 — Bundle Diet & Lighthouse 95+

**Parent:** [Hackathon Index](./2026-05-22-hackathon-index.md)  
**Priority:** 🟡 High  
**Effort:** M (1 day)  
**Status:** 🔲 TODO

---

## Why This Matters

The main JavaScript chunk is **533 KB** (160 KB gzip). That's over Vite/Rollup's warning threshold of 500 KB. On conference WiFi, this means a multi-second initial load. A judge who waits 4 seconds for the landing page has already judged you.

More importantly, a **Lighthouse 95+ score** is a visual trophy you can show during the demo. It's proof the product isn't just pretty — it's *fast*.

---

## Current Bundle State (Verified 2026-05-22)

```
dist/assets/index-CXklvKXc.js   533.58 kB │ gzip: 160.18 kB  ← 🎯 TARGET
dist/assets/files-Btdc7wQQ.js   193.96 kB │ gzip:  45.10 kB
dist/assets/motion-Dsp8GjAY.js  124.69 kB │ gzip:  41.04 kB
dist/assets/radix-BF_Ss0e6.js   103.32 kB │ gzip:  29.91 kB
dist/assets/vendor-Bk_lHfc-.js   44.82 kB │ gzip:  16.15 kB
dist/assets/index-M7saCmEz.css  118.21 kB │ gzip:  20.56 kB
```

**Suspects for main chunk bloat:**
- `lucide-react` — likely barrel-importing all icons into the main bundle
- `i18next` ecosystem — full locale bundles may be embedded
- `react-router-dom` — necessary but could be in a vendor chunk
- Radix primitives — some may be importable individually

---

## Success Condition

After this step:
1. Main chunk is **under 400 KB** (target: ≤120 KB gzip)
2. A **bundle visualization report** is saved to `docs/reports/`
3. **Lighthouse performance score** is **95+** on the landing page
4. No new runtime errors, visual regressions, or test failures
5. The build output is clean (no Vite warnings about chunk size)

---

## Implementation Plan

### 8.1 — Bundle Visualization

**Install:**
```bash
npm install -D rollup-plugin-visualizer
```

**File:** `vaultdrive_client/vite.config.ts`

```typescript
import { visualizer } from 'rollup-plugin-visualizer';

// In plugins array, behind env flag:
...(process.env.BUNDLE_REPORT ? [visualizer({
  filename: 'docs/reports/2026-05-22-bundle-report.html',
  open: false,
  gzipSize: true,
  template: 'treemap',
})] : []),
```

**Run:**
```bash
BUNDLE_REPORT=1 npm run build
```

This generates an interactive HTML treemap showing exactly which dependencies consume the most space.

### 8.2 — Manual Chunk Splitting

**File:** `vaultdrive_client/vite.config.ts`

Add explicit `manualChunks` to isolate known-heavy dependencies from the main bundle:

```typescript
build: {
  rollupOptions: {
    output: {
      manualChunks: {
        'react-core': ['react', 'react-dom', 'react-router-dom'],
        'i18n': ['i18next', 'react-i18next', 'i18next-browser-languagedetector'],
        'crypto-lib': ['jszip'],
      }
    }
  }
}
```

**Expected impact:**
- `react-core` → ~45 KB chunk (shared across all pages)
- `i18n` → ~25 KB chunk (loaded once on init)
- `crypto-lib` → ~90 KB chunk (only loaded during upload/download)
- Main chunk drops by ~160 KB

### 8.3 — Icon Import Audit

**Search:** `grep -r "from \"lucide-react\"" src/ | head -20`

If using barrel imports (`import { Upload, Download, Share } from "lucide-react"`), Vite's tree-shaking should handle it. But verify by checking the bundle report — if lucide is >30 KB in the main chunk, switch to individual imports:

```tsx
// Before (barrel import — may not tree-shake fully):
import { Upload, Download, Share2 } from "lucide-react";

// After (deep import — guaranteed tree-shaking):
import Upload from "lucide-react/dist/esm/icons/upload";
import Download from "lucide-react/dist/esm/icons/download";
```

### 8.4 — Lazy-Load Non-Critical Components

Identify components in the main bundle that are only used in specific flows:

| Component | When needed | Action |
|-----------|-------------|--------|
| Share modal | Only when sharing | `React.lazy()` |
| Upload modal | Only when uploading | `React.lazy()` |
| Agent key settings | Only in settings | Already lazy (settings page) |
| EncryptionProof | Only during upload | Build as lazy from Step 4 |

### 8.5 — Lighthouse Performance Audit

Run Lighthouse on 3 pages and record baseline → optimized scores:

| Page | Baseline | Target |
|------|----------|--------|
| Landing (`/quantix/`) | TBD | 95+ |
| Dashboard (`/quantix/dashboard`) | TBD | 90+ |
| Files (`/quantix/files`) | TBD | 90+ |

Save report: `docs/reports/2026-05-22-lighthouse-performance.md`

### 8.6 — CSS Purge Audit

Check if the 118 KB CSS file contains unused styles from the 6 theme variants. If >20% is unused, consider splitting theme CSS into lazy-loaded chunks:

```css
/* Load only the active theme */
@import url("./themes/quantix.css") supports(--theme: quantix);
```

Or use the existing `data-theme` attribute with `@layer` to reduce specificity conflicts.

---

## Verification

| Check | Expected | How to verify |
|-------|----------|---------------|
| Bundle report | HTML treemap in docs/reports/ | `BUNDLE_REPORT=1 npm run build` |
| Main chunk size | ≤ 400 KB | Check build output |
| Lighthouse landing | 95+ performance | Run audit |
| Lighthouse dashboard | 90+ performance | Run audit |
| No regressions | 116/116 vitest, 41/41 E2E | Run full test suites |
| No missing icons | All icons render correctly | Manual page walk |
| No broken layouts | All pages look correct | Manual visual check |

---

## Risk

**Low-Medium.** Chunk splitting can cause import order issues or missing dependencies at runtime. Mitigate by:
1. Running the full E2E suite after chunk changes
2. Testing each page manually in production build (`npx serve dist`)
3. Keeping changes incremental — one `manualChunks` entry at a time

---

## Evidence Log

| Date | What was done | Verified? | Commit |
|------|--------------|-----------|--------|
| | | | |

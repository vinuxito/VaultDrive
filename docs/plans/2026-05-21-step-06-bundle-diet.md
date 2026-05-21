# Step 6 — Bundle Diet & Performance

**Parent:** [Hackathon Index](./2026-05-21-hackathon-index.md)  
**Priority:** 🟡 High  
**Effort:** M (1 day)

---

## Why This Matters

The main JavaScript chunk is **531 KB** (159 KB gzip). That's over the Vite/Rollup warning threshold of 500 KB. On a slow connection (or a judge's conference WiFi), this means a multi-second initial load.

The app already code-splits heavy pages via `React.lazy()`. The remaining 531 KB chunk is the core bundle — React, router, i18next, Radix UI, lucide icons, shadcn/ui primitives, and the root App shell. There are likely low-hanging wins hiding in this chunk.

---

## Current State (Verified)

```
dist/assets/index-B-PxaGjh.js        531.08 kB │ gzip: 159.27 kB
dist/assets/motion-Dsp8GjAY.js       124.69 kB │ gzip:  41.04 kB
dist/assets/files-CqGH8Gxv.js        193.96 kB │ gzip:  45.10 kB
dist/assets/radix-BF_Ss0e6.js        103.32 kB │ gzip:  29.91 kB
dist/assets/settings-Dgrz3lXW.js      87.71 kB │ gzip:  19.81 kB
dist/assets/vendor-Bk_lHfc-.js        44.82 kB │ gzip:  16.15 kB
dist/assets/index-NPntQdW7.css       118.21 kB │ gzip:  20.56 kB
```

**Suspects for the main chunk bloat:**
- `lucide-react` — 20 KB chunk visible, but likely more icons tree-shaken into the main bundle.
- `i18next` ecosystem — may be pulling full locale data.
- `react-router` — entire routing layer in the main chunk (necessary).
- Radix primitives — some may be importable as individual packages.

---

## Success Condition

After this step:
1. The main chunk is **under 400 KB** (target: 120 KB gzip).
2. A **bundle visualization report** is saved to `docs/reports/`.
3. No new runtime errors or visual regressions.
4. Lighthouse performance score is **90+** on the landing page.

---

## Implementation Plan

### 6.1 — Bundle Visualization

**File:** `vaultdrive_client/vite.config.ts`

Add `rollup-plugin-visualizer` behind an env flag:

```bash
npm install -D rollup-plugin-visualizer
```

```typescript
import { visualizer } from 'rollup-plugin-visualizer';

// In plugins array:
process.env.BUNDLE_REPORT && visualizer({
  filename: 'docs/reports/bundle-report.html',
  open: false,
  gzipSize: true,
}),
```

Run: `BUNDLE_REPORT=1 npm run build`

Save the report to `docs/reports/2026-05-21-bundle-report.html`.

### 6.2 — Analyze Top Contributors

From the visualization, identify the top 5 contributors to the main chunk. Likely candidates:
1. **lucide-react** — If using barrel imports (`import { X } from "lucide-react"`), every icon gets bundled. Switch to deep imports: `import { X } from "lucide-react/dist/esm/icons/x"`.
2. **framer-motion** — Already in its own chunk. Verify no re-exports leak into main.
3. **i18next** — Verify locale JSON files are not duplicated across chunks.
4. **Radix UI** — Check if unused Radix primitives are being pulled in.

### 6.3 — Manual Chunk Splitting

**File:** `vaultdrive_client/vite.config.ts`

Add explicit `manualChunks` to separate known-heavy dependencies:

```typescript
build: {
  rollupOptions: {
    output: {
      manualChunks: {
        'react-vendor': ['react', 'react-dom', 'react-router-dom'],
        'ui-vendor': ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu', /* ... */],
        'crypto': ['jszip'],
      }
    }
  }
}
```

### 6.4 — Lazy-Load Non-Critical Components

Identify components in the main bundle that are only used in specific flows:
- Share modal — only needed when sharing. Could be lazy.
- File preview components — only needed when viewing files.

### 6.5 — Lighthouse Audit

Run a Lighthouse audit on the landing page and dashboard to get baseline performance scores. Record them.

---

## Verification

| Check | Expected | How to verify |
|-------|----------|---------------|
| Bundle report | HTML file in docs/reports/ | `BUNDLE_REPORT=1 npm run build` |
| Main chunk size | < 400 KB | Check build output |
| No regressions | 116/116 vitest, 41/41 Playwright | Run full test suite |
| Lighthouse score | 90+ on landing | Run audit |
| Visual check | No missing icons, broken layouts | Manual page walk |

---

## Risk

**Low-Medium.** Chunk splitting can cause import order issues or missing dependencies at runtime. Mitigate by running the full E2E suite after changes. Lazy-loading modals can cause a brief flash on first open — verify the UX is acceptable.

---

## Evidence Log

| Date | What was done | Verified? | Commit |
|------|--------------|-----------|--------|
| | | | |

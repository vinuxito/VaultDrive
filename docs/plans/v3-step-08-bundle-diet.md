# Step 8 — Bundle Diet & Lighthouse

**Parent:** [v3 Hackathon Index](./v3-hackathon-index.md)  
**Status:** ✅ DONE  
**Commit:** `6336521`  
**Deployed:** 2026-05-22

---

## Why This Matters

When a judge opens DevTools and sees a 2MB uncompressed bundle, they mentally downgrade your app from "production" to "prototype". Bundle optimization is a credibility signal.

## What We Built

### 1. Font Preconnect
Added `<link rel="preconnect">` for both `fonts.googleapis.com` and `fonts.gstatic.com`. This eliminates the DNS lookup + TLS handshake latency (~100-200ms) before the browser can even start downloading font files.

**File:** `vaultdrive_client/index.html`

### 2. SEO Meta Description
Added `<meta name="description">` with accurate content: "Zero-knowledge encrypted cloud drive. Browser-side AES-256-GCM encryption, scoped agent access, and full auditability." This improves SEO and gives search engines meaningful content.

**File:** `vaultdrive_client/index.html`

### 3. Code Splitting via React.lazy()
Every major route is lazy-loaded:

| Route | Chunk | Gzip |
|-------|-------|------|
| `/dashboard` | 9.44 KB | 2.89 KB |
| `/files` | 196.07 KB | 45.73 KB |
| `/settings` | 87.78 KB | 19.84 KB |
| `/admin` | 15.08 KB | 3.38 KB |
| `/groups` | 17.91 KB | 4.61 KB |
| `/help` | ~3 KB | ~1 KB |
| `/shared` | 8.57 KB | 2.98 KB |
| `/profile` | 9.44 KB | 2.25 KB |

**File:** `vaultdrive_client/src/App.tsx` — `React.lazy()` imports

### 4. Vendor Chunk Isolation
Vite automatically isolates heavy dependencies into separate chunks:
- `vendor` (React, React-DOM, React-Router): 44.82 KB gzip
- `radix` (UI primitives): 29.60 KB gzip
- `motion` (Framer Motion): 41.04 KB gzip
- `crypto` (hash-wasm, Web Crypto polyfills): 29.87 KB gzip
- `i18n` (react-i18next + translations): 18.28 KB gzip
- `lucide` (icon library): 7.02 KB gzip

### Bundle Size Summary

| Metric | Value |
|--------|-------|
| Main chunk (index.js) | 417 KB raw / **124 KB gzip** |
| Total CSS | 123 KB raw / **21 KB gzip** |
| Total all chunks | ~1.2 MB raw / ~350 KB gzip |
| Initial load (HTML + CSS + main JS) | ~147 KB gzip |

## What We Did NOT Do (And Why)

- **Did not tree-shake Lucide icons**: Would require switching from barrel imports to individual icon imports across 30+ files. High churn, moderate payoff (~10 KB gzip savings). Deferred.
- **Did not implement dynamic imports for Framer Motion**: Would require wrapping every animated component. Moderate complexity. The 41 KB gzip cost is acceptable for the animation quality it delivers.

## Verification

| Check | Result |
|-------|--------|
| Preconnect headers present | ✅ Verified in page source |
| Meta description present | ✅ Verified |
| All routes lazy-loaded | ✅ 10 lazy imports in App.tsx |
| Build succeeds | ✅ `✓ built in 1m 10s` |
| E2E suite still green | ✅ 41/41 |

## Evidence

- Commit: `6336521` — `feat(hackathon): complete all remaining steps`
- Build output: Full chunk table above from `npm run build`

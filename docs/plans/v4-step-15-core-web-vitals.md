# Step 15 — Core Web Vitals

**Parent:** [v4 Production Launch Index](./v4-production-launch-index.md)  
**Phase:** V — Performance & Lighthouse  
**Status:** 🔲 TODO  
**Priority:** MEDIUM — Google ranking signal  
**Depends on:** Step 14 (Bundle Diet v2)  

---

## Why This Matters

Core Web Vitals are Google's ranking signals. LCP < 2.5s, INP < 200ms, CLS < 0.1. If the app fails these, it gets deprioritized in search results. More importantly, users on slow connections (Mexico, Latin America) will bounce before the app loads.

## Targets

| Metric | Target | What It Measures |
|--------|--------|-----------------|
| **LCP** (Largest Contentful Paint) | < 2.5s | Time to render the largest visible element |
| **INP** (Interaction to Next Paint) | < 200ms | Time from user interaction to visual response |
| **CLS** (Cumulative Layout Shift) | < 0.1 | Visual stability — elements shouldn't jump |
| **Lighthouse Performance** | ≥ 90 | Overall score (mobile) |

## Current State: Unknown

> **Not yet measured.** First step is establishing a baseline on both production URLs.

## Implementation

### 1. Establish Baseline

```bash
# Lighthouse CLI — mobile emulation
npx lighthouse https://quantixdrive.filemonprime.net/quantix/login \
  --output=json --output-path=./lighthouse-quantix-baseline.json \
  --preset=perf --chrome-flags="--headless"

npx lighthouse https://abrndrive.filemonprime.net/abrn/login \
  --output=json --output-path=./lighthouse-abrn-baseline.json \
  --preset=perf --chrome-flags="--headless"
```

### 2. Fix LCP

The largest contentful paint is likely the login form or the dashboard hero. Optimize:

- **Preload critical fonts:** `<link rel="preload" href="..." as="font" crossorigin>`
- **Inline critical CSS:** Extract above-the-fold CSS and inline in `<head>`
- **Optimize hero images:** Use WebP/AVIF format, set `fetchpriority="high"`
- **Remove render-blocking resources:** Defer non-critical JS and CSS

### 3. Fix INP

Ensure all click handlers respond in < 200ms:

- **Move crypto to web worker:** Argon2id key derivation blocks the main thread for ~500ms. Web worker prevents UI jank during login/PIN entry.
- **Debounce search:** File search input should use `useDeferredValue` or debounce
- **Avoid synchronous DOM reads:** `getBoundingClientRect()` in animation loops

### 4. Fix CLS

Prevent layout shifts:

- **Set explicit dimensions on images:** `<img width={48} height={48} ...>`
- **Reserve space for async content:** Skeleton loaders with fixed heights
- **Font loading:** `font-display: swap` with matched fallback font metrics
- **Dynamic lists:** Use CSS `contain: layout` on list containers

### 5. Ongoing Monitoring

```bash
# Add to CI pipeline (Step 17)
npx lighthouse https://quantixdrive.filemonprime.net/quantix/login \
  --budget-path=./lighthouse-budget.json \
  --output=json --chrome-flags="--headless"
```

**`lighthouse-budget.json`:**
```json
[{
  "path": "/quantix/login",
  "timings": [
    { "metric": "largest-contentful-paint", "budget": 2500 },
    { "metric": "interactive", "budget": 3500 }
  ],
  "resourceCounts": [
    { "resourceType": "script", "budget": 10 },
    { "resourceType": "total", "budget": 30 }
  ],
  "resourceSizes": [
    { "resourceType": "script", "budget": 300 }
  ]
}]
```

## Verification

| Check | Expected Result |
|-------|----------------|
| Lighthouse Performance (QuantiX mobile) | ≥ 90 |
| Lighthouse Performance (ABRN mobile) | ≥ 90 |
| LCP | < 2.5s |
| INP | < 200ms |
| CLS | < 0.1 |
| No regressions | E2E still green |

## Files to Change

| File | Change |
|------|--------|
| `vaultdrive_client/index.html` | Font preloading, critical CSS inline |
| `src/utils/crypto.ts` | Web worker for Argon2id |
| Various components | Explicit dimensions, skeleton heights |
| `lighthouse-budget.json` (new) | Performance budget file |

## Both Drives

- Same frontend codebase — fixes apply to both
- Lighthouse baseline needed for both production URLs independently

# Step 16 — Asset Pipeline & CDN

**Parent:** [v4 Production Launch Index](./v4-production-launch-index.md)  
**Phase:** V — Performance & Lighthouse  
**Status:** 🔲 TODO  
**Date:** TBD  

---

## Why This Matters

Static assets (JS, CSS, fonts, images) are served directly from the Go binary or Apache. In production, these should be served from a CDN edge with immutable cache headers and Brotli compression. Every millisecond of asset delivery latency multiplies across every user, every page load, every session.

## Current State

- Vite builds with content-hashed filenames: `index-BGNk0P2D.js`, `radix-BF9ScZzn.js`
- Assets served from Go via `http.ServeFile` or Apache ProxyPass
- No explicit `Cache-Control` headers on static assets
- No Brotli compression (Apache may do gzip via `mod_deflate`)
- No CDN — all traffic hits the origin server directly

## What We Will Build

### 1. Immutable Cache Headers for Hashed Assets

**Where:** Go middleware in `main.go`, SPA handler (line 502)

```go
// If the file has a content hash in the name, set immutable cache
if isHashedAsset(cleanPath) {
    w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
}
```

Pattern: any file in `dist/assets/` with a hash pattern like `-[A-Za-z0-9]{8}.` gets immutable caching. HTML files (`index.html`) get `no-cache` (always revalidated).

### 2. Brotli Compression via Apache

**Where:** `/lamp/apache2/conf/extra/quantixdrive-ssl.conf` and `abrndrive-ssl.conf`

```apache
# Enable Brotli for text-based assets
AddOutputFilterByType BROTLI_COMPRESS text/html text/css application/javascript application/json image/svg+xml
BrotliCompressionQuality 6
```

Brotli achieves ~15-20% better compression than gzip for JavaScript.

### 3. Font Optimization

- **Preconnect** to Google Fonts (already done: `<link rel="preconnect" href="https://fonts.googleapis.com">`)
- **Font-display: swap** — prevents FOIT (Flash of Invisible Text)
- Consider **self-hosting** fonts to eliminate the third-party DNS lookup

### 4. CDN Evaluation (Future)

- Evaluate Cloudflare (free tier) for edge caching
- DNS proxying would add SSL termination at edge
- Trade-off: Cloudflare's free tier may not support WebSocket/SSE (needed for `/api/events`)

## Verification

| Check | Expected Result |
|-------|----------------|
| `curl -I /quantix/assets/index-*.js` | `Cache-Control: public, max-age=31536000, immutable` |
| `curl -I /quantix/index.html` | `Cache-Control: no-cache` |
| `curl -H "Accept-Encoding: br" /quantix/assets/index-*.js` | `Content-Encoding: br` |
| Lighthouse Performance (cached) | ≥ 95 |
| Font loading | No FOIT, `font-display: swap` |

## Files to Change

| File | Change |
|------|--------|
| `main.go` (SPA handler) | Add `Cache-Control` headers for hashed assets |
| Apache SSL confs (both drives) | Enable Brotli, set cache headers |
| `vaultdrive_client/index.html` | Verify font preconnect, consider self-hosted fonts |

## Both Drives

- Apache config changes apply to both `quantixdrive-ssl.conf` and `abrndrive-ssl.conf`
- Go middleware changes are shared (same binary)

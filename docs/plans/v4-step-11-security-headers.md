# Step 11 — Security Headers & CSP

**Parent:** [v4 Production Launch Index](./v4-production-launch-index.md)  
**Phase:** IV — Production Hardening  
**Status:** 🔲 TODO  
**Priority:** HIGH — Required for production  

---

## Why This Matters

Without security headers, the app is vulnerable to XSS injection, clickjacking, MIME-type sniffing, and downgrade attacks. A single `securityheaders.com` scan will expose this. Production apps need an A+ rating.

## Current State

- **HTTPS:** ✅ Both drives served over HTTPS via Apache + Let's Encrypt
- **CORS:** ✅ `CORS_ALLOWED_ORIGINS` configured per service
- **CSP:** ❌ No Content-Security-Policy header
- **HSTS:** ❌ Not explicitly set (Apache may add it, needs verification)
- **X-Frame-Options:** ❌ Missing
- **X-Content-Type-Options:** ❌ Missing

## Headers to Add

### Option A: Go Middleware (Recommended)

Add a `securityHeaders` middleware in `main.go` that applies to all responses:

```go
func securityHeaders(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        w.Header().Set("Content-Security-Policy",
            "default-src 'self'; "+
            "script-src 'self'; "+
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "+
            "font-src 'self' https://fonts.gstatic.com; "+
            "img-src 'self' data: blob:; "+
            "connect-src 'self'; "+
            "frame-ancestors 'none'; "+
            "base-uri 'self'; "+
            "form-action 'self'")
        w.Header().Set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload")
        w.Header().Set("X-Content-Type-Options", "nosniff")
        w.Header().Set("X-Frame-Options", "DENY")
        w.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")
        w.Header().Set("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
        w.Header().Set("X-DNS-Prefetch-Control", "off")
        next.ServeHTTP(w, r)
    })
}
```

### Option B: Apache Config (Alternative)

```apache
# In quantixdrive-ssl.conf and abrndrive-ssl.conf
Header always set Content-Security-Policy "default-src 'self'; script-src 'self'; ..."
Header always set Strict-Transport-Security "max-age=63072000; includeSubDomains; preload"
Header always set X-Content-Type-Options "nosniff"
Header always set X-Frame-Options "DENY"
Header always set Referrer-Policy "strict-origin-when-cross-origin"
Header always set Permissions-Policy "camera=(), microphone=(), geolocation=()"
```

### CSP Considerations

| Directive | Value | Why |
|-----------|-------|-----|
| `script-src 'self'` | No inline scripts allowed | Prevents XSS |
| `style-src 'self' 'unsafe-inline'` | Inline styles needed for theme loader | The `<script>` in index.html sets inline styles |
| `font-src` | Google Fonts gstatic | External fonts |
| `img-src 'self' data: blob:` | Data URIs for avatars, blob for uploads | Functional requirement |
| `connect-src 'self'` | API calls only to same origin | Prevents data exfiltration |
| `frame-ancestors 'none'` | Cannot be embedded in iframes | Prevents clickjacking |

> **⚠️ NOTE:** The inline `<script>` in `index.html` (theme loader) may require `'unsafe-inline'` in `script-src` OR refactoring to use a nonce. Evaluate during implementation.

## Verification

| Check | Expected Result |
|-------|----------------|
| `curl -I https://quantixdrive.filemonprime.net/quantix/` | All security headers present |
| `curl -I https://abrndrive.filemonprime.net/abrn/` | Same headers on ABRN |
| securityheaders.com scan — QuantiX | Grade A or A+ |
| securityheaders.com scan — ABRN | Grade A or A+ |
| App still loads correctly | ✅ No CSP violations in console |
| File upload still works | ✅ blob: and data: allowed |
| Google Fonts load | ✅ font-src allows gstatic |

## Files to Change

| File | Change |
|------|--------|
| `main.go` | Add `securityHeaders` middleware (wrap root handler) |
| OR Apache SSL confs (both) | Add `Header` directives |
| `vaultdrive_client/index.html` | May need refactor for CSP-compliant theme loader |

## Both Drives

- Go middleware is shared (same binary) — applies to both automatically
- If using Apache approach, both SSL confs must be updated identically

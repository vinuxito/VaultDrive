# Step 12 — Rate Limiting & Abuse Prevention

**Parent:** [v4 Production Launch Index](./v4-production-launch-index.md)  
**Phase:** IV — Production Hardening  
**Status:** 🔲 TODO  
**Priority:** MEDIUM — Defense in depth  

---

## Why This Matters

The app has rate limiting on login and PIN endpoints. But registration, file upload, share link creation, and API key creation are unprotected. A malicious actor can create thousands of accounts, exhaust disk space with uploads, or generate millions of share links. Production means defending every surface.

## Current State

| Endpoint | Rate Limited? | Middleware |
|----------|--------------|-----------|
| `POST /api/login` | ✅ | `middlewareRateLimitLogin` |
| `POST /api/users/pin` | ✅ | `middlewareRateLimitPIN` |
| `POST /api/register` | ❌ | — |
| `POST /api/files/upload` | ❌ | — |
| `POST /api/*/share-link` | ❌ | — |
| `POST /api/drop/create` | ❌ | — |
| `POST /api/agent-keys` | ❌ | — |
| `POST /api/file-requests` | ❌ | — |

## What We Will Build

### 1. Generic Rate Limiter Factory

**File:** `middleware.go`

```go
func middlewareRateLimit(name string, requests int, window time.Duration) func(http.Handler) http.Handler {
    limiter := newRateLimiter(requests, window)
    return func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            ip := extractClientIP(r)
            if !limiter.Allow(ip) {
                log.Printf("Rate limit exceeded for %s on %s", ip, name)
                http.Error(w, `{"error":"Too many requests. Please try again later."}`, 429)
                return
            }
            next.ServeHTTP(w, r)
        })
    }
}
```

### 2. Apply to Unprotected Endpoints

| Endpoint | Limit | Window | Rationale |
|----------|-------|--------|-----------|
| `POST /api/register` | 5 | 1 min | Prevents account spam |
| `POST /api/files/upload` | 30 | 1 min | Protects disk space |
| `POST /api/*/share-link` | 10 | 1 min | Prevents link spam |
| `POST /api/drop/create` | 10 | 1 min | Prevents drop link spam |
| `POST /api/agent-keys` | 5 | 1 min | Prevents key spam |
| `POST /api/file-requests` | 10 | 1 min | Prevents request spam |
| `POST /api/drop/:token/upload` | 20 | 1 min | Public endpoint — extra protection |

### 3. Client IP Extraction

```go
func extractClientIP(r *http.Request) string {
    // Trust X-Forwarded-For from Apache proxy
    if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
        return strings.Split(xff, ",")[0]
    }
    ip, _, _ := net.SplitHostPort(r.RemoteAddr)
    return ip
}
```

### 4. Progressive Response

- **First 429:** JSON error with `Retry-After` header
- **Repeated 429s:** Increasing backoff (1s, 5s, 30s)
- **Future consideration:** CAPTCHA challenge after N failures

### 5. Monitoring Hook

Log all rate limit hits for the audit system:
```go
log.Printf("RATE_LIMIT ip=%s endpoint=%s window=%s", ip, name, window)
```

## Verification

| Check | Expected Result |
|-------|----------------|
| `for i in $(seq 1 10); do curl -X POST /api/register; done` | 429 after 5 requests |
| Legitimate registration | ✅ Still works within limits |
| Rate limit logged | ✅ Visible in server logs |
| 429 response format | `{"error":"Too many requests..."}` with `Retry-After` header |
| E2E suite still green | ✅ Tests run within limits |

## Files to Change

| File | Change |
|------|--------|
| `middleware.go` | Add `middlewareRateLimit` factory, `extractClientIP` |
| `main.go` | Apply middleware to unprotected routes |

## Both Drives

- Go middleware is shared (same binary) — applies to both automatically
- Same rate limits for both drives (unless ABRN needs different thresholds)

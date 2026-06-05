# Summary of Work - 2026-05-22 - E2E Dynamic Branding and Rate Limiter Fix

## 1. Work Accomplished
- **E2E Framework Refactoring:** 
  - Extracted the hardcoded `QuantiX Drive` / `ABRN Drive` text checks out of `file-upload-flow.spec.ts`, `trust.ts`, and `demo-recorder.spec.ts`.
  - Added a new `getProductName.ts` helper that loads `.env` dynamically via `dotenv` and reads `VITE_PRODUCT_NAME`, falling back to `QuantiX Drive`.
  - Injected `productName` via template strings ``Open ${productName}`` so tests pass regardless of white-label configuration.
- **Backend Rate Limiting Fix:**
  - Audited all rate limiters in `middleware_ratelimit.go`.
  - Discovered that while `middlewareRateLimitLogin` and `middlewareRateLimitPIN` successfully bypassed E2E testing (loopback addresses), the global `middlewareRateLimit` (100 req/min) did not check `isLoopbackIP(ip)`.
  - Added `!isLoopbackIP(ip) &&` to `globalRateLimiter.allow()` to prevent `429 Too Many Requests` during parallel `npx playwright test` executions.

## 2. Next Steps
- Validate `npx playwright test` passes cleanly with 100% success rate without 429 errors or element visibility timeouts.
- Close out session and confirm safe to push.

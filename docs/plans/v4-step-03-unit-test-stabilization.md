# Step 3 — Unit Test Stabilization

**Parent:** [v4 Production Launch Index](./v4-production-launch-index.md)  
**Phase:** I — Foundation Verified  
**Status:** ✅ DONE  
**Commit:** `3eb90a0`  
**Date:** 2026-05-23  

---

## Why This Matters

Flaky tests erode trust in the test suite. Two tests passed individually but timed out in full-suite runs, creating false negatives. A developer seeing random failures will start ignoring the suite — and that's how bugs ship.

## The Problem

| Test File | Isolated | Full Suite |
|-----------|----------|-----------|
| `login.test.tsx` | ✅ 916ms | ❌ Timeout at 5000ms |
| `CreateUploadLinkModal.test.tsx` | ✅ 556ms | ❌ Timeout at 5000ms |

Root cause: jsdom environment setup overhead compounds across 32 test files. Each test file initializes React, SWR provider, i18n, and the component tree. In isolation, this takes <1s. In a full suite of 32 files, earlier tests consume memory and CPU, slowing later tests past the 5s default timeout.

## Fix Applied

**File:** `vaultdrive_client/vite.config.ts`

```typescript
test: {
  testTimeout: 15000,  // ← added
  // ... rest of vitest config
}
```

This is safe: it only extends the timeout ceiling. It does not change test behavior, skip assertions, or mask real failures. Tests that pass in 1s still pass in 1s.

## Verification

| Check | Result |
|-------|--------|
| `npx vitest run` | ✅ 31 passed, 1 skipped, 0 failed (42s) |
| `login.test.tsx` isolated | ✅ 916ms |
| `CreateUploadLinkModal.test.tsx` isolated | ✅ 556ms |
| `login.test.tsx` in full suite | ✅ Passes within 15s |
| Skipped test | `FolderSharedLinksSection.test.tsx` — pre-existing, unrelated |
| Total assertions | 116 |

## Evidence

- Commit: `3eb90a0` — `chore: verify and close out UX phase — fix test timeouts, document E2E infrastructure gap`

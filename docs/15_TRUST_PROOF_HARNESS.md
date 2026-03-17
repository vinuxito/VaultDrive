# 15 - Trust Proof Harness

## Summary

This session converted ABRN Drive's previously manual browser verification into a committed, repo-native trust proof harness.

The new harness proves the current app against the real Go-served frontend build, not a mock shell or a temporary script. It covers the owner trust path, Secure Drop sender flow, a negative Secure Drop fragment-key boundary, and the File Request sender flow.

---

## What Was Added

### Playwright harness

- `vaultdrive_client/playwright.config.ts`
- `vaultdrive_client/e2e/helpers/trust.ts`
- `vaultdrive_client/e2e/owner-trust-flow.spec.ts`
- `vaultdrive_client/e2e/public-sender-flows.spec.ts`

### Scripts and test boundaries

- `vaultdrive_client/package.json`
  - `test:e2e`
  - `test:e2e:headed`
  - `test:e2e:ui`
  - `test:all`
- `vaultdrive_client/vite.config.ts`
  - explicit Vitest include/exclude so unit tests do not ingest Playwright suites or artifact directories
- `.gitignore`
  - Playwright report and result directories ignored

### CI workflow

- `.github/workflows/trust-proof-e2e.yml`
  - boots PostgreSQL
  - runs Goose migrations
  - runs frontend unit tests
  - runs backend tests
  - runs the Playwright trust-proof suite
  - uploads Playwright artifacts

### Supporting app fixes surfaced by the harness

- `vaultdrive_client/src/components/onboarding/OnboardingWizard.tsx`
  - stable primary action selector for folder creation
- `vaultdrive_client/src/pages/drop-upload.tsx`
  - no longer hardcodes `/abrn/api/...`; now respects the shared API base helper contract

---

## Verified Flows

### Owner trust flow

`vaultdrive_client/e2e/owner-trust-flow.spec.ts`

Proves:

1. fresh signup
2. password login
3. onboarding gate on `/files`
4. PIN setup with account-password rewrap
5. first-folder creation
6. protected vault entry
7. `/settings` trust surfaces render
8. local auth clear
9. PIN login works

### Public sender flows

`vaultdrive_client/e2e/public-sender-flows.spec.ts`

Proves:

1. Secure Drop sender route accepts upload and shows delivery receipt
2. Secure Drop sender route fails clearly when the URL fragment key is missing
3. File Request sender route accepts passphrase-protected upload and shows delivery receipt

---

## Verification Results

Latest verified state after the final follow-up fix:

- `cd vaultdrive_client && npm test` -> PASS (`17/17`)
- `cd /lamp/www/ABRN-Drive && go test ./...` -> PASS
- `cd /lamp/www/ABRN-Drive && go build ./...` -> PASS
- `cd vaultdrive_client && npm run test:e2e` -> PASS (`4/4`)

The Playwright harness self-hosts the current Go app on:

- `http://127.0.0.1:8090/abrn/`

This avoids stale-local-server drift and proves the current repo code directly.

---

## Safe Follow-Up Improvement Applied

The highest-value follow-up from the previous review was negative trust-boundary coverage.

Applied in this session:

- Secure Drop now has a committed test proving the page fails clearly when the fragment key is missing.

This moves the suite beyond happy-path smoke coverage and starts validating the trust boundary itself.

---

## Remaining Risks

1. The main frontend chunk still exceeds Vite's warning threshold.
2. The harness currently covers the owner flow plus public sender flows, but not yet:
   - public share recipient flow
   - shared-file recipient flow
   - agent key lifecycle flow
3. Negative trust-boundary coverage is still early; more expiry/revocation/bad-credential cases should be added.

---

## Why This Matters

Before this work, ABRN Drive's strongest product claims were verified mostly through temporary browser scripts and manual local ritual.

Now the repo itself can prove:

- the one-PIN owner trust flow
- the Secure Drop sender path
- the File Request sender path
- a core Secure Drop trust-boundary failure mode

This is the first real foundation for continuously proving that ABRN Drive still behaves like a trust-first product as it evolves.

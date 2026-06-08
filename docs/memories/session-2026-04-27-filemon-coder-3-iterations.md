# Session memory — 2026-04-27 — Filemón Coder, 3 iterations

**Mode:** Filemón Coder execution loop (senior implementation engineer + product-aware architect + QA + regression hunter + documentation closer).
**Plan source of truth:** [docs/plans/2026-04-27-architect-review-implementation-plan.md](../plans/2026-04-27-architect-review-implementation-plan.md).
**Outcome:** 3 iterations, each landed on prod (https://quantixdrive.filemonprime.net) and verified live.

## Iteration 1 — Register input validation

**Frame.** Two bugs in `POST /api/register` were live on prod (see earlier QA closeout):
1. HIGH — server accepted any password, including `"short"` (5 chars). Persisted hash + RSA keypair for a too-weak credential.
2. MEDIUM — empty body `{}` caused 500 instead of 400 because hash + DB insert ran before any validation.

**Smallest strong move.** Insert one validation block between JSON decode and `auth.HashPassword`. Mirror the same rule in the register form so the user sees it before round-tripping.

**Changes.**
- [handle_user_create.go](../../handle_user_create.go) — `validateRegisterInput()` enforces non-empty trimmed first/last/username/email, RFC-loose email regex, length cap on text fields (254 chars), and password 8–64 chars. Called immediately after `json.Decode` and before `HashPassword`.
- [handle_user_create_test.go](../../handle_user_create_test.go) — table-driven `TestValidateRegisterInput` (no DB) plus DB-backed `TestRegisterUserHandler_RejectsInvalidInput` (empty body, short pw, bad email, malformed JSON) and `TestRegisterUserHandler_HappyPath` with cleanup.
- [vaultdrive_client/src/utils/registerValidation.ts](../../vaultdrive_client/src/utils/registerValidation.ts) — extracted helper so the rule is unit-testable and reused inside the form.
- [vaultdrive_client/src/utils/registerValidation.test.ts](../../vaultdrive_client/src/utils/registerValidation.test.ts) — 8 vitest cases covering each rule.
- [vaultdrive_client/src/pages/login.tsx](../../vaultdrive_client/src/pages/login.tsx) — register form imports `validateRegister`; password input gets `minLength={8}`, `maxLength={64}`, and a visible "Must be 8–64 characters" hint via `aria-describedby`.

**Live verification (after `sudo systemctl restart quantixdrive` at ~11:20 CST).**

| Probe | Before fix | After fix |
| --- | --- | --- |
| `POST /api/register {}` | HTTP 500 — `"Error creating user"` | **HTTP 400** — `"first_name is required"` |
| `POST /api/register {short pw}` | HTTP 201 — user persisted | **HTTP 400** — `"password must be at least 8 characters"` |
| `POST /api/register {bad email}` | HTTP 200/201 (no check) | **HTTP 400** — `"email is not a valid email address"` |
| `POST /api/register {happy path}` | 201 | **201** (preserved) |

Commit: `f92838d feat: validate register input on server and client`.

## Iteration 2 — `make deploy` automation

**Frame.** The closeout README documented a 4-step deploy procedure (`npm run build`, `go build`, `sudo systemctl restart`, `curl`). Every iteration repeats those manually, and there's no fail-fast on a broken deploy.

**Smallest strong move.** Add a single `make deploy` target that chains the four steps and fails on any unexpected smoke status.

**Changes.**
- [Makefile](../../Makefile) — new targets `build-frontend`, `build-backend` (= `build-prod`), `deploy-restart`, `deploy-smoke`, and `deploy` that chains all four. Smoke probes:
  - `GET /api/healthz` must be 200.
  - `POST /api/register {}` must be 400 (this implicitly regression-tests Iteration 1 — if the server ever stops validating the empty body, deploy will fail).
  - `GET /quantix/` must be 200.
  - Any other status exits non-zero.
- [README.md](../../README.md) — Deploy / Build Runbook recommends `make deploy` first; manual fallback retained for recovery.

**Verification.** `make deploy-smoke` against live prod returns:
```
healthz: HTTP 200
register{}: HTTP 400
/quantix/: HTTP 200
Deploy verified.
```

Commit: `e667625 feat: make deploy target chains build-frontend, build-backend, restart, smoke`.

## Iteration 3 — Coherence test coverage extension + full E2E + final deploy

**Frame.** AccessPanel and FileRequestsSection were already migrated to `<RowActionMenu>`, `<DataState>`, and `constants/copy.ts` in earlier sessions. The remaining productive work for this iteration was **closing test gaps** and **running the full Playwright suite** to prove the pipeline still works end-to-end after Iterations 1 and 2.

**Changes.**
- [AccessPanel.test.tsx](../../vaultdrive_client/src/components/vault/AccessPanel.test.tsx) — added a test that exercises the actual re-fetch behaviour when `<DataState>`'s retry button is clicked (was previously only asserting that the retry button renders).
- [FileRequestsSection.test.tsx](../../vaultdrive_client/src/components/vault/FileRequestsSection.test.tsx) — added two tests: copy-url action verifies clipboard write with the correct URL; inactive requests no longer surface the destructive delete action.

**Verification (all on this iteration's checkout, against the iter-3 binary).**

| Suite | Result |
| --- | --- |
| `go test ./...` | `ok github.com/vinuxito/VaultDrive` |
| `npm test` (vitest) | **117 / 117 passed** across 32 files |
| `npm run test:e2e` (Playwright) | **39 / 39 passed** in 1.6 min |
| `make deploy-smoke` | healthz 200, register{} 400, /quantix/ 200 |

Final live deploy: systemd `Active: active (running) since Mon 2026-04-27 11:31:16 CST`, MainPID 184333.

Commits:
- `5da2389 test: extend AccessPanel + FileRequestsSection coherence coverage`.

## What changed on prod

| URL | Status | Notes |
| --- | --- | --- |
| https://quantixdrive.filemonprime.net/quantix/ | 200 | SPA serves freshly-built dist (10:00 baseline → 11:31 final). |
| https://quantixdrive.filemonprime.net/api/healthz | 200 | Backend healthy on port 8083. |
| https://quantixdrive.filemonprime.net/api/register | enforces NIST 8–64 password and required identity fields; returns 400 with structured error on bad input. |

## What did not change

- KDF for `encryptPrivateKey` is still single-round SHA-256 (Phase 4 of the plan, not in this loop's scope).
- No PR / push. Local main is ahead of `origin/main` by ~10 commits (continuing the previously-noted divergence).
- No new migrations.

## Risks / follow-ups

1. **Local-main divergence vs `origin/main`** — every iteration in this loop is on local main only. The deployed VPS already has the new binary, so prod is consistent, but anyone reading GitHub will see the old code. This is by user policy ("dont push is just dont git PUSH").
2. **Phase 4 (Argon2id KDF)** still pending. The user's password is the master key for the AES envelope around the private RSA key — single-round SHA-256 is the next correctness fix, not a hot bug.
3. **Empty `make deploy` smoke is not exhaustive.** It only proves the four canary URLs. A future iteration could extend it to a small auth probe (login a known user, request a token).

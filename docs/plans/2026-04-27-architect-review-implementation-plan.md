# Implementation Plan — Architect Review Follow-Through

**Date:** 2026-04-27
**Source:** [docs/reviews/2026-04-27-architect-review.md](../reviews/2026-04-27-architect-review.md)
**Operator:** Victor (vinuxito)
**Author:** Claude Code

---

## Frame

This plan turns the architect review's findings into landed, verified changes — in priority order of leverage. The review identified the public signup edge as the single biggest credibility risk; deploy hygiene as the second; everything else flows from there.

**What must remain true through the whole plan:**
- Zero-knowledge boundary unbroken — the server still never sees plaintext.
- All 39 Playwright + 106 vitest tests stay green at the end of every phase.
- No new feature work introduced beyond what the review names.
- No phase ships without a rebuild + restart against the live URL.

**What this plan deliberately is not:**
- A rewrite. No speculative abstractions. No new domains.
- A push of `main` upstream — that decision stays with the operator.
- A plan to ship every weak spot in one sprint. Phases 1–3 are the high-leverage core; 4–7 are explicitly deferrable.

---

## Phase Map (priority order)

| # | Phase | Why it's here | Effort | Risk | Reversible? |
|---|---|---|---|---|---|
| 1 | Register-validation patch (HIGH + MEDIUM) | Soft underbelly today; reproducible against live binary | S–M | Low | Yes |
| 2 | `make deploy` as the only path to prod | Closes the "vibes deploy" gap that hid 2-week-stale binary | M | Low | Yes |
| 3 | Coherence roadmap step 4 (AccessPanel + FileRequests adoption) | Already partially in flight; closing it makes the whole UI coherent | M | Low | Yes |
| 4 | KDF migration: SHA-256 → Argon2id (with backward-compat) | Architectural debt; low immediate risk but ages badly | L | Medium | Hard once shipped |
| 5 | Legacy "ABRN" purge in `docs/` | 50 files; new contributors get confused | S | None | Yes |
| 6 | Bundle profiling + ESLint debt schedule | 466 KB main chunk; warnings rotting | M | None | Yes |
| 7 | Load / chaos test scaffold | No data on real-load behavior | M–L | Low | Yes |

S ≤ ½ day, M = 1 day, L = 2–3 days.

---

## Phase 1 — Register-validation patch

### Success condition
Both findings closed, with tests:
- `POST /api/register {}` returns **400** with a structured error.
- `POST /api/register { "email":"x@y.z","password":"short" }` returns **400** with a clear policy message.
- Existing happy-path register still returns 200.
- Frontend register form shows the same policy and rejects locally before hitting the server.

### Frame
Fix is small in code but couples a server policy decision to a client-side rule. Land both sides in the same patch so they cannot drift.

### Smallest strong move
Pick **NIST SP 800-63B style** as the policy: minimum 8 characters, no max below 64, no complexity rule, no breach check yet (defer to a follow-up). This is the lowest-friction policy that defensibly closes the HIGH finding.

### Implementation steps
1. **Server** (`handle_user_create.go`):
   - After `json.NewDecoder(r.Body).Decode(&newUser)`, validate:
     - `newUser.Email != ""` and matches a basic email regex.
     - `len(newUser.Password) >= 8` and `<= 64`.
   - Return `respondWithError(w, http.StatusBadRequest, "<message>", nil)` on any failure.
   - Add a typed error path so the response body shape stays consistent.
2. **Client** (`vaultdrive_client/src/pages/register.tsx` or wherever the register form lives):
   - Add the same min-length rule to the form's zod schema.
   - Show the rule inline, not just on submit failure.
3. **Tests:**
   - **Go:** add `handle_user_create_test.go` with table-driven cases — empty body, missing email, short password, weak email, happy path.
   - **Vitest:** add a render+submit test that asserts the rule message renders for a too-short password.
   - **Playwright:** extend the existing share-link or trust-flow spec only if a register flow is already exercised; do not add a new spec for this alone.

### Verification
- `go test ./...` — green, including new register tests.
- `npm run test` — 107+ / 107+ (added 1+ vitest case).
- `npm run test:e2e` — 39 / 39 still green.
- Live smoke (after deploy): repeat the exact `curl` probes from today's QA report; expect 400 instead of 500/200 on the negative paths.

### Risk
Low. The change is additive; existing accounts and post-auth flows are untouched. The only behavioral break is for clients passing empty bodies or short passwords, which today succeed in unsafe ways.

### Estimate
Half a day to a day, including frontend + tests + deploy.

---

## Phase 2 — `make deploy` as the only path to prod

### Success condition
- A single command, `make deploy`, performs: frontend build → backend build → service restart → live smoke.
- Documentation explicitly forbids the manual `go build && sudo systemctl restart` cycle in muscle memory.
- A pre-commit or post-commit reminder surfaces if the working tree contains source changes that have not been deployed.

### Frame
Today's session showed prod ran a 2-week-stale binary because the manual loop was forgettable. The fix is not "more discipline"; it's making the discipline mechanical.

### Smallest strong move
Extend the existing `Makefile` (it already has `build` and `build-prod`) with one new target. Keep it shell-only, no new tooling. Document the smoke-check exit codes so the target fails loudly if `/api/healthz` isn't 200 within N seconds after restart.

### Implementation steps
1. **Makefile**: add target
   ```makefile
   deploy: build-frontend build
       @echo "→ restarting quantixdrive.service"
       sudo systemctl restart quantixdrive
       @sleep 3
       @curl -sf https://quantixdrive.filemonprime.net/api/healthz > /dev/null \
         && echo "✓ /api/healthz: 200" \
         || (echo "✗ /api/healthz failed"; exit 1)
       @curl -sf -o /dev/null https://quantixdrive.filemonprime.net/quantix/ \
         && echo "✓ /quantix/: 200" \
         || (echo "✗ /quantix/ failed"; exit 1)
   build-frontend:
       cd vaultdrive_client && npm run build
   ```
2. **README.md / START_HERE.txt**: replace any documented `go build && sudo systemctl restart quantixdrive` with `make deploy`. Mark the manual cycle as **deprecated for routine deploys** but kept for emergency recovery.
3. **Optional, deferrable**: a `make verify-prod` target that runs the post-deploy smoke alone, for use after pushing without rebuilding.
4. **CI**: leave the GHCR image build alone for now. A future phase can wire CI to also call `make deploy` over SSH; that needs a service account and is out of scope here.

### Verification
- Run `make deploy` at least once. Expect both smoke lines to print `✓`.
- Confirm in `journalctl -u quantixdrive -n 50` that the service restart shows up at the expected timestamp.
- Confirm `git log -1 --format=%H` matches the binary just built (sanity).

### Risk
Low — it's automation of a documented procedure. The single new external dependency is `sudo` access for the user running `make`, which already exists per the prior session.

### Estimate
Half a day, including doc updates and one round of dry-runs.

---

## Phase 3 — Coherence roadmap step 4

### Success condition
- AccessPanel and FileRequestsSection both use `<RowActionMenu>` and `<DataState>` consistently with the patterns already shipped on UploadLinkCard / UploadLinksSection.
- Empty, loading, and error states are visually consistent across all three vault sections.
- The two new vitest specs added in this session (`AccessPanel.test.tsx`, `FileRequestsSection.test.tsx`) cover the new empty/error rendering.

### Frame
The roadmap at `docs/roadmaps/2026-04-26-ui-ux-coherence-upgrade-roadmap.md` is the right list. Steps 1–3 (foundations + first adoption) are done. Step 4 is "next adoption surfaces". The dirty-tree work from this session was already in flight on AccessPanel + FileRequests; this phase finishes it.

### Smallest strong move
Don't rewrite. Replace bespoke `<DropdownMenu>` row-action wiring with `<RowActionMenu>` and bespoke loading/empty markup with `<DataState>`. Keep behavior identical; only the markup changes.

### Implementation steps
1. **AccessPanel.tsx**:
   - Replace per-row dropdown with `<RowActionMenu items={...}>`.
   - Replace any inline loading skeleton + empty `<EmptyState>` text with a single `<DataState status={status} empty={EMPTY_COPY.access_links}>`.
2. **FileRequestsSection.tsx**: same migration.
3. **constants/copy.ts**: add the missing entries for empty/error states on these two surfaces (most are already there from this session).
4. **AccessPanel.test.tsx / FileRequestsSection.test.tsx**: extend the existing specs to assert the new empty + error renderings explicitly.

### Verification
- `npm run test` green (vitest).
- `npm run test:e2e` green (Playwright).
- Visual smoke on the live URL after `make deploy`: open Access Center with no items, with one item, and with a forced API error (browser devtools); confirm the three states match UploadLinks visually.

### Risk
Low. The primitives already exist and are battle-tested on UploadLinks. Behavior parity is the bar; visual coherence is the upside.

### Estimate
One day.

---

## Phase 4 — KDF migration to Argon2id (with backward-compat)

### Success condition
- New accounts wrap the encrypted private key with **Argon2id** parameters appropriate for 2026 hardware.
- Existing accounts continue to unlock; on a successful PIN unlock, the envelope is **transparently re-wrapped** with Argon2id and persisted.
- An "envelope version" column on the relevant table records which KDF was used.
- Telemetry/log line per re-wrap, so progress is observable.

### Frame
This is architectural debt — not exploitable today without server compromise, but the source comment already calls SHA-256 wrong. Migration is non-trivial because it's invisibly mutating cryptographic envelopes for live users. Plan it carefully, ship it slowly.

### Smallest strong move
Add the version column **first**, in a no-op migration that defaults all existing rows to `kdf_version = 1` (SHA-256). Then add the Argon2id path. Do not remove the SHA-256 path yet — keep it for old envelopes until everyone has unlocked once.

### Implementation steps
1. **Migration** (`sql/schema/00046_kek_envelope_version.sql`):
   - `ALTER TABLE users ADD COLUMN kek_envelope_version INTEGER NOT NULL DEFAULT 1;`
   - sqlc regenerate.
2. **`auth/` package**: introduce `WrapPrivateKeyV2(...)` using Argon2id (parameters: m=64 MiB, t=3, p=4, salt=16 B). Keep `WrapPrivateKeyV1(...)` (SHA-256) only for the unwrap path.
3. **Register handler** (`handle_user_create.go`): use V2 for new accounts.
4. **PIN unlock handler**: after successful unwrap with V1, re-wrap with V2 and persist with `kek_envelope_version = 2`. This is the "transparent migration".
5. **Tests**:
   - **Go**: round-trip tests for both versions; migration test that an envelope persisted as V1 unwraps then upgrades cleanly.
6. **Telemetry**: log `event=kdf_migration ok user_id=...` per re-wrap.
7. **Rollout**: ship behind a feature flag (env var `KDF_V2_ENABLED=1`) for the first deploy; turn it on after a quiet period.

### Verification
- `go test ./auth/...` covers both wrap versions and the migration path.
- After deploy, watch journal for the migration log on real PIN unlocks; confirm `SELECT count(*), kek_envelope_version FROM users GROUP BY 2;` shifts toward 2 over time.

### Risk
**Medium.** Crypto migration is the kind of thing where a single off-by-one is irreversible for an account. Mitigations:
- Never delete the old envelope until the new one is persisted and re-read.
- Run the migration logic against staging with a synthesized batch of V1 envelopes first.
- Keep `KDF_V2_ENABLED=0` as a kill switch.

### Estimate
2–3 days, mostly testing and a careful staged rollout.

---

## Phase 5 — Legacy "ABRN" purge in docs

### Success condition
- `grep -rln "abrn\|ABRN" docs/` returns only references that explicitly explain the rename (e.g. one note in `CONTRIBUTING.md` or a single archival doc).
- No outdated example URLs in `docs/QUICKREF_DROP.md`, `docs/PASSWORD_PROTECTED_DROP.md`, etc.

### Frame
50 files mention the old name. Most are stale example URLs (`dev-app.filemonprime.net/abrn/...`) and migration notes. New contributors will trip on these. This is documentation hygiene, not code.

### Smallest strong move
One sweep, one commit, one PR-equivalent. Do not edit code. Do not edit migrations.

### Implementation steps
1. List the 50 files.
2. For each: rewrite example URLs to `quantixdrive.filemonprime.net/quantix/...`; rewrite "ABRN-Drive" → "QuantiX Drive".
3. Where a doc is genuinely about the old product (e.g. `06_DOMAIN_MIGRATION.md` describing the rename), keep the historical context but add a header noting the doc is archival.
4. Add a short note in `README.md` or `CONTRIBUTING.md`: *"Project was renamed from ABRN-Drive to QuantiX Drive in early 2026; some archival docs retain the old name for historical context."*

### Verification
- `grep -rln "abrn\|ABRN" docs/` returns < 5 files (allow archival entries).
- Spot-check 3 doc pages for broken example URLs.

### Risk
None. Pure docs. Reversible by `git revert`.

### Estimate
Half a day.

---

## Phase 6 — Bundle profiling + ESLint debt

### Success condition
- A documented baseline of bundle composition (which deps contribute most to `index-CBAmGtI3.js`'s 466 KB / 137 KB gzip).
- A short list (≤ 5 items) of changes that would cut the main chunk meaningfully without rewriting features.
- ESLint warnings either reduced to zero or the demoted rules are deleted from the config — no rotting middle ground.

### Frame
Bundle is borderline, not broken. ESLint debt is real but small. Both are housekeeping. Do not let them block product moves.

### Smallest strong move
Run `vite build --mode profile` (or use `rollup-plugin-visualizer`) once. Read the report. Pick the top 1–2 wins (often: a single fat dep that can be dynamic-imported, or a Radix component pulled at top level when only used in one route).

### Implementation steps
1. Add `rollup-plugin-visualizer` to `vaultdrive_client/devDependencies`. Wire it into `vite.config.ts` behind a `BUNDLE_REPORT=1` flag.
2. Run `BUNDLE_REPORT=1 npm run build` once. Save the HTML to `docs/reports/<date>-bundle-report.html`.
3. Pick the top wins; convert top-level imports to lazy where the cost/benefit is obvious.
4. Re-run `npm run build`; record before/after.
5. **ESLint:** decide — re-promote the architectural rules to errors and fix the warnings, **or** remove the rules. Pick one in the same commit. No half-state.

### Verification
- Bundle report stored in `docs/reports/`.
- `npm run build` shows a smaller main chunk (numerically — record the diff in the commit message).
- `npm run lint` either has zero warnings or no longer enforces the demoted rules.

### Risk
None for the report; lazy-import migrations can introduce visible "loading flash" on routes — manually verify the affected pages after.

### Estimate
One day.

---

## Phase 7 — Load / chaos test scaffold

### Success condition
- A single, runnable load test using `k6` or `vegeta` covering: login → upload one small encrypted blob → list files → revoke share. 50 RPS for 60 s, baseline.
- A documented number for p50 / p95 latency at that load against the live URL on this VPS.
- A "chaos" check: kill the postgres connection mid-test and confirm the service recovers without manual intervention.

### Frame
A control plane that talks about delegation and audit needs to know how it behaves under load. This phase produces *numbers*, not features. It does not aim for production-grade SLAs; it aims to know reality.

### Smallest strong move
Use `k6`. One JS file. One scenario. Run it from the same VPS to remove network noise. Capture results into `docs/reports/<date>-load-baseline.md`.

### Implementation steps
1. Add `loadtests/` with one `auth-upload-revoke.js` scenario in k6.
2. Add a `make load` target.
3. Run it once. Record numbers.
4. Optionally add a follow-up scenario per quarter.

### Verification
- Numbers exist in a doc.
- Service stayed up.

### Risk
Low if run against a non-production environment. **If run against the live URL**, do it during a quiet window and start at low RPS.

### Estimate
1–2 days for the scaffold; recurring 0 effort thereafter.

---

## Sequencing

```
Phase 1 (register patch)      →  blocks marketing the product as "secure"
        ↓
Phase 2 (make deploy)         →  blocks any further feature work cleanly
        ↓
Phase 3 (coherence step 4)    →  closes UI loop opened by ESLint cleanup
        ↓
[stop, hold, ship internally]
        ↓
Phase 4 (KDF migration)       →  do only after a quiet stretch
Phase 5 (docs purge)          →  cheap, can be slotted any time
Phase 6 (bundle + lint)       →  cheap, slotted any time
Phase 7 (load test)           →  before the next major user push
```

Phases 5 and 6 can run interleaved with phase 3 by a different operator; they touch independent files.

---

## Definition Of Done For This Plan

The plan is "done" when:
- Phases 1, 2, and 3 are landed, deployed, and verified on the live URL.
- Phase 4 is at least scaffolded behind a feature flag, with a migration shipped but not yet enabled.
- Phases 5–7 are explicitly scheduled (with operator-decided dates) or explicitly deferred with a written reason.
- This plan file is annotated, per phase, with completion date + commit SHA + verification evidence.

---

## Stop Condition

Reality is currently clean (post-closeout). This plan is the next deliberate move. It does not have to start today.

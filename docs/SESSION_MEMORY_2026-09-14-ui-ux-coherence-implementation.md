# ABRN UI/UX coherence implementation — 2026-09-14

## Objective and scope
Execute all seven roadmap steps through exactly seven distinct implementation iterations on `main`. Baseline `1f42296`. Preserve the six templates, supported crypto formats, working customer data and unrelated edits.

## Intake and files read
Read the requested Filemón philosophy brief, root/frontend README, all seven roadmap step files and index, September lint session/report, current source/tests, Playwright configuration, and Ralph/TDD/Playwright skills. Use Codex-native agents and file-backed progress because no OMX tmux runtime is attached. No separate goal was created.

## Starting state
Unrelated modified `abrndrive`, `.omc/project-memory.json`, `.omc/state/idle-notif-cooldown.json`; untracked `.agents`, `.codegraph`, `.omx`, July shared-folder note and old dist backup. Preserve them; stage only owned files.

## Execution map
Roadmap 01 access actions: iterations 1–3, 4/6 verification. Roadmap 02 transfer outcomes: iterations 2–3/6. Roadmap 03 truthful data/offline states: iterations 1–3/6. Roadmap 04 navigation/localization: iterations 1/2/5. Roadmap 05 onboarding/recovery: iterations 2/3/5. Roadmap 06 trust/help/receipts: iterations 2/5/6. Roadmap 07 release evidence/CI/runbook: all iterations, close in 7. Manual human/device gates are tracked independently; never fabricate them.

## Iteration 1 — reconnaissance and foundation (complete)
Existing reusable foundations: DataState, session vault, full-link creation/recovery, transfer state machines, row action drawers, receipts and locale resources. Fragile seams: nested layout ownership, source failures converted to empty arrays, limited-use streaming/auditing, and old key formats. Smallest safe first slice: truthful source loading plus shell/keyboard foundations and a private verification harness. Baseline: frontend 265 passed/1 skipped; lint exit 0. `go` is unavailable on PATH (exit 126), so the installed recovery toolchain is used explicitly. Initial backend attempt loaded `.env` and failed four database tests because localhost:5433 refused connections (32 pass/4 fail; no successful DB writes). `DB_URL=''` prevents dotenv fallback: 26 pass/6 explicit skips. A private socket-only PostgreSQL 16 cluster was created under this task's `.omx` evidence directory, migrated to schema 49, and all 36 backend tests then passed with its explicit connection string. Added optional LISTEN_HOST to permit a loopback-only integration backend; the existing default bind remains unchanged. Runtime bind smoke is required before closing iteration 1.


### Integration evidence and findings
- Frontend `npm run lint`: exit 0; `npm test`: exit 0, 281 passed/1 existing skip. Private `npm run build -- --outDir .omx/.../iteration-1/dist --emptyOutDir`: exit 0, including `tsc -b`.
- Backend `DB_URL='' go test -count=1 -json ./...`: exit 0 (26 pass/6 DB skips); separate private PostgreSQL schema-49 run: exit 0 (36 pass/0 skip). `go vet ./...`: exit 0.
- Private Go build initially failed VCS stamping due to repository ownership (exit 1). Supplying process-local `GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=safe.directory GIT_CONFIG_VALUE_0=/lamp/www/ABRN-Drive` fixed the build (exit 0) without changing global Git configuration.
- Loopback runtime at 127.0.0.1:8091: `/api/healthz` and `/ready` returned 200, readiness schema 49 / synthetic stored files 0. `ss` confirmed loopback-only binding. An initial `/api/readyz` probe was 404; the actual existing endpoint is `/ready`.
- External Playwright on this private runtime: `e2e/theme-visibility.spec.ts --grep 'template selection persists|Spanish phone' --workers=1`, exit 0, 2 passed. The broader initial grep also named download patterns, but matched no download test; no download coverage is claimed for that run.
- New focused tests cover independent unavailable/stale sources, real empty zero, one shell, phone destinations, palette keyboard and hidden feed. CLI external-mode config test passed; absent URL exits 2 as intended. CI now includes lint.
- Review caught a newly declared modal feed without complete focus handling; added initial focus, Tab/Shift+Tab containment, Escape and opener focus restoration. Regression went red then green. Final integrated rerun: 282 frontend tests passed/1 existing skip; lint, TypeScript/private frontend build, backend unit/vet/build and diff check all exit 0. The external-runner target guard remains a recorded iteration-6 hardening item; current browser target is verified private loopback.
- Next lens: implement usable credential-gated outbound links, recoverable transfers, first-use/recovery handoffs and truthful server-stream outcomes. Keep existing crypto formats and production data untouched.

## Iteration 2 — core implementation (complete)
Read iteration 1 findings before changing lens. Its green foundation leaves actual access/transfer completion, first-task guidance and recovery semantics weak. Reuse credential helpers, existing share endpoints, onboarding and Help; keep key formats, production service and customer data unchanged.

Backend test-first evidence: prior code produced 8 successes/access_count=8 for an eight-request one-use race; failed/short streams logged completed downloads; cancelled streams left no outcome; unavailable share inventory returned 200/[]; inactive links invented Revoked. Added deterministic row-lock race and interrupted-writer fixtures. Atomic conditional consumption now enforces active/expiry/unlock/limit at the write, with use consumed on authorized fetch. Byte-count/error-aware auditing labels interrupted streams and survives request cancellation with a bounded context; no JSON is appended to ciphertext. Inventory failures return 503; unknown inactive reason is Closed. Full private-DB suite now 46 passed, 0 skips, exit 0.

Health regression proved DB ping -1 still claimed status ok. It now reports degraded while HTTP200 still establishes API reachability; readiness remains separate. StatusPanel distinguishes responding/degraded/unknown/unreachable, handles malformed data and offers retry, with operator metrics behind admin details and no readiness scans from ordinary pages.


Further iteration-2 evidence: both file/folder revoke endpoints returned 200 for unowned IDs because UPDATE affected-row results were ignored. Red tests reproduced this; atomic owner-scoped closure now returns404, treats repeated owner revocation as already_closed and records one transition. Full private-DB suite: 48 passed/0 skipped, exit0. Stored owner files survive revocation.

Root found an additional live-code seam beyond the initial roadmap recon: Files Quick Share created and copied a bare token URL without a credential gate. It now opens the existing CreateShareLinkModal. A real browser regression failed on the old staged build because no credential field appeared; it will be rerun on iteration2. The first draft selector matched two titles and was corrected before the behavioral red run. Root wired onboarding task state into FirstTaskGuide and existing upload/receive/share actions; guidance distinguishes unknown inventory and actual stored files from button clicks. Focused FirstTaskGuide2 and StatusPanel3 tests pass. Test mock for translation defaultValue was corrected to match i18next behavior; no runtime workaround was added.

### Integrated result and next lens
- Core changes: verified full file/folder link recovery with clipboard fallback; existing Drop-manager handoff; PIN verification before link creation; recoverable public/preview/bulk/ZIP transfers; first-task onboarding and recovery states; shared logout; contextual Help and named route loading/fallback; server one-use enforcement and truthful stream audit.
- `verify-iteration.sh 2`: lint, unit, TypeScript/private frontend build, backend unit/vet/build and whitespace all exit 0. Frontend **324 passed, 0 skipped**; backend explicit-empty-DB **30 passed, 15 intentional DB skips**. Separate private PostgreSQL suite **49 passed, 0 skipped**, exit 0. See `iteration-2/checks.tsv` and command/log files.
- Private runtime switched to iteration-2 artifacts. Playwright Quick Share 1, public-transfer 3 and autofill/PIN 4 regressions: **8 passed**. Owner signup/onboarding/PIN-login initially could not launch the unavailable cached Chromium executable; config now honors an explicit installed-browser path globally (asserted by config verification). Rerun: **1 passed**, exit 0. No production/customer mutation.
- Browser proof exposed existing account/encrypted-key debug output; remove and guard in iteration 6. Iteration-2 code review found no high/critical blocker; revoke audit can be lost on cancellation after mutation, carried explicitly into iteration 3. Failed/short stream classification carried into 6.
- Remaining hardening seams: malformed/session-expiry boundaries; folder-context sharing; independent stale/error data and offline queue retention/reconciliation; ambiguous public uploads; revoke audit atomicity. Preserve crypto formats, server Drop-recovery exception and production configuration. Lane details: `.omx/.../iter2-links.md`, `iter2-transfer.md`, `iter2-guidance.md`.

Additional cold E2E TypeScript check initially exited 2: its old config omitted DOM libraries, and the visual fixture passed reducedMotion outside contextOptions. Corrected both; E2E TypeScript check and scoped ESLint exit 0. App build had already passed because it does not include this separate config. The iteration-2 commit was amended before subsequent work to include the verified correction.

## Iteration 3 — hardening and edge cases (complete)
Read the completed iteration-2 findings. Lens: partial failures, malformed/session state and races. Safest next changes: atomic revoke audit and offline mutations; retained, owner-bound pending work; independent source failures; credential/session guards; ambiguous upload recovery. Preserve existing crypto formats and production/customer state.

### Root hardening evidence (integration pending)
- Red private-DB tests reproduced revoke success without audit, offline rename surviving audit failure, missing action identity/idempotency, and public-info DB outage returned404. Mutation and audit now share SQL transactions; file/folder revocation preserves retryability if recording fails. Sync uses owner/action and file row locks, exact intent fingerprints, action-specific confirmations, 100-action/1MB bounds, and retains supported legacy callers. Current private-DB full suite: **58 passed/0 skipped**, exit0.
- Separate expiry test reproduced HTTP200 after expiry while blocked on a row lock. Claim now locks then checks wall-clock expiry; focused concurrent/expiry/offline/revoke suite with `go test -race` passed (exit0).
- Admin/audit list tests: initial HTTP503/403 no longer appear as empty lists; failed pagination retains history and retries the same offset. Four regressions red then green, exit0.
- SSE tests: late tickets after unmount/auth replacement, missing retries after ticket503 and stale-account401 handling went red then green. Hook exposes live/reconnecting/offline/paused/connecting/signed-out independently from API health. Feed labels session-limited events honestly. Eight focused hook/panel tests pass, exit0.
- An intermediate frontend typecheck encountered active agents' unfinished edits; these are not a final integration verdict. Resolve all errors before iteration commit. New browser state regressions are run against the previous build to establish red, then will be rerun after private iteration3 staging.

### Integration and independent review
- The main integration script passed lint, frontend 372 tests/0 skips, TypeScript/private build, backend unit/vet/build and whitespace. Two additional GroupDetails/IndexedDB abort tests landed afterward; a final frontend suite is running rather than assuming the old count covers them.
- Private staging browser checks: **7 passed**, exit0 (Quick Share, public transfer recovery/missing key/no automatic fetch replay, admin-source retry, visible SSE reconnect, real isolated signup/onboarding/PIN login). The two new state regressions previously failed on iteration2. Separate E2E TypeScript check exit0.
- Readiness caught an outage-test fixture cleanup defect: closing its DB handle left synthetic temporary-file rows. The test now creates no fixtures. Six exact Transfer/Fixture users from the private DB were identified and removed (the reviewer ran the old test once after the first count of five). `/ready` returned200 with schema49 and stored files0 afterward. No customer records were involved.
- Independent backend review approved transaction/idempotency/owner/version/expiry logic with no high/critical issue. Fixed its three medium findings: preserve folder-tree failure cause, return503 for downstream folder-file DB outages, reject hashes exceeding the schema's64-character limit. Added fault-injected downstream and length-bound regressions (all pass). Also removed test-goroutine FailNow by asserting collected outcomes in the test goroutine.
- Auth/link lane:45 focused tests; uploads/request inventory:29; data/offline lane:27; root admin/audit:4 and SSE/feed:9. See `iter3-auth-links.md`, `iter3-uploads.md`, `iter3-data-offline.md` under the raw evidence directory. Unknown post-send uploads are intentionally held for recipient/owner confirmation because the existing API has no immutable client upload receipt lookup; no filename-based acceptance claim is made.
- Next lens: deepen actual journey proof, particularly offline interruption/replay, first-task completion, full file/folder/Drop/request/group bytes, credential reset preserving old files, and negative states. Keep production and crypto contracts untouched; extend the existing test harness rather than add a framework.

Final iteration3 result: frontend **374 passed,0 skipped** across85 files (exit0); private PostgreSQL backend full suite with race detector **63 passed,0 skipped** (exit0); post-review Go vet/build exit0; E2E TypeScript exit0; staged browser7/7; private `/ready`200 after final backend rebuild/restart. No source files changed after the staged frontend build; two added tests were covered by the final unit rerun. Independent backend reviewer: APPROVE, no remaining high/critical/medium finding; its low test-goroutine issue was also fixed. Owned files are the source/test paths in the three lane reports plus root Go hardening/revocation/sync, admin/audit, SSE/feed, the new browser state regression, and this session log.

## Iteration 4 — test depth (pending)

## Iteration 5 — UX/product coherence (pending)

## Iteration 6 — security, resilience and observability (pending)

## Iteration 7 — polish, verify and close (pending)

## Evidence and remaining gates
Raw logs and private build outputs: `.omx/reports/coherence-implementation-2026-09-14/`. Each iteration records exact commands, exit codes, results, fixes, changed files, lessons and next lens below. No global memory files or production data are changed. Five-person trials, physical devices/passkeys, reboot/restore and privileged backend deployment require separate evidence where unavailable.

Iteration 1 owned files: main.go; CI and trust-proof workflows; Playwright config/external runner/config verifier/package script; Access Center, Dashboard, Profile, Admin Tests, Help; mobile navigation, command palette, activity drawer; six new focused test files; this log. Unrelated starting dirt remains preserved.

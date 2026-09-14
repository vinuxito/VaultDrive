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

## Iteration 2 — core implementation (pending)

## Iteration 3 — hardening and edge cases (pending)

## Iteration 4 — test depth (pending)

## Iteration 5 — UX/product coherence (pending)

## Iteration 6 — security, resilience and observability (pending)

## Iteration 7 — polish, verify and close (pending)

## Evidence and remaining gates
Raw logs and private build outputs: `.omx/reports/coherence-implementation-2026-09-14/`. Each iteration records exact commands, exit codes, results, fixes, changed files, lessons and next lens below. No global memory files or production data are changed. Five-person trials, physical devices/passkeys, reboot/restore and privileged backend deployment require separate evidence where unavailable.

Iteration 1 owned files: main.go; CI and trust-proof workflows; Playwright config/external runner/config verifier/package script; Access Center, Dashboard, Profile, Admin Tests, Help; mobile navigation, command palette, activity drawer; six new focused test files; this log. Unrelated starting dirt remains preserved.

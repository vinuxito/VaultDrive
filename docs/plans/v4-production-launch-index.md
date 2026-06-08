# QuantiX Drive — Production Launch Plan v4

**Date:** 2026-05-23  
**Supersedes:** [v3 hackathon plan](./v3-hackathon-index.md) → [v2](./2026-05-22-hackathon-index.md) → [v1](./2026-05-21-hackathon-index.md)  
**Operator:** Victor (vinuxito)  
**Mission:** Ship production. Make it undeniable. Make it feel like it cost six figures.

> **Rule:** All changes go to both **QuantiX Drive** and **ABRN Drive** unless explicitly stated otherwise.

---

## Where We Stand (Verified 2026-05-23 09:00 CST)

| Surface | State | Evidence |
|---|---|---|
| Go backend | ✅ Compiles, tests pass, rate-limited, i18n-aware | `go vet ./...` + `go test -race ./...` clean |
| React frontend | ✅ 116 vitest (31 files, 1 skipped) | `npx vitest run` — 0 failures |
| TypeScript | ✅ Zero errors | `npx tsc --noEmit` clean |
| Production build | ✅ 2383 modules, 23 assets, 21s | `npm run build` exit 0 |
| Playwright E2E | ✅ **42/42 passed (3.2m)** | Full green bar, webServer auto-bootstraps |
| QuantiX prod | ✅ Healthy | `quantixdrive.filemonprime.net` — healthz 200, SPA 200 |
| ABRN prod | ✅ Healthy | `abrndrive.filemonprime.net` — healthz 200, SPA 200 |
| Database isolation | ✅ Verified | QuantiX: `quantixdrive` on 5433, ABRN: `vaultdrive` on 5433 |
| E2E database | ✅ Clean | `vaultdrive_playwright` on 5432, 45 migrations applied |
| Git | ✅ Clean | `main` at `28e068e`, pushed to origin |
| Themes | ✅ 6 skins, WCAG AA | Dark skin contrast 4.91:1 verified |
| i18n | ⚠️ EN/ES framework complete, ~50 hardcoded strings remain | UX audit identified bypass of `t()` system |
| Argon2id KDF | ✅ Enabled, v2 envelope | Frontend + backend synced |
| Command Palette | ✅ Cmd+K, spring physics | Missing: file search, Help link |
| SWR | ✅ `/api/files` only | `sharedFiles`, `folders`, `dropTokens` still manual fetch |
| Bundle | ⚠️ 468 KB main chunk (143 KB gzip) | Could be smaller with deeper splitting |

---

## The Philosophy

> "The app should feel like it was always there."

We are not building features. We are building **trust at first touch**:

```
[0–200ms]  The skeleton already matches your theme.
[200ms–1s] The dashboard loads with staggered card animations.
[1–3s]     You hover a sidebar link and the data is already prefetched.
[3–10s]    You upload a file and watch encryption happen in real-time.
[10–30s]   You share it. The URL proves zero-knowledge.
[30–60s]   You pull out your phone. It's the same experience.
[∞]        You check the audit log. Every action has a receipt.
```

This plan takes us from "hackathon winner" to "production product."

---

## Phase Index

### Phase I — Foundation Verified ✅

*"Before we build anything new, prove what exists."*

| # | Step | Status | What it delivers |
|---|------|--------|------------------|
| 1 | [E2E Infrastructure Restoration](./v4-step-01-e2e-infrastructure.md) | ✅ DONE | 42/42 Playwright, auto-bootstrap, no manual setup |
| 2 | [ABRN Schema Sync](./v4-step-02-abrn-schema-sync.md) | ✅ DONE | 8 pending migrations applied, login restored |
| 3 | [Unit Test Stabilization](./v4-step-03-unit-test-stabilization.md) | ✅ DONE | testTimeout fix, 31/31 pass + 1 skipped |

### Phase II — Undeniable UX ✅

*"Make the user forget they're using a web app."*

| # | Step | Status | What it delivers |
|---|------|--------|------------------|
| 4 | [Command Palette — Cmd+K](./v4-step-04-command-palette.md) | ✅ DONE | Spotlight-like navigation, spring physics, glassmorphic |
| 5 | [SWR Optimistic UI](./v4-step-05-swr-optimistic-ui.md) | ✅ DONE | Zero-latency file operations, cache revalidation |
| 6 | [Hover Prefetch — Instant Navigation](./v4-step-06-hover-prefetch.md) | ✅ DONE | Data + chunk preloading on hover, feels teleporting |
| 7 | [Framer Motion Page Transitions](./v4-step-07-page-transitions.md) | ✅ DONE | AnimatePresence, spring modals, layout animations |

### Phase III — Production Polish 🔧

*"The last 10% that makes it feel like a funded startup."*

| # | Step | Status | What it delivers |
|---|------|--------|------------------|
| 8 | [i18n Completion](./v4-step-08-i18n-completion.md) | 🔲 TODO | Zero hardcoded English, full ES-MX coverage |
| 9 | [SWR Everywhere](./v4-step-09-swr-everywhere.md) | 🔲 TODO | Every endpoint cached, optimistic, prefetched |
| 10 | [Command Palette v2 — File Search + Full Coverage](./v4-step-10-command-palette-v2.md) | 🔲 TODO | Search files, Help link, admin shortcuts |

### Phase IV — Production Hardening 🔒

*"The things that keep you sleeping at night."*

| # | Step | Status | What it delivers |
|---|------|--------|------------------|
| 11 | [Security Headers & CSP](./v4-step-11-security-headers.md) | ✅ DONE | CSP, HSTS, X-Frame-Options, Referrer-Policy, Permissions-Policy |
| 12 | [Rate Limiting & Abuse Prevention](./v4-step-12-rate-limiting.md) | ✅ DONE | Register 5/min, drop upload 20/min, login 10/min, PIN 5/min |
| 13 | [Database Backup & Recovery](./v4-step-13-backup-recovery.md) | ✅ DONE | scripts/backup.sh, restore runbook, 30-day retention |

### Phase V — Performance & Lighthouse 🚀

*"Lighthouse 90+ or it didn't ship."*

| # | Step | Status | What it delivers |
|---|------|--------|------------------|
| 14 | [Bundle Diet v2 — Below 300KB](./v4-step-14-bundle-diet-v2.md) | 🔲 TODO | Deeper code splitting, tree shaking, lazy i18n |
| 15 | [Core Web Vitals](./v4-step-15-core-web-vitals.md) | 🔲 TODO | LCP < 2.5s, INP < 200ms, CLS < 0.1 |
| 16 | [Asset Pipeline & CDN](./v4-step-16-asset-pipeline.md) | ⚠️ PARTIAL | Immutable cache headers for hashed assets, no-cache for HTML |

### Phase VI — DevOps & CI/CD 🏗️

*"If it's not automated, it's not real."*

| # | Step | Status | What it delivers |
|---|------|--------|------------------|
| 17 | [GitHub Actions — Test Pipeline](./v4-step-17-github-actions.md) | ✅ EXISTS | CI workflow already present: go vet/test, tsc, vitest, build, Docker |
| 18 | [Automated Deployment](./v4-step-18-automated-deploy.md) | ✅ DONE | scripts/deploy.sh quantix\|abrn\|both with version injection |
| 19 | [Monitoring & Health Dashboard](./v4-step-19-monitoring.md) | ⚠️ PARTIAL | healthz returns version + uptime; external monitoring pending |

### Phase VII — API & Documentation 📖

*"If an engineer can't onboard in 30 minutes, the docs failed."*

| # | Step | Status | What it delivers |
|---|------|--------|------------------|
| 20 | [OpenAPI Specification](./v4-step-20-openapi.md) | 🔲 TODO | Full REST API spec, Swagger UI, auto-generated clients |
| 21 | [Production Launch Checklist](./v4-step-21-launch-checklist.md) | 🔲 TODO | DNS, SSL, CDN, backup, rollback, monitoring, go/no-go |

---

## Sequencing & Dependency Graph

```
  PHASE I — FOUNDATION ✅ ────────────────────────────────
  Step 1 (E2E) ✅ → Step 2 (ABRN sync) ✅ → Step 3 (unit tests) ✅
                                                    │
  PHASE II — UX ✅ ──────────────────── ┬──── ┬──── │
              Step 4 ✅  Step 5 ✅  Step 6 ✅  Step 7 ✅
                         │
  ┌──────────────────────┘
  │  ★ CURRENT CHECKPOINT ★
  │  Everything above is verified and shipped.
  │  Everything below is the production launch roadmap.
  └──────────────────────┐
                         │
  PHASE III — POLISH ── ┬ │ ──── ┬──── ┬──────────────────
             Step 8      Step 9     Step 10
             (i18n)      (SWR)      (Cmd+K v2)
                         │
  PHASE IV — HARDEN ── ┬ │ ──── ┬──── ┬──────────────────
            Step 11     Step 12     Step 13
            (CSP)       (rate lim)  (backups)
                         │
  PHASE V — PERF ───── ┬ │ ──── ┬──── ┬──────────────────
            Step 14     Step 15     Step 16
            (bundle)    (CWV)       (CDN)
                         │
  PHASE VI — CI/CD ─── ┬ │ ──── ┬──── ┬──────────────────
            Step 17     Step 18     Step 19
            (GH Actions)(deploy)    (monitor)
                         │
  PHASE VII — DOCS ─── ┬ │ ──── ┬────────────────────────
            Step 20     Step 21
            (OpenAPI)   (launch checklist)
                         │
         ┌───────────────┘
         │
    ★ LIVE. PRODUCTION. UNDENIABLE. ★
```

---

## Invariants (Must Hold True Through Every Step)

1. **Zero-knowledge boundary** — The server never sees plaintext. This is the product's soul.
2. **Tests stay green** — 116+ vitest, 42+ Playwright, `go test ./...` pass. No step lands with a broken test.
3. **Both drives stay synced** — Every code change goes to QuantiX Drive AND ABRN Drive. Every migration runs on both databases.
4. **Every step ships independently** — Each step is committed separately and can be deployed without the next one.
5. **Evidence-based** — Every step has verification, commit hashes, and measured results.
6. **Production deployed** — Both QuantiX and ABRN deployed and smoke-tested after every phase.
7. **No momentum** — Before each step, verify the previous step is actually done. No assumptions.

---

## History

| Version | Date | Focus | Steps |
|---------|------|-------|-------|
| v1 | 2026-05-21 | Hackathon sprint (8 steps) | [Index](./2026-05-21-hackathon-index.md) |
| v2 | 2026-05-22 | Expanded to 12 steps | [Index](./2026-05-22-hackathon-index.md) |
| v3 | 2026-05-22 | All 12 done, victory lap | [Index](./v3-hackathon-index.md) |
| **v4** | **2026-05-23** | **Production launch — 21 steps, 7 phases** | **This file** |

---

## Definition of Done — Production Launch

| Criterion | Status |
|-----------|--------|
| Phase I–IV landed, deployed, verified (Steps 1–13) | 10/13 |
| Phase IV security hardening complete (Steps 11–13) | ✅ 3/3 |
| Lighthouse Performance score ≥ 90 (Steps 14–16) | ⚠️ Cache headers done, rest pending |
| CI/CD pipeline automated (Steps 17–18) | ✅ CI exists + deploy.sh done |
| Monitoring and alerting live (Step 19) | ⚠️ healthz enhanced, UptimeRobot pending |
| OpenAPI spec published (Step 20) | 🔲 |
| Launch checklist executed (Step 21) | 🔲 |
| Both platforms deployed and smoke-tested | ✅ (continuous) |
| Zero hardcoded English strings | 🔲 |
| E2E: 42+ passed | ✅ |
| Bundle main chunk < 300KB gzip | 🔲 |
| All databases backed up with tested restore | ✅ scripts/backup.sh + restore runbook |

> The customer opens the app and thinks: *"This is not a side project."*

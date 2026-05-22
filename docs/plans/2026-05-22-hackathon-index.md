# QuantiX-Drive — Hackathon Domination Plan v2

**Date:** 2026-05-22  
**Supersedes:** [2026-05-21-hackathon-index.md](./2026-05-21-hackathon-index.md)  
**Source:** [Architect Review](../reports/2026-05-21-architect-review.md)  
**Operator:** Victor (vinuxito)  
**Mission:** Win the hackathon. Make the experience undeniable. Make the judges question their reality.

---

## The Philosophy

> "The app should feel like it already knew what you wanted."

We are not building a feature demo. We are building a **60-second emotional arc**. The judge's brain goes through these stages:

```
[0-5s]   "That looks expensive."        → Landing page hero
[5-15s]  "Wait, it actually works?"     → Instant registration + onboarding
[15-30s] "Holy shit, that's fast."      → File upload with live encryption proof
[30-45s] "Can I actually verify this?"  → Share link + zero-knowledge proof footer
[45-55s] "They thought of everything." → Mobile responsive + theme switch + i18n
[55-60s] "How is this a hackathon?"    → PWA install prompt + agent API demo
```

Every step in this plan maps to one of those emotional beats. If a step doesn't move a judge's perception, it gets cut.

---

## Current Reality (Verified 2026-05-22)

| Surface | State | Evidence |
|---|---|---|
| Go backend | ✅ Compiles, tests pass, rate-limited, i18n-aware | `go test ./...` green |
| React frontend | ✅ 116/116 vitest, production build clean | `npm run test` |
| Playwright E2E | ✅ **41/41** across 11 spec files | Restored via `.env.test` fix (`e282219`) |
| Themes | ✅ 6 skins, CSS-variable driven, FOUC-free | Manual verification |
| i18n | ✅ EN/ES-MX, deep-merge downstream overlays | E2E i18n layout tests pass |
| Agent API Keys | ✅ Scoped, revocable, last-used tracking | E2E agent lifecycle tests pass |
| Landing page | ✅ Animated hero + encryption trust signal | Commit `aff37ae` |
| Perception speed | ✅ Prefetch + staggered cards + theme-aware loader | Commit `a4ac4eb` |
| Button feedback | ✅ Global `active:scale(0.97)` | CSS in `elegant-complete.css` |
| E2E infra | ✅ `.env.test` decouples test branding from prod | Commit `e282219` |
| Bundle size | ⚠️ 533 KB main chunk (160 KB gzip) | Build output |
| KDF | ⚠️ Single-round SHA-256 (should be Argon2id) | `handle_user_create.go:173` |
| Docs legacy | ⚠️ 53 files still reference "ABRN" | `grep -rl` count |

---

## Step Index

Each step is a self-contained markdown file. Steps are ordered by **demo impact** — the sequence a judge experiences, not engineering complexity.

### Act I — First Impression (0–5 seconds)

| # | Step | File | Priority | Status | What it delivers |
|---|------|------|----------|--------|------------------|
| 1 | [Perception Speed — Make It Feel Instant](./2026-05-22-step-01-perception-speed.md) | step-01 | 🔴 Critical | ✅ DONE | Sub-200ms perceived load, prefetch, staggered animations |
| 2 | [Landing Page — The 5-Second Wow](./2026-05-22-step-02-landing-wow.md) | step-02 | 🔴 Critical | ✅ DONE | Animated hero, encryption trust signal, scroll-triggered features |

### Act II — The Power Demo (5–30 seconds)

| # | Step | File | Priority | Status | What it delivers |
|---|------|------|----------|--------|------------------|
| 3 | [Demo Golden Path — 60-Second Story](./2026-05-22-step-03-demo-flow.md) | step-03 | 🔴 Critical | 🔲 TODO | Register → Upload → Share → Verify in under 60 seconds |
| 4 | [Live Crypto Proof — Show, Don't Tell](./2026-05-22-step-04-crypto-proof.md) | step-04 | 🔴 Critical | 🔲 TODO | Real-time encryption visualization during upload |

### Act III — The Polish That Separates Winners (30–55 seconds)

| # | Step | File | Priority | Status | What it delivers |
|---|------|------|----------|--------|------------------|
| 5 | [Micro-Animations & Tactile Soul](./2026-05-22-step-05-micro-animations.md) | step-05 | 🟡 High | ⚡ PARTIAL | Modal slide-ups, toast animations, theme transitions |
| 6 | [Mobile — Judge Pulls Out Phone](./2026-05-22-step-06-mobile-polish.md) | step-06 | 🟡 High | 🔲 TODO | 375px perfection, PWA install, bottom nav |
| 7 | [Accessibility & Reduced Motion](./2026-05-22-step-07-accessibility.md) | step-07 | 🟡 High | 🔲 TODO | WCAG 2.1 AA, keyboard nav, screen reader labels |

### Act IV — Technical Credibility (Judge Reviews Code)

| # | Step | File | Priority | Status | What it delivers |
|---|------|------|----------|--------|------------------|
| 8 | [Bundle Diet & Lighthouse 95+](./2026-05-22-step-08-bundle-diet.md) | step-08 | 🟡 High | 🔲 TODO | Break the 533 KB chunk, target Lighthouse 95+ |
| 9 | [Cryptographic Hardening (Argon2id)](./2026-05-22-step-09-kdf-hardening.md) | step-09 | 🟢 Important | 🔲 TODO | Close the last honest security gap |

### Act V — The Final Edge

| # | Step | File | Priority | Status | What it delivers |
|---|------|------|----------|--------|------------------|
| 10 | [Demo Script & Video](./2026-05-22-step-10-demo-script.md) | step-10 | 🔴 Critical | 🔲 TODO | Rehearsal script, 90-second narrated recording |
| 11 | [Documentation & Legacy Cleanup](./2026-05-22-step-11-docs-cleanup.md) | step-11 | 🟢 Important | 🔲 TODO | 53 stale ABRN references → clean repo |
| 12 | [README — The Repository's Landing Page](./2026-05-22-step-12-readme.md) | step-12 | 🟡 High | 🔲 TODO | A README so good the judge stars the repo |

**Effort key:** S = half day, M = 1 day, L = 2–3 days

---

## Sequencing & Dependency Graph

```
                    ┌───────────────────────────────────────────────┐
                    │           ACT I: FIRST IMPRESSION             │
                    │                                               │
                    │   Step 1 (perception) ────✅ DONE             │
                    │        ↓                                      │
                    │   Step 2 (landing)    ────✅ DONE             │
                    └─────────────┬─────────────────────────────────┘
                                  │
                    ┌─────────────▼─────────────────────────────────┐
                    │           ACT II: POWER DEMO                  │
                    │                                               │
                    │   Step 3 (golden path) ──→ demo polish        │
                    │        ↓                                      │
                    │   Step 4 (crypto proof)──→ the mic drop       │
                    └─────────────┬─────────────────────────────────┘
                                  │
              ┌───────────────────┼───────────────────┐
              │                   │                   │
    ┌─────────▼──────┐  ┌────────▼────────┐  ┌───────▼──────────┐
    │  Step 5         │  │  Step 6          │  │  Step 7           │
    │  (animations)   │  │  (mobile)        │  │  (accessibility)  │
    │  ACT III        │  │  ACT III         │  │  ACT III          │
    └─────────┬──────┘  └────────┬────────┘  └───────┬──────────┘
              │                  │                    │
              └──────────────────┼────────────────────┘
                                 │
                    ┌────────────▼──────────────────────────────────┐
                    │  [STOP — you can demo now and probably win]   │
                    └────────────┬──────────────────────────────────┘
                                 │
              ┌──────────────────┼───────────────────┐
              │                  │                   │
    ┌─────────▼──────┐  ┌───────▼────────┐  ┌───────▼──────────┐
    │  Step 8          │  │  Step 9         │  │  Step 10          │
    │  (bundle diet)   │  │  (KDF)          │  │  (demo video)     │
    │  ACT IV          │  │  ACT IV         │  │  ACT V            │
    └────────────────┘  └────────────────┘  └────────┬─────────┘
                                                      │
              ┌───────────────────────────────────────┼────────┐
              │                                       │        │
    ┌─────────▼──────┐                       ┌────────▼──────┐ │
    │  Step 11         │                       │  Step 12       │ │
    │  (docs cleanup)  │                       │  (README)      │ │
    │  ACT V           │                       │  ACT V         │ │
    └────────────────┘                       └───────────────┘ │
                                                               │
                    ┌──────────────────────────────────────────▼┐
                    │  DONE — SHIP IT. UNDENIABLE.              │
                    └──────────────────────────────────────────┘
```

**Key rules:**
- Steps 1–2 are ✅ done. Never touch them again unless something breaks.
- Steps 3–4 are sequential — the crypto proof enhances the demo flow.
- Steps 5–7 are parallel — they polish different surfaces independently.
- Steps 8–12 can run in any order after the demo is locked.
- **After Step 7, you can demo and probably win.** Everything after is insurance.

---

## Invariants (Must Remain True Through Every Step)

1. **Zero-knowledge boundary** — The server never sees plaintext. Period. This is the product's soul.
2. **Tests stay green** — 116/116 vitest, 41/41 Playwright, `go test ./...` pass. No exceptions.
3. **No new features** — We are polishing what exists, not adding scope. The one exception is Step 4 (crypto proof), which is a *visualization* of an existing feature, not a new feature.
4. **Every step ships independently** — If we stop after Step 4, we can still demo. If we stop after Step 7, we probably win. If we complete all 12, they'll think it's a funded startup.
5. **Evidence-based** — Every step ends with a verification section, an evidence log, and measured results. No "I think it works."
6. **Downstream-safe** — Every change must merge cleanly into ABRN-Drive. The `.env.test` pattern ensures E2E stability across brands.

---

## Definition of Done

The plan is "done" when:
- Steps 1–7 are landed, deployed, and verified.
- The app can be demoed in under 60 seconds with zero preparation.
- A judge can open it on their phone and feel the same quality.
- A judge can review the repo and find clean code, good tests, and honest docs.
- The experience is undeniable.

The plan is "legendary" when:
- Steps 1–12 are complete.
- A 90-second narrated demo video exists.
- The README makes someone star the repo before they clone it.
- The Lighthouse score is 95+.
- The KDF is Argon2id.
- And the judge asks: *"Are you sure this was built in a hackathon?"*

---

## What Changed From v1

| Aspect | v1 (2026-05-21) | v2 (2026-05-22) |
|--------|-----------------|-----------------|
| Steps | 8 | 12 (4 new high-impact steps) |
| Completed steps | 0 | 2 fully done, 1 partial |
| Evidence logs | Empty | Filled with commit hashes and dates |
| New: Crypto Proof | Not in plan | Step 4 — live encryption visualization |
| New: Accessibility | Not in plan | Step 7 — WCAG 2.1 AA compliance |
| New: Demo Video | Not in plan | Step 10 — 90-second narrated recording |
| New: README | Not in plan | Step 12 — the repo's own landing page |
| Narrative arc | Linear checklist | 5-act emotional journey |
| Dependency graph | Linear | Parallel-ready after Act II |
| Micro-animations | Separate step | Merged with existing CSS work, marked partial |
| E2E stability | Broken (34/41) | Fixed via `.env.test` (`e282219`) |

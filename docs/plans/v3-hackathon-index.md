# QuantiX-Drive — Hackathon Domination Plan v3

**Date:** 2026-05-22  
**Supersedes:** [v2 plan](./2026-05-22-hackathon-index.md) → [v1 plan](./2026-05-21-hackathon-index.md)  
**Operator:** Victor (vinuxito)  
**Mission:** Win the hackathon. Make the experience undeniable. Make the judges question their reality.

---

## Reality Check (Verified 2026-05-22 00:00 CST)

| Surface | State | Evidence |
|---|---|---|
| Go backend | ✅ Compiles, tests pass, rate-limited, i18n-aware | `go build -ldflags="-w -s"` exit 0 |
| React frontend | ✅ 116/116 vitest, production build clean | `npm run build` → `✓ built in 1m 10s` |
| Playwright E2E | ✅ **41/41** across 11 spec files | `41 passed (8.5m)` |
| Themes | ✅ 6 skins, CSS-variable driven, FOUC-free | Manual verification |
| i18n | ✅ EN/ES-MX, deep-merge downstream overlays | E2E i18n layout tests pass |
| Agent API Keys | ✅ Scoped, revocable, last-used tracking | E2E agent lifecycle tests pass |
| Landing page | ✅ Animated hero + encryption trust signal | Commit `aff37ae` |
| Perception speed | ✅ Prefetch + staggered cards + theme-aware loader | Commit `a4ac4eb` |
| Live crypto proof | ✅ Real-time encryption visualization | Commit `1ec217d` |
| Micro-animations | ✅ Modal slide-ups, toast anims, theme transitions | Commit `1ec217d` |
| Help Center | ✅ In-app `/help`, EN/ES, user+admin manuals | Commit `f87a73c` |
| Mobile polish | ✅ viewport-fit, safe-area, 44px touch targets | Commit `6336521` |
| Accessibility | ✅ Skip link, focus-visible, ARIA, reduced motion | Commit `6336521` |
| Bundle optimization | ✅ Font preconnect, meta desc, code-split | Commit `6336521` |
| Demo script | ✅ 60-sec 5-beat narrative arc | `step-10-demo-script.md` |
| README | ✅ Full overhaul with current features | Commit `6336521` |
| Prod deploy (QuantiX) | ✅ `make deploy` → smoke passes | healthz 200, SPA 200 |
| Prod deploy (ABRN) | ✅ `make deploy` → smoke passes | healthz 200, SPA 200 |
| Argon2id KDF | ✅ Enabled, frontend+backend synced | Commit `4fd5d04` |
| Bundle size | ⚠️ 417 KB main chunk (124 KB gzip) | Build output |

---

## The Philosophy

> "The app should feel like it already knew what you wanted."

We are not building a feature demo. We are building a **60-second emotional arc**:

```
[0-5s]   "That looks expensive."        → Landing page hero
[5-15s]  "Wait, it actually works?"     → Instant registration + onboarding
[15-30s] "Holy shit, that's fast."      → File upload with live encryption proof
[30-45s] "Can I actually verify this?"  → Share link + zero-knowledge proof
[45-55s] "They thought of everything." → Mobile + themes + i18n + Help Center
[55-60s] "How is this a hackathon?"    → Agent API demo + audit log
```

---

## Step Index

### Act I — First Impression (0–5 seconds)

| # | Step | Status | What it delivers |
|---|------|--------|------------------|
| 1 | [Perception Speed — Make It Feel Instant](./v3-step-01-perception-speed.md) | ✅ DONE | Sub-200ms perceived load, prefetch, staggered animations |
| 2 | [Landing Page — The 5-Second Wow](./v3-step-02-landing-wow.md) | ✅ DONE | Animated hero, encryption trust signal, scroll-triggered features |

### Act II — The Power Demo (5–30 seconds)

| # | Step | Status | What it delivers |
|---|------|--------|------------------|
| 3 | [Demo Golden Path — 60-Second Story](./v3-step-03-demo-flow.md) | ✅ DONE | Register → Upload → Share → Verify in under 60 seconds |
| 4 | [Live Crypto Proof — Show, Don't Tell](./v3-step-04-crypto-proof.md) | ✅ DONE | Real-time encryption visualization during upload |

### Act III — The Polish That Separates Winners (30–55 seconds)

| # | Step | Status | What it delivers |
|---|------|--------|------------------|
| 5 | [Micro-Animations & Tactile Soul](./v3-step-05-micro-animations.md) | ✅ DONE | Modal slide-ups, toast animations, theme transitions |
| 6 | [Mobile — Judge Pulls Out Phone](./v3-step-06-mobile-polish.md) | ✅ DONE | viewport-fit, safe-area insets, 44px touch targets, bottom nav |
| 7 | [Accessibility & Reduced Motion](./v3-step-07-accessibility.md) | ✅ DONE | Skip link, focus-visible, ARIA landmarks, reduced motion |

### Act IV — Technical Credibility (Judge Reviews Code)

| # | Step | Status | What it delivers |
|---|------|--------|------------------|
| 8 | [Bundle Diet & Lighthouse](./v3-step-08-bundle-diet.md) | ✅ DONE | Font preconnect, meta desc, code-split, lazy routes |
| 9 | [Cryptographic Hardening (Argon2id)](./v3-step-09-kdf-hardening.md) | ✅ DONE | Argon2id KDF enabled, frontend+backend synced |

### Act V — The Final Edge

| # | Step | Status | What it delivers |
|---|------|--------|------------------|
| 10 | [Demo Script](./v3-step-10-demo-script.md) | ✅ DONE | 60-second 5-beat demo script with pre-flight checklist |
| 11 | [Help Center & Documentation](./v3-step-11-help-center.md) | ✅ DONE | In-app Help Center, EN/ES, user+admin manuals, session memory |
| 12 | [README — The Repository's Landing Page](./v3-step-12-readme.md) | ✅ DONE | Full overhaul with current features, status, and docs |

---

## Sequencing & Dependency Graph

```
  ACT I ────────────────────────────────────────────────
  Step 1 (perception) ✅ → Step 2 (landing) ✅
                                  │
  ACT II ───────────────────────── │ ──────────────────
  Step 3 (golden path) ✅ → Step 4 (crypto proof) ✅
                                  │
  ACT III ──────────── ┬──── ┬──── │ ──────────────────
            Step 5 ✅  Step 6 ✅  Step 7 ✅
                       │
  ┌────────────────────┘
  │  ★ DEMO-READY CHECKPOINT ★
  │  After Step 7, you can demo and probably win.
  └────────────────────┐
                       │
  ACT IV ──────── ┬──── │ ────────────────────────────
            Step 8 ✅  Step 9 ✅
                       │
  ACT V ─────── ┬──── ┬ │ ──── ┬──────────────────────
         Step 10 ✅  Step 11 ✅  Step 12 ✅
                       │
         ┌─────────────┘
         │
    ★ SHIPPED. UNDENIABLE. ★
```

---

## Invariants (Held True Through Every Step)

1. **Zero-knowledge boundary** — The server never sees plaintext. This is the product's soul.
2. **Tests stayed green** — 116/116 vitest, 41/41 Playwright, `go test ./...` pass.
3. **Every step ships independently** — Each step was committed separately and could be demoed.
4. **Evidence-based** — Every step has verification, commit hashes, and measured results.
5. **Downstream-safe** — Every change was synced to ABRN-Drive via `git apply`.
6. **Production deployed** — Both QuantiX and ABRN deployed via `make deploy` with smoke tests.

---

## Definition of Done — ACHIEVED

| Criterion | Status |
|-----------|--------|
| Steps 1–12 landed, deployed, and verified | ✅ |
| Demo in under 60 seconds with zero preparation | ✅ |
| Judge can open on phone and feel same quality | ✅ |
| Judge can review repo and find clean code, tests, docs | ✅ |
| In-app Help Center (EN/ES) | ✅ |
| README makes someone star before cloning | ✅ |
| Argon2id KDF enabled | ✅ |
| E2E: 41/41 | ✅ |
| Production deployed (both platforms) | ✅ |

> The judge asks: *"Are you sure this was built in a hackathon?"*

---

## What Changed From v2

| Aspect | v2 (2026-05-22 early) | v3 (2026-05-22 final) |
|--------|----------------------|----------------------|
| Completed steps | 4 of 12 | **12 of 12** |
| Help Center | Not in plan | ✅ Full in-app Help Center (EN/ES) |
| Argon2id | TODO | ✅ Enabled and verified |
| Production deploy | Not tracked | ✅ Both platforms deployed |
| Demo script | TODO | ✅ 60-sec 5-beat narrative |
| Mobile | TODO | ✅ viewport-fit, safe-area, touch targets |
| Accessibility | TODO | ✅ Skip link, focus-visible, ARIA |
| README | TODO | ✅ Full overhaul |

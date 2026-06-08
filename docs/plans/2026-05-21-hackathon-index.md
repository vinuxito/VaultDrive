# QuantiX-Drive — Hackathon Execution Plan

**Date:** 2026-05-21  
**Source:** [2026-05-21-architect-review.md](../reports/2026-05-21-architect-review.md)  
**Operator:** Victor (vinuxito)  
**Mission:** Win the hackathon. Make the experience undeniable.

---

## The Promise

> "Fuck this dev VPS is fast as my home PC... and that's really weird but awesome..."

QuantiX-Drive must feel **instant**, **alive**, and **effortless**. Every screen must load before the user finishes clicking. Every interaction must feel like the app already knew what they wanted. The zero-knowledge encryption must be invisible — power without friction.

This is not a feature plan. This is a **perception engineering** plan. We are building the feeling of a $50M SaaS product running on one VPS.

---

## Current Reality (Verified 2026-05-21)

| Surface | State |
|---|---|
| Go backend | ✅ Compiles, tests pass, rate-limited, i18n-aware |
| React frontend | ✅ 116/116 vitest, production build clean |
| Playwright E2E | ✅ 41/41 across 11 spec files |
| Themes | ✅ 6 skins, CSS-variable driven, FOUC-free |
| i18n | ✅ EN/ES-MX, deep-merge downstream overlays |
| Agent API Keys | ✅ Scoped, revocable, last-used tracking |
| Bundle size | ⚠️ 531 KB main chunk (159 KB gzip) |
| KDF | ⚠️ Single-round SHA-256 (should be Argon2id) |
| Docs legacy | ⚠️ 53 files still reference "ABRN" |

---

## Step Index

Each step is a self-contained markdown file with full context, implementation details, verification criteria, and evidence tracking.

| # | Step | File | Priority | Effort | What it delivers |
|---|------|------|----------|--------|------------------|
| 1 | [Perception Speed — Make It Feel Instant](./2026-05-21-step-01-perception-speed.md) | step-01 | 🔴 Critical | M | Sub-200ms perceived load, skeleton states, optimistic UI |
| 2 | [Landing Page — The 5-Second Wow](./2026-05-21-step-02-landing-wow.md) | step-02 | 🔴 Critical | M | Hero that makes judges stop scrolling |
| 3 | [Demo Flow — The Golden Path](./2026-05-21-step-03-demo-flow.md) | step-03 | 🔴 Critical | M | Register → Upload → Share → Verify in under 60 seconds |
| 4 | [Micro-Animations & Tactile Feedback](./2026-05-21-step-04-micro-animations.md) | step-04 | 🟡 High | M | The app breathes. Every click responds. |
| 5 | [Mobile & Responsive Polish](./2026-05-21-step-05-mobile-polish.md) | step-05 | 🟡 High | S | Judge pulls out phone, app still looks $50M |
| 6 | [Bundle Diet & Performance](./2026-05-21-step-06-bundle-diet.md) | step-06 | 🟡 High | M | Break the 531 KB chunk, target <400 KB |
| 7 | [Cryptographic Hardening (Argon2id)](./2026-05-21-step-07-kdf-hardening.md) | step-07 | 🟢 Important | L | Close the last honest security gap |
| 8 | [Documentation & Legacy Cleanup](./2026-05-21-step-08-docs-cleanup.md) | step-08 | 🟢 Important | S | 53 stale ABRN references → clean repo |

**Effort:** S = half day, M = 1 day, L = 2–3 days

---

## Sequencing

```
Step 1 (speed)          →  The foundation. Nothing else matters if it's slow.
     ↓
Step 2 (landing)        →  First impression. Judges see this first.
     ↓
Step 3 (demo flow)      →  The pitch path. This is what we rehearse.
     ↓
Step 4 (animations)     →  Polish. Makes the demo feel alive.
     ↓
Step 5 (mobile)         →  Insurance. In case a judge uses their phone.
     ↓
[STOP — you can demo now]
     ↓
Step 6 (bundle)         →  Performance debt. Do after the demo is locked.
Step 7 (KDF)            →  Security debt. Ship when stable.
Step 8 (docs)           →  Hygiene. Anytime.
```

Steps 6–8 can run in parallel with each other. Steps 1–5 are sequential because each builds on the previous.

---

## Invariants (Must Remain True Through Every Step)

1. **Zero-knowledge boundary** — The server never sees plaintext. Period.
2. **Tests stay green** — 116/116 vitest, 41/41 Playwright, `go test ./...` pass.
3. **No new features** — We are polishing what exists, not adding scope.
4. **Every step ships independently** — If we stop after step 3, we can still demo.
5. **Evidence-based** — Every step ends with a verification section and measured results.

---

## Definition of Done

The plan is "done" when:
- Steps 1–5 are landed, deployed, and verified.
- The app can be demoed in under 60 seconds with zero preparation.
- A judge can open it on their phone and feel the same quality.
- The experience is undeniable.

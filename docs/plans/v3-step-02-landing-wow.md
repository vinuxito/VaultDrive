# Step 2 — Landing Page: The 5-Second Wow

**Parent:** [v3 Hackathon Index](./v3-hackathon-index.md)  
**Status:** ✅ DONE  
**Commit:** `aff37ae`  
**Deployed:** 2026-05-22

---

## Why This Matters

The landing page is the judge's first impression. It has 5 seconds to communicate:
1. This is a **security product** (not another file sharing app).
2. This is **production-grade** (not a weekend prototype).
3. The team **cares about craft** (typography, spacing, animation).

## What We Built

### 1. Animated Hero Section
Full-screen hero with `brand-hero-bg` gradient background. The `BrandLogo` renders at 128px with `drop-shadow-2xl`. Below it, a trust badge cycles through encryption primitives:

```
AES-256-GCM · client-side encryption
RSA-2048 · key exchange
Zero plaintext on server
Auditable · verifiable · open
```

Cycling is driven by `setInterval(2500ms)` with a CSS `stat-card-enter` animation for smooth crossfade.

**File:** `vaultdrive_client/src/pages/home.tsx` — lines 69-116.

### 2. Scroll-Triggered Feature Cards
Four feature cards (Zero-Knowledge Auth, Encrypt-Before-Upload, Cryptographic Sharing, Team Collaboration) use `IntersectionObserver` to fade in when they enter the viewport. Staggered by 80ms per card.

**File:** `vaultdrive_client/src/pages/home.tsx` — `useInView()` hook, lines 18-33.

### 3. Provable Security Architecture Section
A glass-panel card listing 6 verified security properties with checkmarks. This isn't marketing copy — it's a checklist of implemented, tested features.

### 4. Technology Stack Grid
Four cards showing Backend (Go, PostgreSQL, SQLC, Goose, JWT), Frontend (React 18, TypeScript, Vite, Tailwind, shadcn/ui), Security (AES-256-GCM, RSA-2048, bcrypt, rate limiting, i18n), and Developer Experience (Agent keys, 41 E2E tests, 116 unit tests, 6 themes, branding overlays).

## Verification

| Check | Result |
|-------|--------|
| Hero renders with animation | ✅ Verified |
| Trust badge cycles every 2.5s | ✅ Verified |
| Feature cards fade in on scroll | ✅ Verified |
| All 6 security properties checked | ✅ Verified |
| Landing page responsive on 375px | ✅ Grid collapses cleanly |
| E2E suite still green | ✅ 41/41 |

## Evidence

- Commit: `aff37ae` — `feat(landing): animated hero, scroll-triggered cards, encryption trust signal, rewritten copy`

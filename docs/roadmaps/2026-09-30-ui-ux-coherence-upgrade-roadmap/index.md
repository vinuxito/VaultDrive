# ABRN Drive: UI/UX Coherence Upgrade Roadmap (v14)

- **Date**: 2026-09-30 UTC
- **Scope**: `/lamp/www/ABRN-Drive/` only
- **Status**: Planning & Reconnaissance complete; proposed sequentially for execution
- **Operating Posture**: Senior Product Strategist, Technical Architect, and UX Coherence Auditor
- **Governing Doctrine**: Practical Filemón Philosophy (`FILEMON_PHILOSOPHY_STANDALONE_AGENT_BRIEF.md`) & Experiencia de Barrio Nivel Dios (`experiencia-de-barrio-nivel-dios/SKILL.md`)

---

## 1. Executive Summary & Core Intent

This roadmap charts the journey of ABRN Drive from **"working and cryptographically solid"** to **"coherent, frictionless, trustworthy, and usable by real humans without builder assistance."**

ABRN Drive's cryptographic engine (AES-256-GCM, RSA envelopes, PBKDF2/Argon2 key derivation, Golden SHA-256 seals) and mobile foundation (v13 bottom sheets, 56px FAB, indestructible rescue ledger) are proven and stable. However, real-device reconnaissance across Desktop Chrome and Native Android 13 (LineageOS 20 on Waydroid) revealed critical friction points where internal engineering artifacts leak directly into the user's face:
- Disorienting post-login routing that dumps authenticated users back onto the marketing homepage instead of their active files.
- Phantom infrastructure toasts (`"Nueva actividad: connected"`) triggered by background SSE liveness pings on every screen navigation.
- 95% unlocalized, hardcoded English copy in the Access Center with grammar bugs (`86 file s received`).
- Raw database event slugs (`folder_share_link_created`, `secure_drop_created`) in the Dashboard activity feed.
- Massive DOM node explosion on folders with 100+ files (3,400+ DOM nodes) due to redundant per-row action buttons.
- Public client collection portals (`/drop/`, `/request/`) lacking reassuring receipts (*El Recibo Sagrado*) for anxious clients on poor cellular connections.
- Ambiguity surrounding the three credential tiers (Account Password vs. Session Vault PIN vs. File Keys).

This roadmap establishes seven sequential, realistic, repo-aware upgrades that eliminate these blind spots.

---

## 2. Current-State Assessment

### 1. Strongest Areas (With Cold Evidence)
1. **Rock-Solid Test & Build Health**: The repository maintains 110 Vitest test suites (**528 of 528 tests passing**, 100% pass rate in 40.17s), strict TypeScript compilation with 0 errors across all tsconfigs, and clean Go backend contract tests (`go test -count=1 ./...` and `go vet ./...`). Production bundle compiles in 13.11s with verified SHA-256 seal `853d1ccfa87842877e70c9701f8b72bea609ead5ebff13162eefd414bcee3e81`.
2. **Stable, Observable Live Runtime**: Production backend (`abrndrive.service`) has 113+ hours of continuous uptime with zero restarts (`NRestarts=0`), sub-2MB memory footprint, 0ms local database ping latency, and clean SSL termination on Apache 2.4.
3. **Couch Ergonomics & Touch Foundations (v13)**: The primary file browsing surface now incorporates a 56px radial Floating Action Button in the bottom 40% thumb zone, native swipe-down bottom sheets, and verified touch targets $\ge 44\text{px}$.
4. **Indestructible Data Preservation**: The `rescue-ledger` utility provides an IndexedDB staging store with an automatic in-memory fallback, ensuring unsent transfers survive browser crashes, tab reloads, and offline drops.

### 2. Weak Spots & Blind Spots (Prioritized by Cognitive Friction)
1. **Infrastructure Noise Leaking to Users**: Background SSE connection handshakes emit `{event_type: "connected"}`. `dashboard-layout.tsx` treats this as user activity and displays an intrusive toast: `"Nueva actividad: connected"` every time a user switches tabs or wakes a phone.
2. **Post-Login Routing Disorientation**: Upon entering credentials on `/login`, the application redirects the user to `/` (the public landing page) rather than `/files` or their last requested route. Users are forced to manually find and click "Archivos" in the top bar.
3. **Language Inconsistency & Hardcoded Strings**: While `pages/files.tsx` has Mexican Spanish translations, `pages/access-center.tsx` has over 95% of its strings hardcoded in English (`"Folder share"`, `"Copy full link"`, `"Manage Drop route"`, `"file s received"`), alienating Spanish-speaking clients of ABRN Asesores.
4. **Raw Database Slugs in Dashboard Activity**: The Dashboard activity feed prints unformatted internal snake_case database event names (`folder_share_link_created`, `secure_drop_created`) rather than human-readable sentences (*Lenguaje de Cancha*).
5. **DOM Bloat on Large Vaults**: In `pages/files.tsx`, folders with 196 files generate over 3,400 DOM nodes because each file row renders 10 separate action buttons for hover states, creating scroll lag on budget mobile devices.
6. **Outside Sender Anxiety**: External clients dropping sensitive tax or legal documents on `/drop/:token` receive minimal post-upload feedback without an official downloadable or copyable receipt confirming reception date, time, and file hash.
7. **Three-Tier Credential Confusion**: Users confuse the master account password, the 4-digit Sovereign Session PIN, and per-link share keys.

### 3. Product Direction
ABRN Drive is a self-hosted, browser-encrypted sovereign cloud drive designed specifically for the trusted workflows of ABRN Asesores: holding confidential client files, generating expiring revocable share links, and collecting sensitive accounting and legal documents through branded drop portals. The product direction is **not** to become an enterprise collaboration suite or a generic public file host. The direction is to make sovereign client-side encryption feel completely effortless, transparent, and respectful for everyday Mexican professionals and their clients.

### 4. Momentum Check
The project recently completed:
- Service restoration & database readiness (migrations clean at version 49).
- v11 Sovereign Vault desktop interactions (cryptographic passport, Golden SHA-256 seal, route HUD).
- v12 Sovereign File Manager spatial workspace (Zen 3-way sidebar, resizable tree splitter, marquee lasso).
- v13 Experiencia de Barrio Nivel Dios (couch ergonomics, thumb-zone FAB, WhatsApp share receipt, optimistic mutations, truth states, rescue ledger).

The next logical layer is **full cross-screen coherence, elimination of developer artifacts from user views, fluid large-vault performance, and bulletproof external sender flows**.

---

## 3. Seven-Step Roadmap Overview

| Step | Title | Category | Primary Target | Expected Payoff |
|---|---|---|---|---|
| **Step 01** | [Eliminate Infrastructure Noise & Fix Entry Flow](step-01-eliminate-infrastructure-noise-and-fix-login-flow.md) | `UX / product` | `dashboard-layout.tsx`, `login.tsx` | Eradicate phantom "connected" toasts; send users straight to `/files` after login. |
| **Step 02** | [Full Barrio Localization of Access Center](step-02-localize-access-center-and-clean-share-cards.md) | `UX / product` | `access-center.tsx`, `locales/{es,en}` | 100% human Mexican Spanish; fix string glitches (`file s`); add 1-tap WhatsApp button. |
| **Step 03** | [Humanize Dashboard Activity & Action Architecture](step-03-humanize-dashboard-activity-and-action-architecture.md) | `UX / product` | `dashboard.tsx`, `locales/{es,en}` | Transform snake_case slugs into plain Spanish; replace ZK Room with everyday business tasks. |
| **Step 04** | [DOM Virtualization & Fluid Touch Performance](step-04-dom-virtualization-and-fluid-vault-performance.md) | `architecture / UX` | `FileGrid.tsx`, `files.tsx` | Shrink DOM footprint by 70% in 200+ file folders; guarantee 60fps scrolling on mobile. |
| **Step 05** | [Public Drop & Recipient Portal Hardening](step-05-public-drop-and-recipient-portal-hardening.md) | `product / UX` | `drop-upload.tsx`, `PublicSharePage.tsx` | Provide *El Recibo Sagrado* for outside clients; 1-tap offline retry on poor mobile signal. |
| **Step 06** | [Unified Credential Architecture & PIN Guidance](step-06-unified-credential-architecture-and-pin-guidance.md) | `security / UX` | `PasswordModal.tsx`, `VaultPrivacyShutter` | Visually demystify Password vs PIN vs File Key; eliminate wrong-credential lockouts. |
| **Step 07** | [Autonomous Cross-Platform Journey Verification & CI Gate](step-07-cross-platform-journey-verification-and-ci-gate.md) | `testing / observability` | `e2e/`, `.github/workflows/ci.yml` | 5 automated end-to-end user journeys; CI gate banning hardcoded unlocalized strings. |

---

## 4. Priority Analysis

### The 3 Most Urgent Upgrades
1. **Step 01 (Eliminate "Connected" Toast & Fix Login Redirect)**:
   - *Complexity*: Low (1–2 engineering hours).
   - *Impact*: Immediate, high-visibility relief. Stops annoying every user on every page load and stops confusing new logins.
2. **Step 02 (Access Center Localization & Card Polish)**:
   - *Complexity*: Medium (3–4 engineering hours).
   - *Impact*: Essential for credibility. ABRN Asesores clients expect a professional Spanish interface, not raw English boilerplate.
3. **Step 03 (Humanize Dashboard Activity & Action Cards)**:
   - *Complexity*: Medium (3–4 engineering hours).
   - *Impact*: Eliminates developer jargon from the home view; delivers true *Lenguaje de Cancha*.

### The 2 Biggest Long-Term Strategic Upgrades
1. **Step 04 (DOM Virtualization for Large Vaults)**:
   - Ensures the app scales gracefully as users accumulate thousands of encrypted documents without UI lag or memory crashes on mobile browsers.
2. **Step 05 (Public Drop Portal Hardening & El Recibo Sagrado)**:
   - External clients only interact with the Drop portal. Making that experience rock-solid, reassuring, and verifiable cements ABRN's reputation for security and care.

### What NOT to Do Yet (Explicit Non-Goals)
1. **Do NOT rebuild or replace the backend Go service**: The single-binary Go 1.24 service is rock-solid (113h uptime, 1.5MB RAM, 0ms DB latency). Keep it intact.
2. **Do NOT introduce a second UI framework or styling library**: Tailwind CSS v4 + shadcn/ui + CSS variables are well-established. Do not install additional heavyweight UI packages.
3. **Do NOT build public marketplace, billing, or multi-tenant SaaS features**: ABRN Drive is an internal and client-facing secure drive for ABRN Asesores.
4. **Do NOT alter historical cryptographic invariants or Golden Seals**: Keep PBKDF2/Argon2 key wrapping and client-side AES-GCM exact formats unchanged.

---

## 5. Recommended Execution Order & Commit Strategy

1. **Phase 1: Quick Wins & Noise Elimination (Steps 01 & 02)**
   - Suppress SSE technical toasts.
   - Fix login redirect to `/files`.
   - Localize Access Center into natural Mexican Spanish.
   - Run Vitest + typecheck; commit: `fix(ux): eliminate phantom toasts, fix login destination, and localize access center`.
2. **Phase 2: Product Coherence & Barrio Truth (Steps 03 & 06)**
   - Humanize dashboard activity feed and replace confusing ZK Room quick action.
   - Clarify credential modal guidance (Password vs. PIN).
   - Run Vitest + typecheck; commit: `feat(ux): humanize dashboard activity and unify credential guidance`.
3. **Phase 3: High-Performance Vault & Public Portals (Steps 04 & 05)**
   - Implement DOM node reduction and CSS content-visibility on FileGrid.
   - Upgrade `/drop/:token` and `/share/:token` with verifiable receipts and retry levers.
   - Run Vitest + typecheck; commit: `perf(vault): optimize large folder dom and harden public drop receipts`.
4. **Phase 4: Autonomous Journey Verification & Closeout (Step 07)**
   - Run full 5-journey automated test suite on Desktop and Android 13 Waydroid.
   - Build production assets, calculate Golden SHA-256 seal, generate reports, update README.
   - Final closeout commit: `chore: close out v14 ui-ux coherence upgrade roadmap`.

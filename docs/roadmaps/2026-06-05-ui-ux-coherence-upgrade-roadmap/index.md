# UI/UX Coherence Upgrade Roadmap (v5) — QuantiX Drive & ABRN Drive

**Date:** 2026-06-05  
**Author:** Senior Product Strategist, Technical Architect, & UX Coherence Auditor  
**Status:** Grounded assessment and executable 7-step roadmap.  

---

## Executive Summary

QuantiX Drive is a zero-knowledge encrypted file sharing control plane. The core cryptographic, auditing, and administrative features are built and fully verified (118/118 frontend unit tests, 42/42 E2E Playwright tests passing). 

However, the user experience currently fluctuates between "technically working" and "user-friendly." This roadmap bridges that gap. It provides a grounded, 7-step implementation plan designed to establish complete visual coherence, reduce user friction, prevent support issues, and build strong cryptographic trust without requiring external developer guidance.

---

## Current-State Assessment

### 1. Product Direction
QuantiX Drive acts as a secure, zero-knowledge file control plane that handles file storage, sharing, drop portal collections, and delegated third-party/AI agent access. It serves as a reusable upstream product, which is customized by downstream overlay deployments (such as ABRN Drive) through configuration and asset overrides. The primary product goal is to provide absolute cryptographic privacy (never exposing cleartext files, keys, or authentication secrets to the server) while maintaining a premium, easy-to-use visual interface.

### 2. Momentum Check
The project recently completed **Phase II & III of the Production Launch Plan (v4)**. This delivered:
- Reusable UI coherence foundations: `<RowActionMenu>`, `<DataState>` wrappers, and `constants/copy.ts` constants.
- Dynamic English/Spanish language support with a reusable `<LanguageToggle />` component.
- A central `useToast()` state context to replace scattered browser `alert()` popups.
- Performance enhancements: SWR-based data fetching on the files list, hover prefetching for sidebar links, and smooth page transitions via Framer Motion.

The next logical layer is **architectural decoupling, mobile viewport hardening, guided onboarding, and contextual transparency (receipts/errors)**.

### 3. Strongest Areas
- **Cryptographic Trust Foundation:** Flawless client-side AES-256-GCM encryption and RSA-2048 key sharing.
- **Theming & Color Token Consistency:** Six beautiful, fully theme-aware skins with zero hardcoded hex colors, automatically supporting dark/light viewports.
- **Testing & E2E Infrastructure:** A self-bootstrapping Playwright test harness verifying 42/42 user flows end-to-end.
- **Dynamic Localization:** Fully functional EN/ES translation engine with layout toggles.

### 4. Weak Spots & Blind Spots
- **Monolithic Files Explorer (`files.tsx`):** The primary view is a single file containing over 2,100 lines of code, making it difficult to maintain and customize.
- **Missing Onboarding Hand-off:** After PIN setup, the user is left in an empty vault with no checklist guiding them to upload, share, or request files.
- **Desktop-first Action Menus on Mobile:** Inline menus and popovers clip on small screens instead of defaulting to mobile-friendly bottom drawer sheets.
- **Audit Logs in Isolation:** Critical security receipts are only available on a separate admin/settings page rather than being contextualized at the point of action.
- **Admin Panel Localization Gap:** The user list and audit logs inside `admin.tsx` remain hardcoded in English and still rely on browser-level `confirm()` dialogs.

---

## The 7-Step Upgrade Roadmap

Click on any step to view its detailed architectural plan, risk mitigation, and testable Definition of Done:

1. **[Step 1 — Decomposition of Monolithic Files Explorer (`files.tsx`)](step-01-decompress-files-explorer.md)**  
   *Category: Architecture / Developer Experience* — Splitting the massive files page into decoupled, testable sub-components.
2. **[Step 2 — Interactive "First 60 Seconds" Onboarding Guided Tour](step-02-onboarding-guided-tour.md)**  
   *Category: Product / UX* — Introducing an interactive checklist to guide new users to their first secure upload, share, and drop request.
3. **[Step 3 — Mobile Viewport Optimization & Bottom Sheets](step-03-mobile-bottom-sheets.md)**  
   *Category: UX / Observability* — Hardening layouts for small screens and replacing Radix desktop popovers with native-feeling drawer bottom sheets.
4. **[Step 4 — Contextual Activity Receipt Drawer ("What just happened")](step-04-activity-receipt-drawer.md)**  
   *Category: Observability / UX* — Surfacing real-time cryptographic audit trail receipts inside contextual slide-over drawers.
5. **[Step 5 — Universal SWR Caching & Optimistic UI for All Sharing Lists](step-05-swr-caching-optimistic-ui.md)**  
   *Category: Performance / Architecture* — Extending SWR caching and instant optimistic updates across all sharing, drop portal, and file request views.
6. **[Step 6 — Admin Panel i18n Localization & Confirmation Modals](step-06-admin-i18n-localization.md)**  
   *Category: Product / Testing* — Translating administrative tables to Spanish-MX and replacing browser-level `confirm()` dialogs with custom modal overrides.
7. **[Step 7 — Rate-Limiting UI Indicators & Client Security Hardening](step-07-rate-limiting-indicators.md)**  
   *Category: Security / UX* — Adding visual countdown timers and indicators when brute-force rate limits are triggered on auth routes.

---

## Prioritization & Strategic Planning

### The 3 Most Urgent Upgrades
1. **Step 1 — Files Explorer Decomposition:** (Complexity: Medium | Impact: High) — Essential to clean up the code before making mobile improvements.
2. **Step 3 — Mobile Bottom Sheets:** (Complexity: Medium | Impact: High) — Resolves the biggest user experience issues on small viewports.
3. **Step 2 — Onboarding Guided Tour:** (Complexity: Low-Medium | Impact: High) — Drastically reduces user drop-off on first login.

### The 2 Biggest Long-Term Strategic Upgrades
1. **Step 4 — Contextual Activity Receipt Drawer:** Pushes QuantiX's core value proposition (auditability and transparency) straight into the main user path, building long-term trust.
2. **Step 5 — Universal SWR Caching:** Ensures the application feels like a zero-latency native application rather than a sluggish web dashboard.

### What NOT to Do Yet
- **Do not introduce a global state library (Zustand/Redux):** The existing React Context meets all state needs.
- **Do not add new collaborative features (Chat/E-Signatures):** Polish the core sharing engine first.
- **Do not introduce third-party analytics trackers:** Keeps the zero-knowledge privacy boundary absolute.
- **Do not support full multi-organization routing:** Stick to single-tenant deployments.

### Recommended Execution Order
1. **Quick Win / Coherence Pass:** Step 6 (Admin i18n) & Step 7 (Rate-limiting UI).
2. **Flow Hardening & Decoupling:** Step 1 (Decompose files) & Step 5 (SWR everywhere).
3. **UX Hardening:** Step 3 (Mobile sheets) & Step 2 (Onboarding tour).
4. **observability Integration:** Step 4 (Activity receipt drawer).
5. **Testing & Verification:** Run E2E Playwright test runs, update project memory, and commit.

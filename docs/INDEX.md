# ABRN Drive — Documentation Index

Last updated: April 16, 2026 (Link flow verification and commit prep, 89/89 frontend tests, 4/4 upload-link Playwright, 3/3 share-link Playwright)

## Task Documentation

| # | Document | Summary |
|---|----------|---------|
| 01 | [Email Disabled](./01_EMAIL_DISABLED.md) | Email handlers preserved but removed from the active app |
| 02 | [PIN System](./02_PIN_SYSTEM.md) | 4-digit PIN login, PIN setup flow, dashboard banner |
| 03 | [Vault Explorer](./03_VAULT_EXPLORER.md) | Files module redesign — split-pane tree, origin badges, bulk actions |
| 04 | [RSA + PIN Sharing](./04_RSA_PIN_SHARING.md) | Zero-knowledge file sharing — every file downloadable with PIN only |
| 05 | [Bug Audit & Fixes](./05_BUG_AUDIT_AND_FIXES.md) | Full audit of the sharing implementation — 7 bugs found and fixed |
| 06 | [Domain Migration](./06_DOMAIN_MIGRATION.md) | Move to `abrndrive.filemonprime.net` — Apache vhost, SSL cert, zero downtime |
| 07 | [Files Explorer & Bulk Selection](./07_FILES_EXPLORER_BULK_SELECTION.md) | Current-view select all, stable folder IDs, nested explorer, bulk delete hardening |
| 08 | [UX Upgrade Plan V1](./08_UPGRADE_PLAN_V1.md) | Session key cache, drop portal, link management, onboarding, quick share, dashboard |
| 09 | [Security Hardening Phase 2](./09_SECURITY_HARDENING_PHASE2.md) | Zero-knowledge sealing, URL fragment keys, API auth gates, activity feed, access panel |
| 10 | [Public Share + File Requests](./10_PUBLIC_SHARE_AND_FILE_REQUESTS.md) | Info-first share page, expiry picker, inbound file request system end-to-end |
| 11 | [Trust UX, API v1, Agent Keys](./11_TRUST_API_AGENT_KEYS.md) | Trust rail, security timeline, versioned API, scoped agent API keys, audit log |
| 12 | [One-PIN Trust Flow](./12_ONE_PIN_TRUST_FLOW.md) | Enforced one-PIN owner workflow, onboarding completion, session trust reuse, and E2E verification |
| 13 | [Trust UX Hardening](./13_TRUST_UX_HARDENING.md) | Passes 1-3: trust surfaces, delegated-power receipts, sender trust boundaries, verification, Secure Drop truth alignment |
| 14 | [Visual Refinement Verification](./14_VISUAL_REFINEMENT_VERIFICATION.md) | End-to-end verification of the trust refinement pass, continuity fixes, screenshots, and safe-continuation assessment |
| 15 | [Trust Proof Harness](./15_TRUST_PROOF_HARNESS.md) | Committed Playwright trust-proof suite, self-hosted Go app verification, CI workflow, and Secure Drop sender hardening |
| 16 | [Enterprise Polish UX](./16_ENTERPRISE_POLISH_UX.md) | 7-step enterprise polish pass — dashboard clarity, progressive file cards, 3-tab settings, copy cleanup, skeleton loaders, professional public pages |
| 17 | [PIN Auth Unification](./17_PIN_AUTH_UNIFICATION.md) | 8 gaps closed — credential caching, login routing, PIN hint persistence, ShareModal/CreateShareLinkModal credential-mode detection, E2E tab navigation and text fixes |
| 18 | [Admin User Management](./18_ADMIN_USER_MANAGEMENT.md) | Admin routes wired up (were dead code), create user, reset password, reset PIN, admin toggle, bulk delete, v.cazares promoted |
| 19 | [File Sharing E2E Suite](./19_FILE_SHARING_E2E_SUITE.md) | 18 new Playwright E2E tests — file upload, share links, upload links, groups, trust UX; removeFileFromGroup bug fixed |
| 20 | [Admin Polish](./20_ADMIN_POLISH.md) | Admin error feedback, password validation alignment (6→8 chars), bulk delete limit bump (100→500) |
| 21 | [Force Password Change](./21_FORCE_PASSWORD_CHANGE.md) | Admin security gate — force users to change password on next login, 3-layer defense, private key re-encryption |
| 22 | [Drop Key Recovery](./22_DROP_KEY_RECOVERY.md) | Fix broken drop links — PIN-unwrap endpoint, reveal-key UI, missing-key error page, dead code cleanup |
| 23 | [Drop Full Cycle E2E](./23_DROP_FULL_CYCLE_E2E.md) | Full lifecycle proof — create link, client upload, owner download+decrypt, key recovery, wrong PIN |
| 24 | [Security Governance Productization](./24_SECURITY_GOVERNANCE_PRODUCTIZATION.md) | Security posture, governance settings, audit export, Access Center, lazy-loaded operator surfaces |
| 25 | [QuantiX Drive Production Deploy](./25_QUANTIXDRIVE_PRODUCTION_DEPLOY.md) | Second branded product deployment on the shared VPS and config validation hardening |
| 26 | [Link Flow UX Redesign Verification](./26_LINK_FLOW_UX_REDESIGN_VERIFICATION.md) | Protected link copy, explicit inbound vs outbound link UX, and empty-folder share handoff verification |

## Feature Docs (pre-existing)

| Document | Summary |
|----------|---------|
| [PASSWORD_PROTECTED_DROP.md](./PASSWORD_PROTECTED_DROP.md) | Secure Drop key wrapping — full spec and testing guide |
| [QUICKREF_DROP.md](./QUICKREF_DROP.md) | Secure Drop quick-reference curl commands |

## Session Notes

| Document | Summary |
|----------|---------|
| [SESSION_MEMORY_2026-03-13.md](./SESSION_MEMORY_2026-03-13.md) | Session checkpoint for the Files explorer implementation, verification, and remaining risks |
| [SESSION_MEMORY_2026-03-14.md](./SESSION_MEMORY_2026-03-14.md) | Bug fix: Share and "Create share link" buttons invisible due to opacity-0 hover-only CSS in Vault Explorer |
| [SESSION_MEMORY_2026-03-14-upgrade.md](./SESSION_MEMORY_2026-03-14-upgrade.md) | UX Upgrade Plan V1 — session key cache, drop portal, onboarding, quick share, dashboard |
| [SESSION_MEMORY_2026-03-14-phase2.md](./SESSION_MEMORY_2026-03-14-phase2.md) | Phase 2 security hardening — ZK seal, fragment keys, auth gates, activity feed, access panel |
| [SESSION_MEMORY_2026-03-14-cleanup.md](./SESSION_MEMORY_2026-03-14-cleanup.md) | Cleanup: PIN lockout, migration 029, ESLint pass, sqlc sync, build verification |
| [SESSION_MEMORY_2026-03-15.md](./SESSION_MEMORY_2026-03-15.md) | Public share UX, expiry picker, inbound file requests full build, lint cleanup |
| [SESSION_MEMORY_2026-03-15-trust-api-agents.md](./SESSION_MEMORY_2026-03-15-trust-api-agents.md) | Trust UX, API v1, scoped agent keys, ciphertext-first control plane |
| [SESSION_MEMORY_2026-03-15-pin-credential-cache.md](./SESSION_MEMORY_2026-03-15-pin-credential-cache.md) | One PIN, zero friction — session credential cache across all vault operations |
| [SESSION_MEMORY_2026-03-15-one-pin-trust-flow-verification.md](./SESSION_MEMORY_2026-03-15-one-pin-trust-flow-verification.md) | Verification pass, onboarding lifecycle fix, and end-to-end one-PIN owner-flow proof |
| [SESSION_MEMORY_2026-03-15-trust-ux-hardening.md](./SESSION_MEMORY_2026-03-15-trust-ux-hardening.md) | 3-iteration trust UX hardening — TrustRail, Timeline, AccessPanel, AgentKeys, Onboarding, bundle splitting |
| [SESSION_MEMORY_2026-03-15-trust-ux-hardening-pass2.md](./SESSION_MEMORY_2026-03-15-trust-ux-hardening-pass2.md) | 3-iteration trust UX polish pass 2 — file row calm, shimmer skeletons, relative timestamps, onboarding icons, empty states |
| [SESSION_MEMORY_2026-03-15-trust-ux-hardening-pass3.md](./SESSION_MEMORY_2026-03-15-trust-ux-hardening-pass3.md) | Pass 3 — trust receipts, delegated-power clarity, Secure Drop boundary fix, final verification snapshot |
| [SESSION_MEMORY_2026-03-16-build-verification-readme-refresh.md](./SESSION_MEMORY_2026-03-16-build-verification-readme-refresh.md) | Current-code inspection, build + browser verification, docs refresh, README truth update, commit preparation |
| [SESSION_MEMORY_2026-03-16-visual-refinement-verification.md](./SESSION_MEMORY_2026-03-16-visual-refinement-verification.md) | Final verification pass, Oracle follow-up polish fixes, docs refresh, and commit-safe checkpoint |
| [SESSION_MEMORY_2026-03-16-trust-proof-harness.md](./SESSION_MEMORY_2026-03-16-trust-proof-harness.md) | Playwright trust-proof harness, CI workflow, Secure Drop path fix, negative boundary proof, and final verification state |
| [SESSION_MEMORY_2026-03-16-live-observable-control-plane.md](./SESSION_MEMORY_2026-03-16-live-observable-control-plane.md) | 7-pass refinement turning the control plane into a live operator surface with receipts, Filemon execution, grouped timelines, trust explanations, and a calmer shell |
| [SESSION_MEMORY_2026-03-20-enterprise-polish.md](./SESSION_MEMORY_2026-03-20-enterprise-polish.md) | Enterprise polish pass — 7 steps, 14 files, 284 insertions, build and tests verified |
| [SESSION_MEMORY_2026-03-23-admin-user-management.md](./SESSION_MEMORY_2026-03-23-admin-user-management.md) | Admin user management — routes wired, CRUD + bulk delete + PIN reset + admin toggle, verification pass |
| [SESSION_MEMORY_2026-03-23-file-sharing-e2e-suite.md](./SESSION_MEMORY_2026-03-23-file-sharing-e2e-suite.md) | 7-iteration E2E loop — 18 new tests for file upload, share links, groups, trust UX |
| [SESSION_MEMORY_2026-03-23-force-password-change.md](./SESSION_MEMORY_2026-03-23-force-password-change.md) | Force password change + luxury design tokens + FK cascade fix |
| [SESSION_MEMORY_2026-03-24-drop-key-recovery.md](./SESSION_MEMORY_2026-03-24-drop-key-recovery.md) | Drop link key recovery — PIN-unwrap endpoint, reveal UI, error UX |
| [SESSION_MEMORY_2026-03-24-drop-full-cycle-e2e.md](./SESSION_MEMORY_2026-03-24-drop-full-cycle-e2e.md) | Drop full cycle E2E — 35/35 tests, full lifecycle verified |
| [SESSION_MEMORY_2026-04-07-sharing-war-room.md](./SESSION_MEMORY_2026-04-07-sharing-war-room.md) | Sharing bug war-room, trust model debugging, and production flow analysis |
| [SESSION_MEMORY_2026-04-10-security-governance-productization.md](./SESSION_MEMORY_2026-04-10-security-governance-productization.md) | Security posture, governance settings, Access Center, and operator/productization pass |
| [SESSION_MEMORY_2026-04-11-quantixdrive-deploy.md](./SESSION_MEMORY_2026-04-11-quantixdrive-deploy.md) | QuantiX Drive deploy, env validator bug, and finish-the-deploy runbook |
| [SESSION_MEMORY_2026-04-16-empty-folder-share-upload-handoff.md](./SESSION_MEMORY_2026-04-16-empty-folder-share-upload-handoff.md) | Empty-folder share handoff, latest verification sweep, and safe-to-continue checkpoint |
| [SESSION_MEMORY_2026-04-16-link-flow-verification-and-commit-prep.md](./SESSION_MEMORY_2026-04-16-link-flow-verification-and-commit-prep.md) | Current-code inspection, clipboard fallback fix, refreshed E2E proof, README/report sync, and commit-ready checkpoint |

## Quick Navigation

**I want to understand the encryption model →** [04_RSA_PIN_SHARING.md](./04_RSA_PIN_SHARING.md)

**I want to know what files were changed →** Each task doc has a "Files Changed" table at the bottom.

**I want the current security posture →** [09_SECURITY_HARDENING_PHASE2.md](./09_SECURITY_HARDENING_PHASE2.md)

**I want to understand how public sharing works →** [10_PUBLIC_SHARE_AND_FILE_REQUESTS.md](./10_PUBLIC_SHARE_AND_FILE_REQUESTS.md)

**I want the current Files explorer checkpoint →** [07_FILES_EXPLORER_BULK_SELECTION.md](./07_FILES_EXPLORER_BULK_SELECTION.md)

**I want the UX upgrade summary →** [08_UPGRADE_PLAN_V1.md](./08_UPGRADE_PLAN_V1.md)

**I want to reproduce a bug that was fixed →** [05_BUG_AUDIT_AND_FIXES.md](./05_BUG_AUDIT_AND_FIXES.md)

**I want to set up PIN login →** [02_PIN_SYSTEM.md](./02_PIN_SYSTEM.md)

**I want to use the external API or create an agent key →** [11_TRUST_API_AGENT_KEYS.md](./11_TRUST_API_AGENT_KEYS.md)

**I want to understand the agent key scopes →** [11_TRUST_API_AGENT_KEYS.md#phase-3--agent-api-keys](./11_TRUST_API_AGENT_KEYS.md#phase-3--agent-api-keys)

**I want to understand the credential cache / one-PIN flow →** [SESSION_MEMORY_2026-03-15-pin-credential-cache.md](./SESSION_MEMORY_2026-03-15-pin-credential-cache.md)

**I want the final one-PIN implementation + verification story →** [12_ONE_PIN_TRUST_FLOW.md](./12_ONE_PIN_TRUST_FLOW.md)

**I want the trust UX hardening summary →** [13_TRUST_UX_HARDENING.md](./13_TRUST_UX_HARDENING.md)

**I want the enterprise polish summary →** [16_ENTERPRISE_POLISH_UX.md](./16_ENTERPRISE_POLISH_UX.md)

**I want the admin user management summary →** [18_ADMIN_USER_MANAGEMENT.md](./18_ADMIN_USER_MANAGEMENT.md)

**I want the E2E file sharing test coverage →** [19_FILE_SHARING_E2E_SUITE.md](./19_FILE_SHARING_E2E_SUITE.md)

**I want the force password change summary →** [21_FORCE_PASSWORD_CHANGE.md](./21_FORCE_PASSWORD_CHANGE.md)

**I want to understand drop link key recovery →** [22_DROP_KEY_RECOVERY.md](./22_DROP_KEY_RECOVERY.md)

**I want the drop full cycle E2E proof →** [23_DROP_FULL_CYCLE_E2E.md](./23_DROP_FULL_CYCLE_E2E.md)

**I want the latest session context →** [SESSION_MEMORY_2026-04-16-link-flow-verification-and-commit-prep.md](./SESSION_MEMORY_2026-04-16-link-flow-verification-and-commit-prep.md)

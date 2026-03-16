# ABRN Drive — Documentation Index

Last updated: March 16, 2026 (live observable control plane completed, verified end-to-end, docs and README refreshed)

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

**I want the latest session context →** [SESSION_MEMORY_2026-03-16-live-observable-control-plane.md](./SESSION_MEMORY_2026-03-16-live-observable-control-plane.md)

# ABRN Drive — Documentation Index

Last updated: March 14, 2026

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

## Quick Navigation

**I want to understand the encryption model →** [04_RSA_PIN_SHARING.md](./04_RSA_PIN_SHARING.md)

**I want to know what files were changed →** Each task doc has a "Files Changed" table at the bottom.

**I want the current security posture →** [09_SECURITY_HARDENING_PHASE2.md](./09_SECURITY_HARDENING_PHASE2.md)

**I want the current Files explorer checkpoint →** [07_FILES_EXPLORER_BULK_SELECTION.md](./07_FILES_EXPLORER_BULK_SELECTION.md)

**I want the UX upgrade summary →** [08_UPGRADE_PLAN_V1.md](./08_UPGRADE_PLAN_V1.md)

**I want to reproduce a bug that was fixed →** [05_BUG_AUDIT_AND_FIXES.md](./05_BUG_AUDIT_AND_FIXES.md)

**I want to set up PIN login →** [02_PIN_SYSTEM.md](./02_PIN_SYSTEM.md)

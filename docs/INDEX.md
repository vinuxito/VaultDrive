# ABRN Drive — Documentation Index

Last updated: March 2026

## Task Documentation

| # | Document | Summary |
|---|----------|---------|
| 01 | [Email Disabled](./01_EMAIL_DISABLED.md) | Email handlers preserved but removed from the active app |
| 02 | [PIN System](./02_PIN_SYSTEM.md) | 4-digit PIN login, PIN setup flow, dashboard banner |
| 03 | [Vault Explorer](./03_VAULT_EXPLORER.md) | Files module redesign — split-pane tree, origin badges, bulk actions |
| 04 | [RSA + PIN Sharing](./04_RSA_PIN_SHARING.md) | Zero-knowledge file sharing — every file downloadable with PIN only |
| 05 | [Bug Audit & Fixes](./05_BUG_AUDIT_AND_FIXES.md) | Full audit of the sharing implementation — 7 bugs found and fixed |
| 06 | [Domain Migration](./06_DOMAIN_MIGRATION.md) | Move to `abrndrive.filemonprime.net` — Apache vhost, SSL cert, zero downtime |

## Feature Docs (pre-existing)

| Document | Summary |
|----------|---------|
| [PASSWORD_PROTECTED_DROP.md](./PASSWORD_PROTECTED_DROP.md) | Secure Drop key wrapping — full spec and testing guide |
| [QUICKREF_DROP.md](./QUICKREF_DROP.md) | Secure Drop quick-reference curl commands |

## Quick Navigation

**I want to understand the encryption model →** [04_RSA_PIN_SHARING.md](./04_RSA_PIN_SHARING.md)

**I want to know what files were changed →** Each task doc has a "Files Changed" table at the bottom.

**I want to reproduce a bug that was fixed →** [05_BUG_AUDIT_AND_FIXES.md](./05_BUG_AUDIT_AND_FIXES.md)

**I want to set up PIN login →** [02_PIN_SYSTEM.md](./02_PIN_SYSTEM.md)

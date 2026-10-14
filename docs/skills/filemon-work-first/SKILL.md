---
name: filemon-work-first
description: >-
  Apply the Filemón work-first pattern to ABRN-Drive (VaultDrive) operational modules
  (`/files`, `/access-center`, `/groups`, `/shared`, `/drop/:token`, `/settings`):
  compact scope, real work queue above the fold, exact cryptographic SHA-256 & preview evidence,
  authorized next action (Share, Download, Revoke, Unlock), and preserved return context for
  people and AI agents. Do not use for generic visual reskins or disconnected dashboards.
---

# Filemón Work-First — ABRN-Drive Edition

Carry the work-first operational discipline of NanoRed's `notificaciones.php` into `/lamp/www/ABRN-Drive`'s real vault pages. A person or AI agent should recognize the job, reach its first useful file/share/drop immediately without scrolling past decorative banners, inspect trustworthy SHA-256/preview evidence, understand the next permitted action, and return without losing their folder, search query, or selection.

**The principle:** maximum system capability, minimum effort for people and agents.

## The ABRN-Drive Work-First Sequence

`folder / group / vault scope → file / share link / secure drop item → exact SHA-256 & decrypted preview evidence → permitted action (Share #key / Download / Revoke / Triage Rename) → Recibo Sagrado outcome & preserved return context`

| Route | Primary Job | First Actionable Item Above the Fold | Evidence | Primary Next Action |
|---|---|---|---|---|
| `/files` | Store, find (`/`), preview, and share encrypted files | Active folder breadcrumb + `Cerebro Ciego (/)` search + first file row/card | `AES-256` badge, file size, `#tags`, `FilePreviewModal` SHA-256 seal | Upload (`Subir archivo`), Preview (`Enter`), or 1-Tap Share (`⌘S`) |
| `/access-center` | Govern outbound Share Links & inbound Secure Drops | Active/Expiring Share & Drop cards (`ShareCard`, `DropCard`) | Access count, expiry countdown, delivery-key recovery status | Copy link / WhatsApp (`MobileShareSheet`), Extend, or Instant Revoke |
| `/groups` | Coordinate shared encrypted folders & team members | Active group/folder list + member permissions | Role badge, shared file count, audit trail | Invite member, open shared folder, or revoke access |
| `/drop/:token` | External zero-friction encrypted intake | Drop uploader zone + recipient identity badge | Real-time client encryption progress + Folio certificate (`El Recibo Sagrado`) | Encrypt & deliver (`Enviar a Bóveda`) + download TXT receipt / WhatsApp share |
| `/login` | Unlock sovereign vault with Password or 4x3 PIN | 100% of inputs, PIN segmented switcher, and submit trigger above the fold (`480×960` couch-approved) | Trust pills (`🔒 Cifrado Local`, `⚡ PIN Rápido`, `🛡️ Llaves Soberanas`) | Unlock & land directly on `/files` |

Transfer these core properties across every screen:
- The selected folder, group, filter, or search query stays visible and controls the workflow.
- Opening/previewing a decrypted file (`FilePreviewModal.tsx`) and downloading the original (`streaming-decrypt.ts`) are separate, plainly named actions.
- Preparing a share link is not "Sent to recipient"; opening a preview is not "Validated by SAT".
- Returning from `FilePreviewModal`, `VaultOmnibar`, or browser Back restores the active folder, search query, and selection.

## Choose the requested mode

- **Recon:** inspect the real routes, visible behavior, source data, and
  permissions; report findings without changing code when the user says no code.
- **Plan:** map the work into sequential slices with prerequisites, files/routes,
  acceptance evidence, and recovery. If the user asks for one Markdown file per
  step, create those files and a linked index.
- **Build or repair:** implement only the authorized workflow changes, preserve
  existing business rules, and verify the actual route and its evidence/actions.
- **Review:** compare the current page and browser behavior against the pattern;
  identify which gap is proven and which remains a hypothesis.

The skill does not authorize production writes, migrations, permission changes,
uploads, imports, payments, messages, deployment, publishing, or full-suite
testing. Follow the user's explicit scope and gates.

## Apply it to an existing product

1. **Find the real workflow.** Read project instructions and current code. Map
   routes, navigation labels, roles, source records, linked evidence, and the
   actual actions. Use the current implementation and real user-provided
   examples as evidence; do not invent routes from a module-name list.
2. **Write down the work chain.** For each relevant page, identify the user's
   job, selected scope, item/owner, amount or status, source of truth, next
   allowed action, confirmed result, unresolved follow-up, and return context.
   Mark absent or uncertain data as unknown with its reason.
3. **Make the page a work destination.** Keep the page name and current scope
   compact. Put the first actionable item and its primary action in the initial
   viewport at the agreed desktop and mobile sizes. Do not make someone scroll
   past a full-screen hero, welcome copy, oversized KPI wall, or decoration to
   start the job. Long lists may scroll after the first work is visible.
4. **Make navigation and controls honest.** Keep useful options available, but
   group and name them by the job they serve; do not solve confusion by deleting
   or hiding entire areas. A card is not a button unless it actually works as
   one. Use a link for navigation, a button for an action, visible focus, and an
   adjacent explanation for disabled controls.
5. **Put evidence on the record.** A click on an amount, invoice, exception, or
   file should open the exact associated record/evidence, not a nearby summary.
   Label actions clearly (for example, “Open PDF” and “Download original”).
   Only expose formats the application can really read; never imply that a file
   was reviewed, accepted, or validated when it was only opened.
6. **Protect scope and authority.** Filters must not change batch membership
   without saying so. Every read and mutation must keep the existing
   server-side identity, tenant/company, period, and capability checks. An AI
   agent gets the same business meaning and no broader authority than a human.
7. **Preserve continuity.** Return to the same period/entity, query, filter,
   selected row, and meaningful scroll position after opening evidence or
   completing an authorized action. Do not put sensitive identifiers in URLs
   merely to make the state persistent.

## Truth and proof

- Missing, stale, pending, unsealed, or unauthorized data is not zero and is not
  complete. Show the specific state and why it cannot be used.
- An alert needs an affected record, an understandable impact, and a real next
  action. Otherwise present it as information, not urgent work.
- Show status transitions only when supported by the server's receipt or record.
  Keep prepared, sent, received, reviewed, approved, and paid distinct wherever
  the domain distinguishes them.
- Keep keyboard and pointer paths functional. Advertise only shortcuts that
  work on the current page; ensure mobile actions are reachable without hover.
- A page passes the first-view check when the current scope, first work item,
  evidence path, and primary permitted action are visible without an initial
  page scroll at the requested viewport. Verify longer content separately.

## Verify the real flow

Use the smallest checks that prove the changed behavior, followed by a live
browser walk of the actual route when access is available. Check a useful item,
an empty or unavailable state, return/reload behavior, keyboard access, and the
role boundary. Capture visual evidence when first-view fit or control clarity is
part of the claim.

Keep the walk read-only unless the user explicitly authorized a safe test
mutation. Do not approve, pay, send, import, assign, seal, or upload real
business data as a visual check. If authentication or representative evidence
is unavailable, report the affected acceptance as `NOT EVALUABLE`; do not
substitute credentials, another company/period, or invented data. Respect any
instruction to defer the full suite until the owner completes their live walk.

## Done means

A person or agent can tell, without guessing: **what scope am I in; what needs
work; why does it matter; where is the exact evidence; what can I do next; how
will I know it worked; and how do I get back?** The first useful work is
reachable immediately, visible controls work or explain why they cannot, and
the evidence and outcome remain trustworthy. Report any live, role, mobile, or
data condition that was not actually verified.

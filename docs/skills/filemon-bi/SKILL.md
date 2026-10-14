---
name: filemon-bi
description: >
  Use when ABRN-Drive (VaultDrive) or any project needs to SEE its authoritative data —
  building a read-only insight/BI/dashboard mirror (charts + tables) over sealed, versioned,
  or already-computed aggregates (`/dashboard`, `/access-center`, `/security`, `/admin`).
  Also use BEFORE vendoring any chart library (Chart.js, ECharts, Recharts) for aggregated reporting.
---

# Filemón BI — The Insight Mirror Pattern (ABRN-Drive Edition)

A BI screen that reflects **already-authoritative data**: it reads what the
system already sealed/computed and draws it. It never calculates, decides, or
writes. Core principle: **a mirror, not a calculator.**

Proven origin: NanoRed's "espejo de los cortes" (2026-10-06) — 171 checks,
10/10 mutations caught, 0 dependencies added, charts painted in ~1ms — adapted for `/lamp/www/ABRN-Drive`.

## When to use in ABRN-Drive

- Building or upgrading `/dashboard`, `/access-center`, `/security`, or `/admin` telemetry views
- Visualizing encrypted storage usage, file type distribution (`document-triage.ts`), share link activity, Secure Drop intake, or audit log history
- Aggregates exist and are already trustworthy (Go backend counts, SHA-256 verified blobs, or in-memory `VaultSearchIndex` stats)

**Not for:** exploratory analytics on raw unindexed blobs or write-back forms (those are operational workspaces, not mirrors).

## The seven rules — each one born from a real failure

| # | Rule | The failure that birthed it |
|---|---|---|
| 1 | **Read-only by construction.** No POST/PUT/DELETE handler on the mirror endpoint, no writes, no side-effect audit logs on view. If it must write, it stopped being a mirror. | Telemetry screens that mutate state are audit liabilities. |
| 2 | **The screen and the API wear the SAME gate.** Whatever auth/role opens the React route opens the Go JSON handler. Reject unauthorized roles with an honest `403`, never a lying `401`. | Shipping the UI gated while leaving `/api/*` open to lower-privilege sessions or unscoped agent tokens. |
| 3 | **`NOT_EVALUABLE`, never invented zeros.** Missing or locked zero-knowledge data renders as a labeled absence with its reason (e.g. `Bóveda bloqueada: desbloquea con tu PIN para evaluar etiquetas locales`). | A `0 archivos` or `$0.00` that means "vault is locked" or "API timed out" is a lie users act on. |
| 4 | **Paint the authoritative state.** Distinguish active shares vs. expired/revoked shares, and verified SHA-256 blobs vs. pending/aborted uploads. | Naive `COUNT(*)` includes revoked links or expired drops as "active exposure". |
| 5 | **Charts without chart libraries.** Use pure CSS/Tailwind flex/grid bars, stacked progress meters, and SVG gauges (like the Sovereign Security Defense Posture gauge in `settings.tsx`). Do not vendor Chart.js/Recharts for 10–50 data points. | 200KB of chart library bundle bloat for 12 bars is a parallel architecture, not a feature. |
| 6 | **Every chart carries its table.** The chart convinces; the accessible table/list backs it up (copyable SHA-256 hashes, timestamps, filenames, and recipients). | Charts alone hide the exact file or share link a security reviewer needs to inspect. |
| 7 | **Say the trust boundary.** Clearly distinguish server-visible metadata (ciphertext size, upload date, share access count) from browser-only zero-knowledge enrichments (`#tags`, CFDI totals, snippets in `VaultSearchIndex`). | Pretending server-side SQL knows zero-knowledge content violates `docs/trust-copy-contract.md`. |

## ABRN-Drive Mapping

| Piece | ABRN-Drive Location |
|---|---|
| **Dashboard & Security Posture** | `vaultdrive_client/src/pages/dashboard.tsx`, `vaultdrive_client/src/pages/settings.tsx` |
| **Access Center (Shares & Drops)** | `vaultdrive_client/src/pages/access-center.tsx` |
| **Client Zero-Knowledge Aggregator** | `vaultdrive_client/src/utils/vault-search-index.ts`, `vaultdrive_client/src/utils/document-triage.ts` |
| **Palette / Omnibar Wiring** | `vaultdrive_client/src/components/ui/command-palette.tsx` (`⌘K`), `VaultOmnibar.tsx` (`/`) |
| **Go Read-Only Handlers** | `cmd/vaultdrive/` & `internal/` API handlers |
| **Verification Gate** | `npm run typecheck`, targeted `npx vitest run`, `go test ./...`, `npm run build` (hold full test suite until live user walk when instructed) |


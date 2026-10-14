---
name: premium-large-data-grid
description: Design or improve beautiful, responsive grids and tables over large datasets in ABRN-Drive (VaultDrive) (`/files`, `/access-center`, `/dashboard`, `/admin`) using bounded rendering (`content-visibility: auto`), `<1.5ms` in-memory `VaultSearchIndex` filtering, progressive zero-knowledge enrichment (`enrichDocument`), marquee selection (`useMarqueeSelection`), and scoped recovery.
---

# Premium Large Data Grid — ABRN-Drive Edition

Deliver a useful, legible working view in `/lamp/www/ABRN-Drive` while managing hundreds or thousands of encrypted files, shares, drops, and audit records. Keep visual quality, zero-knowledge cryptographic truth, and measured `<1.5ms` client search performance together.

## Decide what the request authorizes

For critique/recon, inspect and report without writing or running tests. For implementation, adapt the existing application through its owners. Do not replace a working grid or introduce a heavy external grid library when native React + Tailwind + `content-visibility: auto` meets the budget. Respect all test holds (`DONT RUN THE WHOLE TESTS until I test it live`).

## ABRN-Drive Grid & Table Contract

| Surface | ABRN-Drive Owner | Performance & UX Invariant |
|---|---|---|
| **Primary Vault File List & Grid** | `vaultdrive_client/src/pages/files.tsx` | Native DOM virtualization via `content-visibility: auto` on file rows; resizable folder splitter (`180–520px`); reflow-free marquee lasso (`useMarqueeSelection.ts`); floating `VaultContextMenu.tsx`; mobile file cards with visible size, date, and `AES-256` seal. |
| **In-Memory Search & Filtering** | `vaultdrive_client/src/utils/vault-search-index.ts` | Pre-computed `PreparedDoc` normalized tokens + O(1) `tokenMap.get()` lookup + lexicographical tie-breaker (`<1.5ms` on 550+ documents). |
| **Progressive Supporting Enrichment** | `vault-search-index.ts` (`enrichDocument`, `syncDocuments`) | Local `#tags`, `detectedType`, and 64KB snippets (`document-triage.ts`) enrich rows progressively without wiping state when server metadata refreshes. |
| **Access Center Shares & Drops** | `vaultdrive_client/src/pages/access-center.tsx` | Responsive `ShareCard` and `DropCard` grids with live status badges, access counters, and 1-tap WhatsApp / Revoke actions. |

## Inspect and define success

Read host instructions and inspect its routes, query owners, permissions, filters, row grain, stable identities, aggregation semantics and current rendering. Read [adaptation](references/adaptation.md) to identify the minimum adapters. Separate database time, enrichment, transfer, DOM/layout and optional-panel costs. Define first-usable behavior, target viewports and representative measurement conditions before choosing pagination or virtualization.

## Build the working view

1. Read [visual system](references/visual-system.md). Budget columns around the user's decisions; keep complete amounts, meaningful labels, clear next actions and accessible detail. Preserve the host brand or use the optional daylight example theme.
2. Read [data contract](references/data-contract.md). Establish canonical page membership, aggregate scope, selection scope and optional data revision. Authenticate/authorize on the server; view identity never supplies authority.
3. Read [performance](references/performance.md). Render a bounded initial page/window with real controls. Defer expensive full aggregates and optional panels appropriately. Select a host-specific concurrency policy; deduplicate work and avoid a burst of supporting queries.
4. Keep pending/loading/ready/error and source unknown/partial states explicit. Reject late or foreign responses, invalidate stale facts, retain usable rows and offer local recovery. Expose a bounded readiness snapshot to agents using the same authorized owners.
5. Adapt desktop and mobile presentation without dropping necessary capability. Labels, keyboard focus, readable digits, touch controls and a reachable full-detail path matter more than fitting arbitrary columns into a fixed width.

The [offline worked example](assets/demo.html) is a synthetic visual/state-machine starter, not a production backend. Open it locally to inspect the interaction; use its CSS/JS only after mapping host semantics. It does not prove authorization, business completion or server scalability. Its scenario controls demonstrate delay/failure/recovery. [Example boundaries](references/worked-example.md) explains dependencies and commands. The [fixture generator](scripts/generate_fixture.py) produces deterministic synthetic rows for host-specific trials; fixture size is not a browser DOM requirement.

## Verify and close

Use [verification](references/verification.md) for useful-table timing, auxiliary completion and scoped behavioral proof. Run justified focused checks (`npm run typecheck`, targeted `npx vitest run`, `npm run build`); repeat them only after changes, failures or unresolved concerns. Separate warm/cold, real/simulated, browser/native and technical/human/business acceptance. Preserve missed budgets and failures.

After QA, critically compare the final source with the promised flow and evidence. Repair concrete authorized gaps, invalidate affected old proof and reverify the corrected version. Missing required documentation blocks delivery. A clean review may require no code change; do not invent work or widen scope to manufacture progress. Stop repeated unchanged external failures and report the precise blocker.

Document owners/adapters, source version, conditions, results, recovery and held checks in the host's existing task artifacts. Commit/push/install only under the task's existing authority. This package can be installed by [the safe installer](scripts/install.py); [adaptation](references/adaptation.md) includes installation and packaging instructions.

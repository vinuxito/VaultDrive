# Session Memory: v18 El Cerebro Ciego — Audit, Ruthless Critique & Complete Revision

- **Date:** 2026-10-04 (Revised 2026-10-14)
- **Mission:** Ruthlessly audit, critique, and revise the `v18-cerebro-ciego` build against [`docs/plans/v18-cerebro-ciego/v18-cerebro-ciego-index.md`](../plans/v18-cerebro-ciego/v18-cerebro-ciego-index.md) and Steps 01–05; fix every broken, disconnected, or half-done piece; verify with `npm run typecheck`, targeted Vitest suites, and production `npm run build` (holding the full 113-test suite per explicit user instruction).
- **Starting State:** Commit `81ead5d` on `main` (`feat(v18): implement El Cerebro Ciego client-side search, smart document triage, and Omnibar`).

---

## 1. Ruthless Critique Findings (What Was Broken or Half-Done in `81ead5d`)

| # | Defect / Gap Found | Root Cause in `81ead5d` | Resolution Implemented |
|---|---|---|---|
| **1** | **Double-Modal Collision on `⌘K`** | `CommandPalette` (`src/components/ui/command-palette.tsx`) and `VaultOmnibar` (`files.tsx:1124`) both listened for `⌘K`/`Ctrl+K`, opening two `role="dialog"` modals simultaneously and stealing focus. Additionally, `dashboard-layout.tsx:310-318` had a duplicate `window` keydown listener re-dispatching `keydown` `k` on `document`. | Removed the duplicate keydown re-dispatcher in `dashboard-layout.tsx`; reserved `⌘K` for global `CommandPalette` (and wired `useFileSearch.ts` + a `"Cerebro Ciego — Omnibar Search (/)"` action inside `CommandPalette` to query `globalVaultSearchIndex`); bound `/` and `⌘⇧F` (`Ctrl+Shift+F`) plus a dedicated **"Cerebro Ciego (`/`) "** button in `FileSearch.tsx` to `VaultOmnibar`. |
| **2** | **Broken `analyzeDocumentTriage` Call & Missing Auto-Rename** | `files.tsx:304` called `analyzeDocumentTriage(selectedFile.name, selectedFile.type)` — passing the MIME type as `textSample` (`arg 2`) instead of `arg 3`, and never reading the file's bytes! Every XML/PDF fell through to `"generic"`. Furthermore, the upload banner displayed raw enum `{selectedFileTriage.category}` (`"generic"`) with no way to apply `suggestedFilename`. | Added `triageFileObject(file)` in `document-triage.ts` (reads the first 64KB in browser memory via `extractSnippetForIndexing`), fixed CFDI `Emisor` attribute-order parsing, added `UUID` and `Moneda` extraction, added `id_credential` (`INE`/`Pasaporte`/`CURP`) triage, and upgraded the `files.tsx` upload banner with `detectedType`, `#tags`, and a 1-click **"Auto-nombrar: {suggestedFilename}"** button (`data-testid="triage-auto-rename-btn"`). |
| **3** | **`streaming-decrypt.ts` Was 100% Dead Code** | `vaultdrive_client/src/utils/streaming-decrypt.ts` was never imported anywhere in the application. | Connected `extractSnippetForIndexing` into `document-triage.ts` (`triageFileObject`), `FilePreviewModal.tsx` (automatically indexing decrypted plaintext snippets, triage tags, and SHA-256 seals when any file is previewed), and `files.tsx` (indexing snippets and tags upon single or batch upload). |
| **4** | **Session Enrichment Wiped on Re-Render & Duplicate Token Score Inflation** | `files.tsx:969` called `globalVaultSearchIndex.clear()` on every SWR re-render, wiping any enriched snippets/tags. Also, `VaultSearchIndex.search()` iterated prefix keys without deduplicating `docId` per query token, inflating scores by 5–10x. | Added session-persistent `enrichmentById` and `enrichmentByFilename` maps with `enrichDocument()` and `syncDocuments(docs)` in `vault-search-index.ts`, and deduplicated candidate `docId`s per query token in `search()`. |
| **5** | **Inline `<FileSearch>` Ignored `globalVaultSearchIndex`** | `visibleFiles` in `files.tsx` only checked `file.filename.toLowerCase().includes(q)`. | Connected `visibleFiles` to `globalVaultSearchIndex.search(q, 500)` so inline search also matches diacritic-insensitive names, tags (`cfdi`, `sat`, `contrato`), RFCs, amounts, and decrypted content snippets. |
| **6** | **Missing Memory Scrubbing on Panic Lock (`⌘L`) & Logout** | Neither `SessionVaultProvider.clearVault()` nor `isVaultLocked` scrubbed `globalVaultSearchIndex`, leaving plaintext tokens in RAM during Panic Lock. | Added `globalVaultSearchIndex.scrub()` and wired it into both `SessionVaultProvider.clearVault()` and `files.tsx` Panic Lock (`isVaultLocked`). |
| **7** | **`VaultOmnibar.tsx` & `BottomNav` Missing Plan Specs & i18n** | `VaultOmnibar.tsx` had hardcoded Spanish strings (no `useTranslation`), no character match highlighting, no live match count badge, and no `⌘S`/`⌘D`/`⌘⇧C` shortcuts. `BottomNav` search button did nothing if tapped outside `/files`. | Upgraded `VaultOmnibar.tsx` with `useTranslation("drive")`, EN/ES locale keys (`locales/{en,es}/drive.json`), `<mark>` match highlighting, live match count badge, `detectedType` badge, and `⌘S`/`⌘D`/`⌘⇧C` shortcuts. Updated `BottomNav` to navigate to `/files` before opening the Omnibar when tapped from other routes. |
| **8** | **Missing Closeout Deliverables** | Commit `81ead5d` omitted the session memory, Markdown verification report, HTML verification dashboard, and `README.md` update required by Step 05. | Created all three verification artifacts and updated `README.md`. |

---

## 2. Files Read & Modified

- `vaultdrive_client/src/utils/vault-search-index.ts` & `vault-search-index.test.ts`
- `vaultdrive_client/src/utils/document-triage.ts` & `document-triage.test.ts`
- `vaultdrive_client/src/utils/streaming-decrypt.ts` & `streaming-decrypt.test.ts`
- `vaultdrive_client/src/components/vault/VaultOmnibar.tsx` & `VaultOmnibar.test.tsx`
- `vaultdrive_client/src/components/vault/FilePreviewModal.tsx`
- `vaultdrive_client/src/components/vault/FileSearch.tsx`
- `vaultdrive_client/src/components/ui/command-palette.tsx`
- `vaultdrive_client/src/components/layout/dashboard-layout.tsx`
- `vaultdrive_client/src/components/mobile/bottom-nav.tsx`
- `vaultdrive_client/src/context/SessionVaultProvider.tsx`
- `vaultdrive_client/src/hooks/useFileSearch.ts`
- `vaultdrive_client/src/pages/files.tsx`
- `vaultdrive_client/src/locales/en/drive.json` & `vaultdrive_client/src/locales/es/drive.json`
- `docs/plans/v18-cerebro-ciego/v18-cerebro-ciego-index.md`
- `README.md`

---

## 3. Verdict

**`SEGURO CONTINUAR`** — All 8 architectural and UX gaps in `v18-cerebro-ciego` have been resolved, verified with strict TypeScript compilation, targeted unit tests, and production bundle compilation.

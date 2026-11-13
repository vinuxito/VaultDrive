# Session Memory — `v21-abrn-mobile-uix-folder-sharing`

- **Date:** 2026-11-12 / 2026-11-13
- **Ticket ID:** `TICKET-2026-11-12-ABRN-MOBILE-UIX-FOLDER-SHARING`
- **Build ID:** `v21-abrn-mobile-uix-folder-sharing`
- **Approved Reference Preview:** `https://abrndrive.filemonprime.net/abrn/previews/mobile.html` (`vaultdrive_client/public/previews/mobile.html`)
- **Production Route:** `https://abrndrive.filemonprime.net/abrn/files`

---

## 1. Mission & Starting State

The user reported being unable to share a folder on mobile (`<768px`) and asked to upgrade the mobile UIX using the ABRN design skills — first drafting an interactive public HTML preview (`/abrn/previews/mobile.html`), then turning the approved design into a formal ticket with screenshot evidence and implementing the full experience into production with visual fidelity matching the preview.

### Root Causes Identified During Recon
1. **`MobileFolderSheet.tsx` had zero share actions:** `MobileFolderSheetProps` only wired `onSelectFolder` and `onCreateFolder`, with no `[Compartir]`, `[Drop]`, or hierarchy support for child subfolders.
2. **No Active-Folder Command Card on Mobile (`files.tsx`):** On `<768px`, `VaultTree` was hidden off-canvas (`-translate-x-full md:translate-x-0`), leaving mobile users with only a plain breadcrumb and sort pills — zero folder share/drop/team actions above the fold.
3. **No Mobile 3-in-1 Folder Share Bottom Sheet:** Single files had `MobileShareSheet.tsx`, while folders fell back to the desktop `CreateFolderShareLinkModal.tsx` without 1-tap WhatsApp dispatch, `navigator.share`, local QR code, Live Glass Twin, or unified tabs (`Enlace #key`, `Buzón Drop`, `Equipo RSA`).
4. **No Mobile 5-Format Inspector Bottom Sheet:** `VaultInspectorPane` was hidden below `md`, leaving mobile file cards without a 3-zone Couch-Approved inspector sheet (`PDF`, `4K`, `MP4`, `CFDI`, `XLSX`) and sticky tactical dock.

---

## 2. Files Read & Modified / Created

### Created Files
- `vaultdrive_client/public/previews/mobile.html` (and `dist/previews/mobile.html`) — Self-contained interactive mobile UIX & folder-sharing public preview (`ABRN Cream` & `ABRN Slate`).
- `vaultdrive_client/src/utils/qr-svg.ts` — Sovereign zero-dependency ISO/IEC 18004 Byte-mode QR matrix encoder so `#key` fragments never leave the browser.
- `vaultdrive_client/src/components/mobile/MobileFolderShareSheet.tsx` — 3-Zone 3-in-1 Folder Share Bottom Sheet (`Enlace #key` + Live Glass Twin + Sovereign QR + WhatsApp/Copy/Native, `Buzón Drop`, `Equipo RSA`, and Zero Dead-End empty-folder handoff).
- `vaultdrive_client/src/components/mobile/MobileFolderShareSheet.test.tsx` — Unit tests (3/3 passing).
- `vaultdrive_client/src/components/mobile/MobileFolderSheet.test.tsx` — Unit tests for hierarchical folder explorer & 1-tap share/drop actions (2/2 passing).
- `vaultdrive_client/src/components/mobile/MobileInspectorSheet.tsx` — 3-Zone 5-Format RAM Inspector Bottom Sheet (`PDF`, `4K`, `MP4`, `CFDI`, `XLSX` + Sacred SHA-256 Receipt + sticky dock).
- `vaultdrive_client/src/components/mobile/MobileInspectorSheet.test.tsx` — Unit test (1/1 passing).
- `docs/tickets/archived/2026-11-12-ticket-v21-abrn-mobile-uix-folder-sharing.md` & `docs/tickets/evidence/v21-abrn-mobile-uix-folder-sharing/*.png`.
- `docs/plans/v21-abrn-mobile-uix-folder-sharing/{00-index..05-mobile-vault-hero-and-verification}.md`.
- `docs/reports/2026-11-12-v21-abrn-mobile-uix-folder-sharing-verification.{md,html}` & `docs/reports/2026-11-12-v21-abrn-mobile-uix-folder-sharing-audit.json`.

### Modified Files
- `vaultdrive_client/src/components/mobile/MobileFolderSheet.tsx` — Upgraded to 3-Zone ABRN Explorer Sheet with indented child subfolders, 1-tap `[Compartir]` + `[Drop]` / `[Pedir Drop]` buttons, and sticky bottom dock.
- `vaultdrive_client/src/components/vault/FileGrid.tsx` & `FileGrid.test.tsx` — Added `CFDI` badge for `.xml` files, `order-last` mobile sub-line (`Size • Date • AES-256`), and `md:hidden` 1-tap `[Share]` + `[Inspect]` buttons.
- `vaultdrive_client/src/components/vault/FileSearch.tsx` — Compact mobile padding and single-row hidden-scrollbar horizontal filter pills.
- `vaultdrive_client/src/components/layout/dashboard-layout.tsx` — Mobile `/abrn/abrn-logo.png` crest + `Libre Baskerville` brand title, 1-tap `Cream`/`Slate` mode pill (`abrn-mobile-mode-toggle`), and single-row `flex-nowrap` mobile header layout.
- `vaultdrive_client/src/pages/files.tsx` — Compact single-row mobile top bar (`Bóveda ABRN` + `Blindado` + `Carpetas` + `Subir`), `mobile-active-folder-hero` 44px action deck (`Compartir Carpeta`, `Pedir Archivos`, `Equipo`), `mobile-subfolder-strip` quick-share chips, `MobileFolderShareSheet`, and `MobileInspectorSheet`.
- `README.md` — Added `v21-abrn-mobile-uix-folder-sharing` milestone, passing test metrics, and verification links.

---

## 3. Exact Commands Run & Numerical Outcomes

| Check | Command | Exit Code | Outcome |
|---|---|---:|---|
| TypeScript Build & E2E Check | `npm run typecheck` (`vaultdrive_client`) | `0` | `0 errors` (`tsc -b && tsc -p tsconfig.e2e.json --noEmit`) |
| Focused Vitest Suite | `npx vitest run src/components/mobile/MobileFolderShareSheet.test.tsx src/components/mobile/MobileFolderSheet.test.tsx src/components/mobile/MobileInspectorSheet.test.tsx src/components/mobile/MobileShareSheet.test.tsx src/components/vault/FileGrid.test.tsx src/components/vault/VaultInspectorPane.test.tsx src/components/vault/CreateFolderShareLinkModal.empty-folder.test.tsx src/config/skin-contrast.test.ts src/config/brand-theme.test.ts` | `0` | `9/9` test files passed, `95/95` tests passed (`3.95s`) |
| Production Bundle Build | `npm run build` (`vaultdrive_client`) | `0` | Built in `11.96s` (`dist/index.html` SHA-256 `d967bed61b475ab4c02a8f5351f8e3be6fd818c69818ec188d62b16996e4920e`) |
| Real Browser Mobile & Desktop Audit | `bsk` (`iphone-14` `390×844` in `ABRN Cream` & `ABRN Slate` + Desktop `1440×900`) | `0` | 5 archival PNGs verified in `docs/reports/evidence/v21-abrn-mobile-uix-folder-sharing/` |
| Post-Build Audit Validator | `python3 .agents/skills/resolucion-de-tickets-nivel-dios/scripts/check-post-build-audit.py docs/reports/2026-11-12-v21-abrn-mobile-uix-folder-sharing-audit.json --project /lamp/www/ABRN-Drive --build-id v21-abrn-mobile-uix-folder-sharing` | `0` | `"status": "PASS"` |

---

## 4. Confirmed Post-Build Audit Fixes & Remaining Risks

- **Confirmed Fixes During Live `390×844` Audit:**
  1. `FND-01` (Fixed): Prevented `DashboardLayout` header from wrapping onto 2 rows at `390px`, compacted `FileSearch` filter pills to a single smooth horizontal row, and hid the duplicate desktop breadcrumb/sort toolbar on `<768px` (while keeping `#file-input`, `#camera-input`, and `#folder-input` mounted) so `mobile-active-folder-hero`, `mobile-subfolder-strip`, and 3 file cards appear cleanly above the fold.
  2. `FND-02` (Fixed): Styled the hero `Equipo` trigger as a `44×44px` square icon button matching `Teléfono 1` of `/abrn/previews/mobile.html` (eliminating right-border overflow on `390px`) and hid the horizontal scrollbar track on `mobile-subfolder-strip`.
  3. `FND-03` (Fixed): Locked explicit light-on-obsidian contrast (`#e2e8f0` on `#161922`) inside `MobileInspectorSheet`'s CFDI XML `<pre>` block so light-mode CSS overrides never dim code readability, kept `MobileFolderSheet` Zone 3 `Nueva Carpeta` single-line, and added smooth `scrollIntoView` when toggling the Sovereign QR card.
- **Remaining Risks:**
  - Sovereign QR encoder (`qr-svg.ts`) targets versions `1..10` Byte mode (up to `271` bytes), sufficient for standard `https://<host>/abrn/folder-share/<64-hex>#<44-char-base64>` URLs (`~148` bytes), with graceful `null` fallback if an unusually long custom domain exceeds 271 bytes.

---

## 5. Final Verdict

**Verdict:** `SEGURO CONTINUAR` (Safe to continue — verified in cold execution and real Chromium `bsk` session, zero regressions).

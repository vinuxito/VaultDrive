# Verification Report — `v21-abrn-mobile-uix-folder-sharing`

- **Ticket ID:** `TICKET-2026-11-12-ABRN-MOBILE-UIX-FOLDER-SHARING`
- **Build ID:** `v21-abrn-mobile-uix-folder-sharing`
- **Date:** 2026-11-12 / 2026-11-13
- **Status:** `PASS` (`0` TypeScript errors, `95/95` Vitest unit assertions passed, `5/5` live `bsk` real-browser screenshots verified, `check-post-build-audit.py` `PASS`)
- **Approved Design Preview:** [`https://abrndrive.filemonprime.net/abrn/previews/mobile.html`](https://abrndrive.filemonprime.net/abrn/previews/mobile.html)
- **Production Route:** [`https://abrndrive.filemonprime.net/abrn/files`](https://abrndrive.filemonprime.net/abrn/files)

---

## 1. Executive Summary

Mobile users (`<768px`) previously had no way to share folders, collect client uploads into a folder, or inspect files in a multi-format RAM drawer without losing their folder context. Build `v21-abrn-mobile-uix-folder-sharing` delivers 100% visual and functional parity with the approved interactive preview (`/abrn/previews/mobile.html`) while strictly honoring the **Immutable ABRN Asesores Brand Palette** (`ABRN Cream` `#faf8f5` / `#7a1f2b` and `ABRN Slate` `#1e2330` / `#d4aeb0`, `Libre Baskerville` serif headings, `/abrn/abrn-logo.png`) and zero-knowledge `#fragment` encryption.

---

## 2. Verification Matrix

| Check ID | Scope | Command / Steps | Expected | Actual | Status |
|---|---|---|---|---|---|
| `CHK-TYPECHECK` | Full TypeScript Client & E2E Check | `npm run typecheck` (`vaultdrive_client`) | Exit `0`, `0` errors | Exit `0`, `0` errors | **PASS** |
| `CHK-VITEST-95` | Mobile Sheets, FileGrid, Inspector & Skin Contrast | `npx vitest run src/components/mobile/MobileFolderShareSheet.test.tsx src/components/mobile/MobileFolderSheet.test.tsx src/components/mobile/MobileInspectorSheet.test.tsx src/components/mobile/MobileShareSheet.test.tsx src/components/vault/FileGrid.test.tsx src/components/vault/VaultInspectorPane.test.tsx src/components/vault/CreateFolderShareLinkModal.empty-folder.test.tsx src/config/skin-contrast.test.ts src/config/brand-theme.test.ts` | `9/9` files, `95/95` tests pass | `9/9` files, `95/95` tests passed (`3.95s`) | **PASS** |
| `CHK-VITE-BUILD` | Production Bundle Compilation | `npm run build` (`vaultdrive_client`) | Clean production build in `dist/` | Built in `11.96s` (`dist/index.html` SHA-256 `d967bed6...96e4920e`) | **PASS** |
| `CHK-LIVE-MOBILE-HERO` | Mobile Active Folder Hero + Subfolder Strip + File Cards (`390×844` `ABRN Cream`) | `bsk` iPhone 14 (`390×844`) on `/abrn/files` inside `Expedientes Fiscales 2026` with child subfolder `Declaraciones SAT 2026` and 3 encrypted files (`XLSX`, `CFDI`, `PDF`) | Single-row header, Active Folder Hero (`Compartir Carpeta`, `Pedir Archivos`, `Equipo`), Subfolder Quick-Share chip, and 3 file cards visible above the fold | Verified in `01-live-mobile-vault-hero-cream.png` | **PASS** |
| `CHK-LIVE-FOLDER-EXPLORER` | Hierarchical `MobileFolderSheet` with 1-Tap `[Compartir]` & `[Pedir Drop]` (`390×844` `ABRN Slate`) | Toggle `ABRN Slate` mode pill (`@e321`) and open `MobileFolderSheet` (`@e375`) | `ABRN Slate` (`#1e2330` / `#d4aeb0`) palette, indented child subfolder `↳ Declaraciones SAT 2026`, `[Compartir]` on populated folder, `[Pedir Drop]` on empty folders, single-line sticky dock | Verified in `02-live-mobile-folder-explorer-slate.png` | **PASS** |
| `CHK-LIVE-FOLDER-SHARE` | 3-in-1 `MobileFolderShareSheet` Wrapping Real AES-256 Keys into `#key` (`390×844` `ABRN Cream`) | Tap `Compartir Carpeta` (`@e376`), unlock with 4-digit PIN, inspect generated `#key` link, Live Glass Twin, active link sync row, and WhatsApp dock | `3/3 llaves AES-256 envueltas con tu PIN · 0 Bytes al Servidor`, live `/abrn/folder-share/<token>#<key>` URL, `1d/3d/7d/30d` pills, WhatsApp/Copy/QR/Native dock | Verified in `03-live-mobile-folder-share-sheet-cream.png` | **PASS** |
| `CHK-LIVE-MOBILE-INSPECTOR` | 5-Format `MobileInspectorSheet` (`PDF`, `4K`, `MP4`, `CFDI`, `XLSX`) + Sacred Receipt (`390×844`) | Tap `[Inspect]` (`@e410`) on `CFDI_Honorarios_Nov2026.xml` | 5 format tabs (`PDF`, `4K`, `MP4`, `CFDI`, `XLSX`), high-contrast XML preview, full streaming decrypt CTA, SHA-256 Sacred Receipt (`0 B Delta`), sticky dock | Verified in `04-live-mobile-inspector-5formats-cream.png` | **PASS** |
| `CHK-LIVE-DESKTOP-REGRESSION` | Desktop 3-Pane Resizable Workspace (`1440×900`) | Switch viewport to `1440×900` (`bsk emulate --width 1440 --height 900`) | All 3 desktop resizable panes (`VaultTree`, `FileGrid`, `VaultInspectorPane`), `ABRN Cream / ABRN Slate` mode bar, and telemetry strip intact | Verified in `05-live-desktop-regression-check.png` | **PASS** |

---

## 3. Before vs. After Mobile UX Comparison

| Dimension | Before (`v20`) | After (`v21`) |
|---|---|---|
| **Folder Sharing on Mobile (`<768px`)** | Unreachable (`VaultTree` hidden off-canvas; `MobileFolderSheet` only navigated & closed) | **1-Tap Everywhere**: Active Folder Hero `[Compartir Carpeta]`, Subfolder Quick-Share chips, and `[Compartir]` / `[Pedir Drop]` on every `MobileFolderSheet` row |
| **Folder Share Surface** | Desktop modal fallback lacking WhatsApp, QR, Native Share, or unified Drop/Team switching | **3-in-1 `MobileFolderShareSheet`**: `Enlace #key` + Live Glass Twin + Sovereign QR SVG (`0` external bytes) + `Buzón Drop` + `Equipo RSA` + Zero Dead-End empty-folder handoff |
| **Mobile Above-the-Fold Budget (`390×844`)** | 4 stacked header/breadcrumb bars (`~420px`) pushing files off-screen | Sleek 1-row ABRN header + compact search/scroll chips + Active Folder Hero + Subfolder Strip + 3 visible file cards above the fold |
| **Mobile File Inspection** | Right `VaultInspectorPane` hidden below `md` with no mobile bottom-sheet equivalent | **3-Zone `MobileInspectorSheet`**: `PDF` / `4K` / `MP4` / `CFDI` / `XLSX` RAM tabs + SHA-256 Sacred Receipt + sticky `← Carpeta` / `WhatsApp` / `Descargar` dock |
| **Mobile Skin Toggle** | `ABRN Cream` / `ABRN Slate` toggle hidden on `<768px` (`hidden md:flex`) | 1-tap `Cream` / `Slate` mode pill (`abrn-mobile-mode-toggle`) in mobile header |

---

## 4. Critical Post-Build Visual Audit Findings & Fixes

1. **`FND-01` (`MEDIUM` → `FIXED`):** Initial `390×844` capture showed the mobile `DashboardLayout` header wrapping onto 2 rows and duplicate legacy breadcrumb/sort bars consuming ~420px above the fold. Fixed via single-row `flex-nowrap` header spacing, single-row horizontally scrollable `FileSearch` filter chips, and `hidden md:flex` on the redundant desktop breadcrumb/sort toolbar while keeping `#file-input`, `#camera-input`, and `#folder-input` mounted.
2. **`FND-02` (`MEDIUM` → `FIXED`):** Initial `390×844` capture showed `[👥 Equipo]` slightly overflowing the right card border and a visible browser scrollbar track under `mobile-subfolder-strip`. Fixed by rendering `[👥]` as a `44×44px` square icon button (`aria-label="Equipo"`, matching `Teléfono 1` of `/abrn/previews/mobile.html`) and applying `[scrollbar-width:none] [&::-webkit-scrollbar]:hidden`.
3. **`FND-03` (`LOW` → `FIXED`):** Initial `MobileInspectorSheet` CFDI `<pre>` block inherited dimmed light-mode text contrast, and `MobileFolderSheet` Zone 3 `Nueva Carpeta` wrapped onto 2 lines on long folder names. Fixed with explicit `#e2e8f0` on `#161922` obsidian styling, `whitespace-nowrap shrink-0` on `Nueva Carpeta`, and `scrollIntoView` on the Sovereign QR SVG card.

---

## 5. Cryptographic File Seals (SHA-256)

| File Path | SHA-256 Digest |
|---|---|
| `vaultdrive_client/src/utils/qr-svg.ts` | `ff146b871de30367f6b902abad72a4686216331d94647b61866bdd18ff1be605` |
| `vaultdrive_client/src/components/mobile/MobileFolderShareSheet.tsx` | `6703bc36b2f673af01739845a80983916ed11b6908f22a6d8f82a827d473bef7` |
| `vaultdrive_client/src/components/mobile/MobileFolderShareSheet.test.tsx` | `cd2256cc21470be8f0723f28b884a576c548e900883acac68d6cc7160ab1b1f2` |
| `vaultdrive_client/src/components/mobile/MobileFolderSheet.tsx` | `7af649e9dfb378e1ce875222e6207f61863cf9a3b04c50bf9fc3cd859a86d191` |
| `vaultdrive_client/src/components/mobile/MobileFolderSheet.test.tsx` | `57dab8a27cb9f19c2f8a837603374512b1694611205ae250965b4d4f1ba842fa` |
| `vaultdrive_client/src/components/mobile/MobileInspectorSheet.tsx` | `384677051388e5a6c48f897f61ddf38e011b86d2ad688d118c8cb41529977083` |
| `vaultdrive_client/src/components/mobile/MobileInspectorSheet.test.tsx` | `07c32131e6f0310628f1fb6b024051ca727dadc5ef09f31c471f835e537cc2dc` |
| `vaultdrive_client/src/components/vault/FileGrid.tsx` | `a794e3c693f7ee4ae90258986e98aa5d86f493c696fe173ad5454db67e5bd72b` |
| `vaultdrive_client/src/components/vault/FileGrid.test.tsx` | `703c28f130b2eee1477c8ea5ba8b9afdabaffd5f2c1a1459ce99ab43df550c87` |
| `vaultdrive_client/src/components/vault/FileSearch.tsx` | `6ffded7ae12df39260dbe64227baf10d1d3ac01959ca5c5dbdbe603282d26ead` |
| `vaultdrive_client/src/components/layout/dashboard-layout.tsx` | `bb01e1c05b8fa25c3550e03bc4716a590798a12bf4cef339de814052c2c67bc9` |
| `vaultdrive_client/src/pages/files.tsx` | `a051957539fe89440799fb2cbc4d545c9d9a2979f2234d097e0276e7092ca83a` |
| `vaultdrive_client/public/previews/mobile.html` | `9ec659ae02da31566dda07fb896abf7481783e31197ac171de5873cbbae9ae6c` |
| `vaultdrive_client/dist/index.html` | `d967bed61b475ab4c02a8f5351f8e3be6fd818c69818ec188d62b16996e4920e` |

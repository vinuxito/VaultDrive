# Execution Plan: `v21-abrn-mobile-uix-folder-sharing`

- **Ticket ID:** `TICKET-2026-11-12-ABRN-MOBILE-UIX-FOLDER-SHARING`
- **Build ID:** `v21-abrn-mobile-uix-folder-sharing`
- **Status:** `verified_and_archived`
- **Ticket Document:** [docs/tickets/archived/2026-11-12-ticket-v21-abrn-mobile-uix-folder-sharing.md](../../tickets/archived/2026-11-12-ticket-v21-abrn-mobile-uix-folder-sharing.md)
- **Canonical Preview Reference:** [`https://abrndrive.filemonprime.net/abrn/previews/mobile.html`](https://abrndrive.filemonprime.net/abrn/previews/mobile.html) (`vaultdrive_client/public/previews/mobile.html`)
- **Target Production Route:** `https://abrndrive.filemonprime.net/abrn/files` (Mobile `<768px` + responsive continuity with Desktop `>=768px`)

## 1. Mission & Immutable Design Contract

Deliver 100% of the approved mobile UIX and folder-sharing architecture from `/abrn/previews/mobile.html` into the production React client (`vaultdrive_client/src/`) while preserving the **Immutable ABRN Asesores Brand Palette** (`ABRN Cream` `#faf8f5` / `#7a1f2b` and `ABRN Slate` `#1e2330` / `#d4aeb0`, `Libre Baskerville` serif headings, `/abrn/abrn-logo.png`), real WebCrypto zero-knowledge `#fragment` folder sharing, real Drop intake links, real RSA multi-user folder sharing, and zero regressions on the v20 desktop 3-pane workspace:

1. **Active Folder Hero Card & Subfolder Quick-Share Strip (`files.tsx` & `dashboard-layout.tsx`):**
   - Compact mobile ABRN Cream/Slate mode toggle in `dashboard-layout.tsx` so mobile users can switch skins in 1 tap.
   - Mobile `Cerebro Ciego (/)` Omnibar search pill right above the folder hero card.
   - **Active Folder Hero Card** (`md:hidden`) displaying folder emblem, `BÓVEDA ABRN › CARPETA ACTIVA` breadcrumb, `Libre Baskerville` serif folder name, file count + size + `#key Listo` telemetry, `[Cambiar ▾]` trigger, and the **3-Button Couch-Approved Action Deck (`min-h-[44px]`)**:
     - `[Compartir Carpeta]` (`data-testid="mobile-hero-share-folder-btn"`) → Opens `MobileFolderShareSheet` (`link` tab).
     - `[Pedir Archivos]` (`data-testid="mobile-hero-drop-folder-btn"`) → Opens `MobileFolderShareSheet` (`drop` tab).
     - `[Equipo]` (`data-testid="mobile-hero-team-folder-btn"`) → Opens `MobileFolderShareSheet` (`team` tab).
   - **Horizontal Subfolder / Folder Strip (`md:hidden`)** with direct 1-tap share icon right on every folder chip.

2. **Upgraded `MobileFolderSheet.tsx` ("Gaveta de Carpetas con 1-Tap Share & Jerarquía"):**
   - Hierarchical rendering of root folders and indented child subfolders (`↳` dashed border).
   - Direct 1-tap `[Compartir]` and `[Drop]` / `[Pedir Drop]` buttons on every folder row (Zero Dead-End on empty folders).
   - Sticky Zone 3 bottom dock with `[+ Nueva Carpeta]` and `[Compartir «{Carpeta}»]`.

3. **New 3-in-1 `MobileFolderShareSheet.tsx`:**
   - 3-Zone Couch-Approved Bottom Sheet unifying:
     - **Tab 1 (`Enlace #key`):** Real WebCrypto batch key unwrapping (`GET /folders/:id/files-recursive`, `POST /files/access-keys-batch`, `resolveFolderShareFileKey`, `wrapKeyWithAES`, `POST /folders/:id/share-link`), `Live Glass Twin` (*Espejo del Receptor*), `1d / 3d / 7d / 30d` expiry pills, active links sync counter (`syncFolderShareLinkById`), Zero Dead-End empty-folder handoff to `Buzón Drop`, Sovereign local ISO/IEC 18004 QR SVG (`qr-svg.ts`), and frozen bottom dock (`Enviar Carpeta por WhatsApp`, `Copiar Enlace #key`, `QR`, `Nativo`).
     - **Tab 2 (`Buzón Drop`):** Real encrypted upload link creation/dispatch (`POST /drop/create`) into that folder with *Recibo Sagrado* telemetry (`Hasta 250 MB`, `Folio + WhatsApp`).
     - **Tab 3 (`Equipo RSA`):** Real multi-user folder collaborator management (`GET /folders/:id/shares`, `GET /users/search`, `wrapKeyWithRSA`, `POST /folders/:id/shares`, `DELETE /folders/:id/shares/:userId`).

4. **New 5-Format `MobileInspectorSheet.tsx` & Mobile File Cards (`FileGrid.tsx`):**
   - Mobile file cards in `FileGrid.tsx` feature crisp format badges (`PDF`, `4K`, `MP4`, `XLSX`, `CFDI`), 1-tap `[Share]` & `[Inspect]` touch buttons, and a clean bottom sub-line (`Size • Date • AES-256`).
   - Tapping `[Inspect]` on mobile opens `MobileInspectorSheet.tsx` with the 5-Format RAM preview (`PDF`, `4K`, `MP4`, `CFDI`, `XLSX`), *Recibo Sagrado* SHA-256 bar, full-screen `FilePreviewModal` streaming decrypt trigger, and sticky tactical dock (`← Carpeta`, `WhatsApp`, `Descargar`).

## 2. Sequential Step Files

| Step | File | Status |
|---|---|---|
| **01** | [01-ticket-and-evidence.md](./01-ticket-and-evidence.md) | `completed` |
| **02** | [02-mobile-folder-share-sheet.md](./02-mobile-folder-share-sheet.md) | `completed` |
| **03** | [03-mobile-folder-explorer-sheet.md](./03-mobile-folder-explorer-sheet.md) | `completed` |
| **04** | [04-mobile-inspector-and-file-cards.md](./04-mobile-inspector-and-file-cards.md) | `completed` |
| **05** | [05-mobile-vault-hero-and-verification.md](./05-mobile-vault-hero-and-verification.md) | `completed` |

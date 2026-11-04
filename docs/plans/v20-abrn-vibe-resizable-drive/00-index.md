# Execution Plan: `v20-abrn-vibe-resizable-drive`

- **Ticket ID:** `TICKET-2026-11-04-ABRN-VIBE-RESIZABLE-DRIVE`
- **Build ID:** `v20-abrn-vibe-resizable-drive`
- **Status:** `verified_and_archived`
- **Canonical Preview Reference:** `https://abrndrive.filemonprime.net/abrn/previews/drive.html` (`vaultdrive_client/public/previews/drive.html`)
- **Target Production Route:** `https://abrndrive.filemonprime.net/abrn/files` (and shared shell across `/abrn/*`)

## 1. Mission & Immutable Design Contract

Bring the approved pure HTML preview (`/abrn/previews/drive.html`) into the live React application (`vaultdrive_client/src/`) while preserving 100% of existing zero-knowledge encryption, folder tree, share links, and Filemón Office behavior:

1. **Immutable ABRN Asesores Brand Palette (`skins.css`, `theme-context.ts`, `ThemeProvider.tsx`):**
   - **Light Mode (`ABRN Cream` — default for `abrn-drive`):** Warm Cream `#faf8f5` (`36 33% 97%`), Elevated Surface `#f2efe9` (`36 22% 93%`), Pure Card `#ffffff`, Deep Slate Text `#2c323f` (`221 18% 21%`), Muted `#646b78` (`218 9% 43%`), ABRN Burgundy Primary `#7a1f2b` (`352 60% 30%`) / `#7d4f50` (`359 22% 40%`), Emerald `#2d8a6e`, Amber `#b8860b`, Ruby `#c43e3e`, Sapphire `#3d6bb5`, `Libre Baskerville` serif display headings (`--font-display`).
   - **Dark Mode (`ABRN Slate`):** Deep Slate `#1e2330` (`223 23% 15%`), Card Slate `#2c3240` (`222 18% 21%`), Surface `#252b3b`, Warm Cream Text `#f2f0ed` (`36 17% 94%`), Muted `#9aa3b5` (`220 16% 66%`), Rose-Burgundy Primary `#d4aeb0` / `#c4999b` (`357 27% 72%`) with dark slate primary-foreground `#1e2330` so WCAG 4.5:1 contrast passes 100%.
   - **Topbar 1-Click ABRN Mode Switcher (`dashboard-layout.tsx`, `sidebar.tsx`):**
     - Upright `BrandLogo` (`h-9 w-9`, no `rotate-90`) in the left rail.
     - `ABRN Asesores` serif header identity + 1-click `ABRN Cream` / `ABRN Slate` mode pill (`data-testid="abrn-mode-bar"`, `abrn-mode-light`, `abrn-mode-dark`) directly in the topbar.

2. **3-Pane Resizable Workspace (`files.tsx`, `VaultInspectorPane.tsx`, `FileGrid.tsx`):**
   - **Pane 1 (Left):** Resizable Folder Tree (`VaultTree`) with visible burgundy grip pill on `splitter-left` (`min 150px`, `max 520px`, double-click auto-fit).
   - **Pane 2 (Center):** `FileGrid` with color-coded format badges (`PDF`, `4K`, `MP4`, `SH`, `XLSX`, `XML`), single-line desktop table rows (`md:flex-nowrap`), single-click to inspect in the right-hand pane, and double-click to expand the 94vw Cinemascope modal.
   - **Pane 3 (Right):** New resizable `VaultInspectorPane` (`splitter-right`, `min 265px`, `max 560px`, collapsible via topbar/header button) with:
     - Interactive 5-Format Switcher tabs (`1. PDF`, `2. 4K`, `3. Video`, `4. Código`, `5. XLSX`) in a 5-column grid so the user can inspect both the selected file and all 5 preview engines directly inside the right-hand pane.
     - 1-Click Cryptographic Dispatch Bar (`#key`, `WhatsApp`, `RSA`, `SHA-256`).
     - Live zoom/rotate/play/formula-bar controls + Cryptographic Lineage Card (`AES-256-GCM`, `RSA-OAEP 4096`, `SHA-256`) + `Expandir 94vw` & `Descargar Original` footer.

3. **Enhanced Right-Click Context Menu (`VaultContextMenu.tsx`):**
   - Right-click context menu with keyboard shortcut badges (`Espacio`, `L`, `W` WhatsApp, `I` Pasaporte RSA, `S` SHA-256, `D` Descargar, `M` Mover, `X` Staging Dock, `⌫` Eliminar).

## 2. Step Files

| Step | File | Status |
|---|---|---|
| **01** | [01-ticket-and-abrn-palette.md](./01-ticket-and-abrn-palette.md) | `completed` |
| **02** | [02-resizable-inspector-pane.md](./02-resizable-inspector-pane.md) | `completed` |
| **03** | [03-three-pane-workspace-and-filegrid.md](./03-three-pane-workspace-and-filegrid.md) | `completed` |
| **04** | [04-context-menu-and-cinemascope.md](./04-context-menu-and-cinemascope.md) | `completed` |
| **05** | [05-verification-and-archive.md](./05-verification-and-archive.md) | `completed` |

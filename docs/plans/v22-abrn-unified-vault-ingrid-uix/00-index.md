# Execution Plan — `v22-abrn-unified-vault-ingrid-uix`

- **Ticket:** [`docs/tickets/2026-11-14-ticket-v22-abrn-unified-vault-ingrid-uix.md`](../../tickets/2026-11-14-ticket-v22-abrn-unified-vault-ingrid-uix.md)
- **Approved Reference Preview:** `https://abrndrive.filemonprime.net/abrn/previews/index.html` (`vaultdrive_client/public/previews/index.html`)
- **Build ID:** `v22-abrn-unified-vault-ingrid-uix`

## Steps

1. [`01-ticket-and-evidence.md`](01-ticket-and-evidence.md) — Capture 5 PNG + JPG preview states and HTML snapshot into `docs/tickets/evidence/v22-abrn-unified-vault-ingrid-uix/` and formalize `TICKET-2026-11-14-ABRN-UNIFIED-VAULT-INGRID-UIX`. (`DONE`)
2. [`02-unified-shell-and-subheader.md`](02-unified-shell-and-subheader.md) — Upgrade `dashboard-layout.tsx`, `sidebar.tsx`, `skins.css`, and `files.tsx` topbar/subheader: `238px` expanded rail with `ABRN Drive · ABRN Asesores` & `flex-shrink: 0` badges, topbar `Pedir Docs / Enviar Carpeta / Bloquear / Subir y Ordenar` actions, layout presets (`3 Paneles | Lista Ancha | Lectura`), clickable telemetry strip, and `10px` 4-dot tactile splitters with live `px` HUD.
3. [`03-resizable-panes-and-client-tree.md`](03-resizable-panes-and-client-tree.md) — Upgrade `VaultTree.tsx`, `FolderModal.tsx`, and `VaultContextMenu.tsx`: `CLIENTES Y CARPETAS` + `[+ Carpeta]` + instant folder filter input, `FIJADOS ★` / `FILTROS RÁPIDOS`, storage bar, and 1-click **5-Subfolder Accountant Standard Template** (`01`..`05`).
4. [`04-ingrid-capsule-tabs-and-day-groups.md`](04-ingrid-capsule-tabs-and-day-groups.md) — Upgrade `FileSearch.tsx`, `FileGrid.tsx`, and `StagingDock.tsx`: subfolder pills, 9 live-count underline tabs, `HOY / ESTA SEMANA / ANTERIORES` day headers, `3.5px` burgundy left spine, `38×38px` visual mini-thumbnails, gold `★` stars, inline `F2` rename via `POST /api/v1/files/sync`, zero-reflow floating In-Grid Action Capsule + 2-click armed delete, floating dark `Canasta #key` dock, and bottom shortcut hint bar.
5. [`05-ram-inspector-smart-upload-and-drop.md`](05-ram-inspector-smart-upload-and-drop.md) — Upgrade `VaultInspectorPane.tsx` (6-format tabs including `XML CFDI`, `WhatsApp | Enlace #key | Renombrar | SHA-256` deck, collapsible Pasaporte Criptográfico ABRN) and add `SmartUploadOrderModal.tsx` (`Subir y Ordenar`) + `WhatsAppDropRequestModal.tsx` (`Pedir Docs`).
6. [`06-verification-and-post-build-audit.md`](06-verification-and-post-build-audit.md) — Run `npm run typecheck`, focused `vitest run` suites, `npm run build`, live `bsk` desktop (`1440×900` Cream & Slate) + mobile (`390×844`) verification, `check-post-build-audit.py`, session memory, MD/HTML verification reports, `README.md`, ticket archival, and `git push origin main`.

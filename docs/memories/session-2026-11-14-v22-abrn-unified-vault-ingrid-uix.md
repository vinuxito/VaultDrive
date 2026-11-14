# Session Memory — 2026-11-14 (`v22-abrn-unified-vault-ingrid-uix`)

- **Date:** 2026-11-14
- **Mission:** Design, formalize as `TICKET-2026-11-14-ABRN-UNIFIED-VAULT-INGRID-UIX` (with HTML + PNG/JPG preview & live evidence), implement, verify, and close out **v22 Unified ABRN Vault & In-Grid UIX** across `vaultdrive_client/src/` so `https://abrndrive.filemonprime.net/abrn/files` matches the approved unified preview (`https://abrndrive.filemonprime.net/abrn/previews/index.html`) with strictly **one unified ABRN Drive** (zero split power/easy modes).
- **Build ID:** `v22-abrn-unified-vault-ingrid-uix`
- **Verdict:** **`SEGURO CONTINUAR`** (Safe to continue)

---

## 1. Starting State & Architectural Context

- `ABRN-Drive` (`VaultDrive`) runs a Go 1.24 backend (`abrndrive.service`, working directory `/lamp/www/ABRN-Drive`) serving `vaultdrive_client/dist` directly under `/abrn/` with browser-side `AES-256-GCM` encryption, `#fragment` zero-knowledge link keys, `POST /api/v1/files/sync` metadata mutations, and `POST /api/drop/create` Secure Drop tokens.
- Prior builds (`v18`–`v21`) established `triageFileObject`, `FilemonOfficeStage`, `VaultInspectorPane`, `VaultContextMenu`, and mobile sheets, while the user requested unifying power capabilities (resizable 3-pane explorer, right-click actions, Floating In-Grid Action Capsule, 6-format RAM inspector) and effortless accountant/auxiliary workflows (5-subfolder client template, Smart Upload & Auto-Order, WhatsApp Secure Drop checklist request, inline `F2` rename) into **one single, calm, unmistakable ABRN workspace**.

---

## 2. Files Read & Modified / Created

### Public Preview, Ticket & Plan Artifacts
- `vaultdrive_client/public/previews/index.html` (canonical approved unified HTML preview)
- `vaultdrive_client/public/previews/easy.html` (clean redirect to `/abrn/previews/index.html` — zero split modes)
- `docs/tickets/archived/2026-11-14-ticket-v22-abrn-unified-vault-ingrid-uix.md`
- `docs/tickets/evidence/v22-abrn-unified-vault-ingrid-uix/approved-preview-index.html`
- `docs/tickets/evidence/v22-abrn-unified-vault-ingrid-uix/01..05-*.{png,jpg}` (10 preview captures)
- `docs/tickets/evidence/v22-abrn-unified-vault-ingrid-uix/live-01..06-*.{png,jpg}` (12 live production captures)
- `docs/plans/v22-abrn-unified-vault-ingrid-uix/{00-index.md,01..06-*.md}`

### Production Frontend Implementation (`vaultdrive_client/src/`)
- `vaultdrive_client/src/styles/abrn-unified-vault.css` — Canonical **ABRN Cream** (`#faf8f5` / `#ffffff` / `#7a1f2b`) and **ABRN Slate** (`#1e2330` / `#262c3b` / `#d4aeb0`) CSS variables and `@layer components` tactile classes (`.abrn-btn`, `.abrn-splitter`, `.abrn-file-row`, `.abrn-ingrid-capsule`, `.abrn-doc-thumb`, `.abrn-filter-tab`, `.abrn-type-pill`).
- `vaultdrive_client/src/index.css` — Imported `Plus Jakarta Sans`, `Libre Baskerville`, `JetBrains Mono`, and `./styles/abrn-unified-vault.css`.
- `vaultdrive_client/src/components/layout/sidebar.tsx` — `62px ⟷ 238px` collapsible left rail (`⌘B`), `ABRN Drive · ABRN Asesores` serif crest, `flex-shrink: 0` badges (`AES`, `#key`, `OK`), and `FLUJO CONTABLE` (`Subir y Ordenar`, `Buzón Drop`) custom event triggers.
- `vaultdrive_client/src/components/layout/dashboard-layout.tsx` — `54px` unified topbar with `ABRN Asesores` serif brand, Omnibar `⌘K` search pill, 1-click `ABRN Cream` / `ABRN Slate` switcher, and contextual `/files` accountant CTAs (`Pedir Docs`, `Enviar Carpeta`, `Bloquear`, `Subir y Ordenar`).
- `vaultdrive_client/src/components/vault/VaultTree.tsx` — `CLIENTES Y CARPETAS` header, `[+ Carpeta]`, instant client filter input, `FIJADOS ★` section, folder tree with right-click context support, `ACCESO RÁPIDO` (`Destacados`, `Recibidos vía Drop`), and storage quota footer.
- `vaultdrive_client/src/components/folders/FolderModal.tsx` — 1-click **5-Subfolder Accountant Standard Template** (`01 Expediente Legal`, `02 Constancia y 32-D`, `03 Estados de Cuenta`, `04 Facturas XML`, `05 Entregables`) when creating a client folder.
- `vaultdrive_client/src/components/vault/VaultContextMenu.tsx` — Unified file + folder right-click context menu (`z-[60]`) with viewport collision clamping, keyboard shortcut badges, `Compartir Carpeta #key`, `Pedir Docs (Buzón Drop)`, and `Generar 5 Subcarpetas Base`.
- `vaultdrive_client/src/components/vault/FileGrid.tsx` — Day-grouped headers (`HOY`, `ESTA SEMANA`, `ANTERIORES`), `3.5px` ABRN burgundy active spine, `38×38px` visual format thumbnails (`PDF`, `CFDI`, `XLSX`, `4K`, `MP4`, `CODE`), inline `F2` rename persisted via `POST /api/v1/files/sync`, zero-reflow **Floating In-Grid Action Capsule** (`#key`, `WhatsApp`, `Compartir`, `Renombrar F2`, `Canasta`, `★`, `Acceso`, 2-click armed `¿Borrar?`), and persistent `[⬇]` + `[👁 abrir]` buttons.
- `vaultdrive_client/src/components/vault/StagingDock.tsx` — Floating dark **Canasta `#key` + WhatsApp Lote Dock** (`z-[45]`).
- `vaultdrive_client/src/components/vault/VaultInspectorPane.tsx` — **6-Format RAM Inspector** (`PDF`, `CFDI`, `XLSX`, `4K`, `Video`, `Código`), 2×2 1-click Dispatch Deck (`WhatsApp`, `Enlace #key`, `Renombrar (F2)`, `Copiar SHA-256`), CFDI 4.0 human summary card, collapsible **Pasaporte Criptográfico ABRN**, and sticky bottom dock (`Expandir 94vw`, `Descargar Original`).
- `vaultdrive_client/src/components/vault/SmartUploadOrderModal.tsx` & `.test.tsx` — In-RAM document triage (`triageFileObject`), clean accountant filename suggestions, target subfolder routing, and real 1-click `AES-256-GCM` encryption + upload.
- `vaultdrive_client/src/components/vault/WhatsAppDropRequestModal.tsx` & `.test.tsx` — Interactive SAT/bank document checklist with automatic `Ya recibido` vs `Pendiente` vault detection, real `POST /api/drop/create` `#key` token creation, and live WhatsApp message preview.
- `vaultdrive_client/src/components/vault/FilePreviewModal.tsx` — `94vw × 88dvh` Cinemascope Executive Modal with `Libre Baskerville` title, `Descifrado en RAM · 0 rastros en disco` pill, `FilemonOfficeStage` SAT CFDI 4.0 Glass Twin, and sticky tactical dock.
- `vaultdrive_client/src/pages/files.tsx` — Unified 3-pane orchestration (`180–420px` left tree, `290–560px` right inspector), tactile 4-dot splitters with live `px` drag HUD, `3 Paneles` / `Lista Ancha` / `Lectura` presets, 1px-divided telemetry strip, subfolder quick-pills, 9 underline filter tabs, keyboard shortcuts (`J`/`K`, `F2`, `Space`, `Enter`), and custom topbar/sidebar event listeners.

---

## 3. Exact Commands Executed & Outcomes

1. **Strict TypeScript Check (`vaultdrive_client`):**
   - Command: `npm run typecheck` (`tsc -b && tsc -p tsconfig.e2e.json --noEmit`)
   - Exit code: `0` (`0` errors)
2. **Focused Vitest Suite (`vaultdrive_client`):**
   - Command: `npx vitest run src/config/skin-contrast.test.ts src/config/brand-theme.test.ts src/components/layout/sidebar.test.tsx src/components/layout/dashboard-layout.test.tsx src/components/vault/VaultTreeContrast.test.tsx src/components/vault/FileGrid.test.tsx src/components/vault/StagingDock.test.tsx src/components/vault/VaultInspectorPane.test.tsx src/components/vault/VaultContextMenu.test.tsx src/components/vault/FileSearch.test.tsx src/components/vault/SmartUploadOrderModal.test.tsx src/components/vault/WhatsAppDropRequestModal.test.tsx`
   - Exit code: `0` — **`12/12` test files passed, `108/108` tests passed** (`5.84s`–`5.99s`).
3. **Production Bundle Compilation (`vaultdrive_client`):**
   - Command: `npm run build && sha256sum dist/index.html`
   - Exit code: `0` — Built in `12.57s` (`rawBase is: /abrn`).
   - Final `vaultdrive_client/dist/index.html` SHA-256: `da0e8cffc664cb58385dff6a89b30af01a3c4d7dc904abdab07f4e15fecabe48`.
4. **Live Chromium Verification via `bsk` (`session_id="szzf"`, `https://abrndrive.filemonprime.net/abrn/files`):**
   - Exercised real registration/PIN onboarding, 5-subfolder client creation (`Grupo Roche SA de CV`), `SmartUploadOrderModal` 4-file encrypted upload + SAT CFDI 4.0 XML upload, inline `F2` rename (`Banorte_Estado_de_Cuenta_Nov2026.pdf`) persisted via `POST /api/v1/files/sync`, Floating In-Grid Action Capsule hover, `StagingDock` batch staging, `ABRN Cream` ⟷ `ABRN Slate` switching, `VaultContextMenu` right-click menu, `WhatsAppDropRequestModal` real `POST /api/drop/create` token creation, `94vw` `FilePreviewModal` SAT CFDI 4.0 Glass Twin decryption, and `390×844` mobile regression check (`live-01`..`live-06` PNG & JPG pairs visually audited).
   - Cleanly stopped `bsk` session `szzf` (`stopped: ["szzf"]`).

---

## 4. Post-Build Visual Audit Fixes Confirmed

- **`FND-01` (`StagingDock` & `VaultContextMenu` layer order):** Tuned `StagingDock` to `z-[45]` (above `<aside>` `z-40`, below Radix Dialogs `z-50`) and `VaultContextMenu` to `z-[60]`, eliminating both left-edge sidebar clipping and modal/context-menu overlap.
- **`FND-02` (`VaultInspectorPane` tab & button truncation at `368px`):** Shortened tab label to `CFDI` with `whitespace-nowrap` and arranged the 4 quick actions in a `2×2` grid (`grid-cols-2`) so every button renders crisp and unclipped.
- **`FND-03` (`WhatsAppDropRequestModal` `Ya recibido` checkbox sync):** Synced `selectedIds` with `receivedMap` on modal open so documents already present in the vault (`Ya recibido`) start unchecked automatically.
- **`FND-04` (`abrn-unified-vault.css` `@layer components` cascade):** Wrapped `.abrn-*` component rules in `@layer components` so Tailwind v4 `@layer utilities` (`hidden`, `md:inline-flex`, `lg:flex`) hide desktop buttons and splitters cleanly on `<768px` mobile viewports.
- **`FND-05` (`SmartUploadOrderModal` SAT CFDI 4.0 XML namespaces):** Added `xmlns:cfdi`, `xmlns:tfd`, and `<tfd:TimbreFiscalDigital>` to the sample XML generator so `FilePreviewModal` (`94vw`) renders the full SAT CFDI 4.0 Glass Twin.

---

## 5. Remaining Risks & Guardrails

- Zero regressions to client-side `AES-256-GCM` encryption, `#fragment` link keys, or `abrndrive.service` (service was untouched and running cleanly throughout).
- Physical hardware passkey ceremonies and multi-device human acceptance gates noted in `README.md` remain governed by the release owner's coordinated release runbook.

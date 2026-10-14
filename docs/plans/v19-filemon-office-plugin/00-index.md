# Ticket & Plan v19: Filemón Office Plugin (`filemon-office-mx` + `filemon-modal-uix` + `Live Glass Twin`)

> **Ticket ID:** `TICKET-2026-10-14-FILEMON-OFFICE-PLUGIN`  
> **Status:** `verified_and_archived`  
> **Host OS:** ABRN-Drive (`VaultDrive`) — acting as the "Windows" encrypted file system  
> **Plugin Module:** **Filemón Office** — pluggable zero-knowledge file handler for **ABRN-Drive**, **Quantix ABRN SAT**, and **Amarre Fiscal (Roche)**  
> **UI/UX Architecture:** `filemon-modal-uix` (`92vw` Cinemascope 3-Zone Modal) + `21-brenda-executive-modal-dock` (Frozen Bottom Tactical Dock) + `skill-for-filemon-or-something` (Live Glass Twin) + `premium-large-data-grid` (Sheet Grid)

---

## 📋 Fidelity Contract (Contrato de Fidelidad)

| Pedido Literal | Resultado Observable | Invariantes Conservados | Prueba de Aceptación |
|---|---|---|---|
| *"New module: Filemon Office. But it's only a plugin, an extra, a file handler inside Quantix ABRN SAT and Amarre Fiscal (Roche for the moment). Just imagine ABRN Drive is like Windows, and now we got our own Filemon Office to open files inside ABRN Drive, and the UIX is based on filemon glass and modal skills. Turn it into a ticket and solve it. Archive it when done."* | Abrir un archivo (`.xml` CFDI 4.0, `.xlsx`, `.csv`, `.tsv`, `.json`, `.md`, `.pdf`) dentro de ABRN-Drive delega la vista al plugin **Filemón Office** dentro de un modal Cinemascope (`92vw`) de 3 zonas: (1) Header Hero congelado con insignia de Filemón Office / Quantix ABRN SAT / Amarre Fiscal (Roche); (2) Deck de Despacho Instantáneo + **Gemelo en Vivo (Live Glass Twin)** para facturas CFDI 4.0 y **Workbench de Hojas de Cálculo** (`.xlsx`/`.csv`) con pestañas, buscador e inspector de celdas; (3) Dock Táctico Inferior fijo con botón `← Volver a Bóveda (Esc)` (`48px`), recibo SHA-256 central y acción primaria `Descargar Original` / `Copiar Ficha Amarre Fiscal (Roche)`. | 100% de los tests existentes de `FilePreviewModal.test.tsx` (`12/12`) siguen pasando; los bytes originales cifrados permanecen inmutables (`0 bytes delta`); el descifrado ocurre únicamente en memoria RAM del navegador (`SessionVault`); y la suite global se mantiene en hold según instrucción del dueño. | `npm run typecheck` (`0 errors`), Vitest enfocado en `filemon-office.test.ts`, `FilemonOfficeStage.test.tsx` y `FilePreviewModal.test.tsx` (`100% PASS`), `npm run build` limpio, auditoría post-build `check-post-build-audit.py` en `PASS` (`exit 0`), y ticket archivado en `docs/tickets/archived/`. |

---

## 🗺️ Sequential Step-by-Step Plan Index

1. [Step 01: Ticket Definition & Normalized Filemón Office Contract (`01-ticket-and-office-contract.md`)](01-ticket-and-office-contract.md)  
   *Defines the pluggable `FilemonOfficeDocumentContract` for humans and AI agents (Quantix ABRN SAT & Amarre Fiscal — Roche), original SHA-256 lineage, and zero-knowledge RAM parsing bounds.*
2. [Step 02: In-Memory CFDI 4.0 XML & Multi-Sheet `.xlsx`/`.csv` Parser Engine (`02-cfdi-and-spreadsheet-engine.md`)](02-cfdi-and-spreadsheet-engine.md)  
   *Implements `filemon-office.ts` using browser `DOMParser` (XXE-safe) for CFDI 4.0/3.3 invoices and `JSZip` for OOXML `.xlsx` workbooks + RFC 4180 `.csv`/`.tsv` sheets.*
3. [Step 03: Filemón Office Stage — Live Glass Twin & Sheet Grid (`03-filemon-office-stage-ui.md`)](03-filemon-office-stage-ui.md)  
   *Builds `FilemonOfficeStage.tsx` with the 1-Click Instant Dispatch Deck, Executive CFDI 4.0 Live Glass Twin ("Así se verá"), Interactive Spreadsheet Grid (`premium-large-data-grid`), and Amarre Fiscal (Roche) JSON/Citation exporter.*
4. [Step 04: Cinemascope 3-Zone Modal & Sticky Tactical Dock Integration (`04-cinemascope-modal-dock-integration.md`)](04-cinemascope-modal-dock-integration.md)  
   *Upgrades `FilePreviewModal.tsx` with the `92vw` Cinemascope viewport, Frozen Hero Header (Zone 1), Filemón Office Plugin host (Zone 2), and Frozen Sticky Bottom Tactical Dock (Zone 3) while preserving all existing preview tests.*
5. [Step 05: Post-Build Audit, Verification & Ticket Archival (`05-verification-and-archive.md`)](05-verification-and-archive.md)  
   *Executes focused unit/component verification, runs `check-post-build-audit.py`, updates memories/reports/README, and archives the resolved ticket under `docs/tickets/archived/`.*

---

## 📊 Execution Ledger

| Step | Title | Status | Evidence |
|---|---|---|---|
| **01** | Ticket & Normalized Office Contract | `verified` | `vaultdrive_client/src/utils/filemon-office.ts` |
| **02** | CFDI 4.0 XML & `.xlsx`/`.csv` Engine | `verified` | `vaultdrive_client/src/utils/filemon-office.test.ts` |
| **03** | Filemón Office Stage (Glass Twin + Grid) | `verified` | `vaultdrive_client/src/components/vault/FilemonOfficeStage.tsx` |
| **04** | Cinemascope 3-Zone Modal & Sticky Dock | `verified` | `vaultdrive_client/src/components/vault/FilePreviewModal.tsx` |
| **05** | Post-Build Audit & Ticket Archival | `verified` | `docs/tickets/archived/2026-10-14-ticket-v19-filemon-office-plugin.md` |

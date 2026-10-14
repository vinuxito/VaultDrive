# Step 03: Filemón Office Stage — Live Glass Twin & Sheet Grid

## 1. Resulting Behavior & Prerequisites
- Implements `FilemonOfficeStage.tsx` following `skill-for-filemon-or-something` (Live Glass Twin) and `premium-large-data-grid`:
  - **1-Click Instant Dispatch Deck (`21-brenda-executive-modal-dock`):**
    - Mode switcher: `✨ Vista Ejecutiva (Glass Twin)` | `</> Fuente Original` | `🤖 Ficha SAT / Amarre Fiscal (Roche)`
    - Quick actions: `📋 Copiar Cita / UUID`, `🤝 Copiar JSON Amarre Fiscal`, `💬 Enviar Resumen WhatsApp`
  - **CFDI 4.0 Live Glass Twin ("Así se verá"):**
    - Executive fiscal header with `TipoDeComprobante` pill, `UUID`, `Fecha`, and bold tabular `Total` in `Moneda`.
    - Side-by-side **Emisor** and **Receptor** cards with 1-click RFC copy.
    - **Conceptos Grid (`premium-large-data-grid`):** Clave SAT, Cantidad, Unidad, Descripción, Valor Unitario, Importe.
    - **Totales & Impuestos Summary:** SubTotal, Descuento, Traslados (IVA), Retenciones, Total.
    - **Honest Truth Footer:** *"Vista previa generada en navegador (Filemón Office). No sustituye la validación de vigencia ante el SAT."*
  - **Spreadsheet Workbench (`.xlsx` / `.csv` / `.tsv`):**
    - Sheet tabs (`Hoja 1`, `Hoja 2`...) with row counts.
    - Instant row search filter (`Filtrar filas en esta hoja...`).
    - Selected Cell Inspector bar (`Hoja1!B2` • raw value • formula if present • 1-click Copy Citation with SHA-256).
    - Bounded high-contrast table grid with column letters (`A, B, C...`) and row numbers (`1..N`).

## 2. Files Owned
- `vaultdrive_client/src/components/vault/FilemonOfficeStage.tsx`
- `vaultdrive_client/src/components/vault/FilemonOfficeStage.test.tsx`
- `vaultdrive_client/src/locales/en/drive.json`
- `vaultdrive_client/src/locales/es/drive.json`

## 3. Exit Condition
- `FilemonOfficeStage.test.tsx` passes 100% of component tests for CFDI Glass Twin, Spreadsheet Grid, Cell Citation copy, and Amarre Fiscal (Roche) dispatch.

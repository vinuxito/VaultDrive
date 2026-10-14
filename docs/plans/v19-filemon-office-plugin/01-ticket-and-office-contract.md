# Step 01: Ticket Definition & Normalized Filemón Office Contract

## 1. Resulting Behavior & Prerequisites
- **Ticket ID:** `TICKET-2026-10-14-FILEMON-OFFICE-PLUGIN`
- **Role in Ecosystem:** ABRN-Drive is the host Operating System ("Windows"). **Filemón Office** is the pluggable document handler that opens decrypted files in-place and produces a normalized, citable representation for humans and AI agents across **ABRN-Drive**, **Quantix ABRN SAT**, and **Amarre Fiscal (Roche)**.
- **Normalized Contract (`FilemonOfficeDocumentContract`):**
  - `identity`: `{ document_id, sha256, filename, bytes }`
  - `plugin`: `{ module: "filemon-office-mx", host: "ABRN-Drive", targets: ["Quantix ABRN SAT", "Amarre Fiscal (Roche)"] }`
  - `kind`: `"cfdi_xml" | "generic_xml" | "spreadsheet" | "pdf" | "json" | "markdown" | "text" | "media"`
  - `headline`: concise human summary (e.g., `"$28,450.00 MXN • Emisor: ROCHE MEXICO SA DE CV"` or `"2 Hojas • 128 filas"`)
  - `cfdi`: parsed Mexican CFDI 4.0 / 3.3 facts (`version`, `serie`, `folio`, `fecha`, `moneda`, `subTotal`, `descuento`, `total`, `tipoDeComprobante`, `metodoPago`, `formaPago`, `lugarExpedicion`, `emisor`, `receptor`, `conceptos`, `impuestos`, `timbre`, and `amarreFiscalRochePayload`)
  - `spreadsheet`: parsed sheets (`name`, `headers`, `rows`, `totalRows`, `totalCols`, `truncated`)
  - `notices`: explicit truth notices (e.g. *"Estructura CFDI leída en memoria RAM. Validación ante el SAT no ejecutada."*)
  - `citation`: `{ sha256, locator }`

## 2. Files Owned
- `vaultdrive_client/src/utils/filemon-office.ts`
- `vaultdrive_client/src/utils/filemon-office.test.ts`

## 3. Exit Condition
- `canHandleWithFilemonOffice(filename)` accurately identifies Office-handled extensions (`.xml`, `.xlsx`, `.csv`, `.tsv`, `.json`, `.md`, `.txt`, `.pdf`).
- `parseFilemonOfficeDocument()` returns a deterministic `FilemonOfficeDocumentContract` anchored to the file's SHA-256 hash.

# Step 02: In-Memory CFDI 4.0 XML & Multi-Sheet `.xlsx`/`.csv` Parser Engine

## 1. Resulting Behavior & Prerequisites
- **CFDI 4.0 / 3.3 XML Engine:**
  - Uses browser `DOMParser` (`text/xml`) after stripping UTF-8 BOM and rejecting external entities (`<!ENTITY` / `SYSTEM` / `PUBLIC` DTD expansion).
  - Extracts attributes regardless of attribute order or namespace prefix (`cfdi:`, `tfd:`):
    - `Comprobante`: `Version`, `Serie`, `Folio`, `Fecha`, `SubTotal`, `Descuento`, `Moneda`, `Total`, `TipoDeComprobante`, `MetodoPago`, `FormaPago`, `LugarExpedicion`.
    - `Emisor`: `Rfc`, `Nombre`, `RegimenFiscal`.
    - `Receptor`: `Rfc`, `Nombre`, `UsoCFDI`, `DomicilioFiscalReceptor`, `RegimenFiscalReceptor`.
    - `Conceptos`: array of `{ claveProdServ, cantidad, claveUnidad, descripcion, valorUnitario, importe }`.
    - `Impuestos`: `totalImpuestosTrasladados`, `totalImpuestosRetenidos`.
    - `TimbreFiscalDigital`: `uuid`, `fechaTimbrado`, `rfcProvCertif`, `selloCFD`, `selloSAT`.
  - Generates a ready-to-use `amarreFiscalRochePayload` JSON object for **Quantix ABRN SAT** and **Amarre Fiscal (Roche)**.
- **Multi-Sheet `.xlsx` & `.csv`/`.tsv` Engine:**
  - Uses `JSZip` (already installed in `vaultdrive_client/package.json`) to inspect `.xlsx` archives in browser RAM with strict expansion bounds (`≤ 200` rows × `≤ 32` columns per sheet window).
  - Reads `xl/workbook.xml` for real sheet names, `xl/sharedStrings.xml` for shared string tables, and `xl/worksheets/sheet*.xml` for cell values (`t="s"`, `t="inlineStr"`, numeric/cached values, and `<f>` formula strings).
  - Parses `.csv` and `.tsv` using a quote-aware RFC 4180 state machine into the same `OfficeSheet` structure.

## 2. Files Owned
- `vaultdrive_client/src/utils/filemon-office.ts`
- `vaultdrive_client/src/utils/filemon-office.test.ts`

## 3. Exit Condition
- Unit tests in `filemon-office.test.ts` verify real CFDI 4.0 XMLs, multi-sheet `.xlsx` buffers created with `JSZip`, `.csv` tables, and hostile XML rejection.

# v18 Step 02: Client-Side Smart Document Triage & Auto-Naming
> **Autonomous Zero-Knowledge Pattern Recognition for Business Documents**

---

## 1. Objective
Develop [`vaultdrive_client/src/utils/document-triage.ts`](file:///lamp/www/ABRN-Drive/vaultdrive_client/src/utils/document-triage.ts) to analyze incoming files (CFDI XML, SAT certificates, legal contracts, receipts) in browser memory prior to encryption, detecting document category, auto-suggesting standardized filenames, and generating searchable tags with zero human effort.

---

## 2. Document Detection Profiles

1. **CFDI / Factura SAT (XML / PDF):**
   - Pattern: XML tags `<cfdi:Comprobante>`, `<cfdi:Emisor Nombre="..." Rfc="...">`, `Total="..."`, `Fecha="..."`.
   - Extracted metadata: RFC, Emisor, Total, Moneda, UUID/Folio.
   - Suggested Filename: `CFDI_{RFC}_{Total}_{YYYY-MM-DD}.xml` or `Factura_{Emisor}_{YYYY-MM-DD}.pdf`.
   - Tags: `['cfdi', 'factura', 'sat', 'fiscal']`.

2. **Constancia de Situación Fiscal (SAT):**
   - Pattern: "CONSTANCIA DE SITUACIÓN FISCAL", "Cédula de Identificación Fiscal", RFC format `[A-Z&Ñ]{3,4}\d{6}[A-V1-9][A-Z1-9][0-9A]`.
   - Extracted metadata: RFC, Razón Social.
   - Suggested Filename: `Constancia_SAT_{RFC}_{YYYY-MM}.pdf`.
   - Tags: `['sat', 'constancia', 'rfc', 'fiscal']`.

3. **Contratos y Asuntos Legales:**
   - Pattern: "CONTRATO DE ARRENDAMIENTO", "CONTRATO DE PRESTACIÓN DE SERVICIOS", "PODER NOTARIAL", "ESCRITURA PÚBLICA".
   - Extracted metadata: Tipo de Contrato, Partes, Fecha.
   - Suggested Filename: `Contrato_{Tipo}_{YYYY-MM-DD}.pdf`.
   - Tags: `['contrato', 'legal', 'firma']`.

4. **Comprobantes Bancarios / Recibos:**
   - Pattern: "SPEI", "Transferencia Interbancaria", "CLABE", "Comprobante de Pago".
   - Extracted metadata: Banco, Monto, Referencia.
   - Suggested Filename: `Comprobante_Pago_{Monto}_{YYYY-MM-DD}.pdf`.
   - Tags: `['banco', 'spei', 'pago', 'recibo']`.

---

## 3. Implementation Target
- Create `vaultdrive_client/src/utils/document-triage.ts`
- Create unit test: `vaultdrive_client/src/utils/document-triage.test.ts`
  - Test CFDI XML parsing and auto-naming.
  - Test SAT Constancia text heuristic.
  - Test fallback for generic binary files (images, zip, general pdf).
  - Verify zero latency (<3ms for text/xml).

---

## 4. Verification Gate
- Targeted Vitest: `npx vitest run src/utils/document-triage.test.ts`
- `npm run typecheck` clean.

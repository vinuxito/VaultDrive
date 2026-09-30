# Step 05: Public Drop & Recipient Portal Hardening

- **Title**: Public Drop & Recipient Portal Hardening (El Recibo Sagrado for Outside Users)
- **Category**: `product / UX`
- **Owner**: Frontend Core / Public Surfaces
- **Affected Files**:
  - `vaultdrive_client/src/pages/drop-upload.tsx`
  - `vaultdrive_client/src/pages/FileRequestPage.tsx`
  - `vaultdrive_client/src/pages/PublicSharePage.tsx`
  - `vaultdrive_client/src/utils/transferSlip.ts`
  - `vaultdrive_client/src/locales/es/drop.json`
  - `vaultdrive_client/src/locales/en/drop.json`

---

## 1. Why It Matters Now

External clients (taxpayers, vendors, and consulting partners) rarely log into ABRN Drive; their entire relationship with the product happens on public intake routes:
- `/drop/:token` (Secure Drop portals)
- `/request/:token` (File Requests)
- `/share/:token` (Public share links)

Currently, after uploading confidential tax declarations or financial audits, the client is shown a plain checkmark and a generic sentence: `"Upload complete"`. 

This lack of proof triggers immediate human anxiety:
- *"¿Sí le llegó al contador?"*
- *"¿A qué hora se subió?"*
- *"¿Cómo compruebo que mandé los papeles a tiempo antes de la fecha límite?"*

Clients end up taking smartphone photos of their computer screen or calling the office to confirm receipt. Furthermore, if a client is uploading from their phone on an unstable cellular connection and a chunk fails, the upload aborts with a generic red alert and clears their selected files, forcing them to start over from scratch.

---

## 2. What Exactly Should Be Done

### A. Implement "El Recibo Sagrado" (The Sacred Intake Receipt)
In `vaultdrive_client/src/pages/drop-upload.tsx` and `FileRequestPage.tsx`:
1. When uploads succeed, replace the static confirmation with a prominent, dignified **Comprobante de Entrega Digital**:
   - **Nombre de la Entrega**: (e.g., *"Portal: Declaraciones Anuales RG Consulting"*).
   - **Folio Único Verificable**: (e.g., `ABRN-DRP-8472-F9`).
   - **Fecha y Hora Exacta**: (e.g., `30 de septiembre de 2026 · 11:52:14 CST`).
   - **Lista de Documentos Blindados**: File names, formatted sizes, and cryptographic SHA-256 seal.
   - **Sello de No Manipulación**: Reassuring notice (*"Tus archivos se entregaron directamente en la bóveda de ABRN Asesores. Nadie más tiene acceso."*).
2. Action levers:
   - **1-Tap WhatsApp Share**: Pre-fills: *"Hola, acabo de subir mis documentos a ABRN Asesores. Folio: ABRN-DRP-8472-F9. Archivos: constancia_fiscal.pdf, balance.xlsx."*
   - **Descargar Comprobante PDF/TXT**: Generates an immediate offline receipt for the client's records.

### B. Network Recovery & Retry Levers (Iron Law 4)
In `drop-upload.tsx`:
1. If an upload connection drops mid-flight (HTTP 502/503/network error):
   - **Do not clear the selected files array.**
   - Display an amber barrio recovery card:
     > *"Se nos cortó la señal tantito, pero tus archivos siguen seleccionados en tu teléfono. Pícale aquí para reintentar."*
   - Provide an explicit, prominent **"Reintentar subida"** button.

---

## 3. What Existing Work It Builds On
- Builds on existing `transferSlip.ts` cryptographic voucher generator.
- Builds on `drop-upload.tsx` and `FileRequestPage.tsx` client crypto pipelines.

---

## 4. What Risks It Avoids
- Avoids repetitive telephone calls and WhatsApp messages asking office staff to manually verify file arrivals.
- Avoids lost client submissions due to intermittent cellular connections.

---

## 5. Expected Payoff
- Immense boost in client confidence and institutional prestige for ABRN Asesores.
- Zero support overhead for file verification.

---

## 6. Definition of Done & Testable Acceptance Criteria

1. **Automated Unit Tests**:
   - `drop-upload.test.tsx` simulates successful file intake and asserts the presence of:
     - Verified Folio code matching `/ABRN-DRP-[A-Z0-9-]+/`.
     - Timestamp and file size.
     - "Mandar por WhatsApp" link with pre-filled message text.
   - Simulates network failure and asserts the selected files remain in memory with a visible "Reintentar subida" button.
2. **Strict TypeScript & Build**:
   - `npm run typecheck`: 0 errors.
3. **Live Mobile Verification on Android 13**:
   - Walk the `/drop/:token` flow on native Android Chrome; complete an upload; verify the receipt card renders crisply within the viewport and WhatsApp share triggers the Android intent.

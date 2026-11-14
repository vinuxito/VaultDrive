# Step 05 — 6-Format RAM Inspector, Smart Upload & Auto-Order Modal, and WhatsApp Secure Drop Modal

## Target Files
- `vaultdrive_client/src/components/vault/VaultInspectorPane.tsx`
- `vaultdrive_client/src/components/vault/SmartUploadOrderModal.tsx` (new)
- `vaultdrive_client/src/components/vault/WhatsAppDropRequestModal.tsx` (new)
- `vaultdrive_client/src/pages/files.tsx`

## Implementation Details
1. **`VaultInspectorPane.tsx`:**
   - Emerald `VISTA RÁPIDA EN RAM · SIN DESCARGAR` kicker + `Libre Baskerville` filename + `Maximize` (`Expandir 94vw`) & `Close` buttons.
   - **6-Format Switcher Tabs** (`PDF`, `XML CFDI`, `XLSX`, `4K`, `Video`, `Código`) including dedicated Mexican `CFDI 4.0` fiscal card preview (Emisor, Receptor, UUID, Subtotal/IVA/Total) while maintaining backward compatibility with existing `VaultInspectorPane.test.tsx` `data-testid` hooks!
   - **1-Click Dispatch Deck:** `WhatsApp` (green), `Enlace #key` (burgundy/rose), `Renombrar`, `SHA-256`.
   - **Collapsible Pasaporte Criptográfico ABRN:** `AES-256-GCM · 64 KB`, `SHA-256`, link/origin status, and sticky bottom dock (`Expandir 94vw`, `Descargar Original`).
2. **`SmartUploadOrderModal.tsx` (`Subir y Ordenar Archivos Sueltos`):**
   - Drag-and-drop / multi-file picker powered by `triageFileObject` (`document-triage.ts`) that inspects files 100% in browser RAM, suggests clean accountant filenames (`CFDI_Factura_...`, `Constancia_SAT_...`, `Comprobante_SPEI_...`, etc.) and maps each category to the 5 standard subfolders (`01 Expediente Legal`..`05 Entregables`) or active folders, allowing inline edits before encrypting (`AES-256-GCM`) and uploading!
3. **`WhatsAppDropRequestModal.tsx` (`Solicitar Documentos por WhatsApp`):**
   - Interactive accountant checklist (`Constancia de Situación Fiscal actualizada`, `Estado de Cuenta Bancario`, `Opinión de Cumplimiento 32-D`, `Comprobante de Domicilio reciente`, `Carátula Bancaria con CLABE`), target folder selector, PIN trust integration (`POST /api/drop/create`), live WhatsApp message preview, `Copiar Link Drop`, and 1-click `Enviar Solicitud por WhatsApp` (`https://wa.me/?text=...`).

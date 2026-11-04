# Step 02: Docked Resizable Live Preview & Cryptographic Inspector Pane (`VaultInspectorPane.tsx`)

## Goal
Build the right-hand docked **Live Preview & Cryptographic Inspector Pane** (`vaultdrive_client/src/components/vault/VaultInspectorPane.tsx`) matching the right split pane of `/abrn/previews/drive.html`.

## Technical Changes
1. **`vaultdrive_client/src/components/vault/VaultInspectorPane.tsx`**:
   - Displays the selected file's title in `Libre Baskerville` serif, size, and origin/folder metadata.
   - Provides interactive 5-Format tabs (`1. PDF`, `2. Imagen 4K`, `3. Video 64KB`, `4. Código`, `5. XLSX`) with live zoom (`-`/`100%`/`+`), 90° rotation (`Rotar 90°`), 64 KB AES-GCM block streaming counter, code viewer, and interactive XLSX formula bar (`fx`).
   - Renders the 1-Click Dispatch Bar (`Enlace #key`, `WhatsApp`, `Firmar RSA`, `SHA-256`).
   - Renders the Cryptographic Lineage Footer (`AES-256-GCM · 0 bytes en claro`, `Sello SHA-256`, `Enlaces #key`) and bottom action bar (`Expandir 94vw` + burgundy `Descargar Original`).
2. **`vaultdrive_client/src/components/vault/VaultInspectorPane.test.tsx`**:
   - Unit tests verifying format tab switching, XLSX formula bar updates, SHA-256 copy callback, and `Expandir 94vw` modal trigger.

## Verification Criteria
- `npx vitest run src/components/vault/VaultInspectorPane.test.tsx` passes 100%.

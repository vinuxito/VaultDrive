# Step 04: Enhanced Context-Aware Right-Click Menu & Quick Dispatch

## Goal
Enhance `vaultdrive_client/src/components/vault/VaultContextMenu.tsx` with 1-click WhatsApp `#key` dispatch (`W`) and single-file Staging Dock queuing (`X`) matching `/abrn/previews/drive.html`.

## Technical Changes
1. **`vaultdrive_client/src/components/vault/VaultContextMenu.tsx`**:
   - Add optional `onWhatsAppShare?: (file: any) => void` (`Enviar por WhatsApp`, shortcut `W`) and `onStageFile?: (file: any) => void` (`Enviar al Staging Dock`, shortcut `X`) to single-file context menus.
   - Style the context menu header and shortcut pills to match the ABRN Warm Cream & Slate palette.
2. **`vaultdrive_client/src/pages/files.tsx`**:
   - Wire `onWhatsAppShare` and `onStageFile` into `<VaultContextMenu />`.

## Verification Criteria
- `npx vitest run src/components/vault/VaultContextMenu.test.tsx` passes 100%.

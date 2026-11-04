# Step 03: 3-Pane Resizable Workspace, Telemetry Subheader & FileGrid Badges

## Goal
Upgrade `/files` (`vaultdrive_client/src/pages/files.tsx`) and `FileGrid.tsx` (`vaultdrive_client/src/components/vault/FileGrid.tsx`) to deliver the full 3-pane resizable workspace (`VaultTree` ⟷ `FileGrid` ⟷ `VaultInspectorPane`) and ABRN visual hierarchy from `/abrn/previews/drive.html`.

## Technical Changes
1. **`vaultdrive_client/src/pages/files.tsx`**:
   - Upgrade the Vault Hero Subheader with the `Blindado · AES-256-GCM` emerald status pill, helper subtitle, **1px-Divided Telemetry Strip** (`Archivos visibles` | `Enlaces #key activos` | `SHA-256 100% íntegro`), and `Inspector (⌘I)` toggle button.
   - Add the second draggable vertical splitter (`splitter-right`, `role="separator"`, `aria-label="Resize preview inspector pane"`) with burgundy grip handle and double-click / `⌘I` collapse support.
   - Mount `<VaultInspectorPane />` as Pane 3 in the workspace split container.
2. **`vaultdrive_client/src/components/vault/FileGrid.tsx`**:
   - Render color-coded format badges (`PDF`, `4K`, `MP4`, `SH`, `XLSX`, `XML`) per file row while preserving all existing test selectors, checkboxes, and action buttons.

## Verification Criteria
- `npx vitest run src/components/vault/FileGrid.test.tsx` and `npm --prefix vaultdrive_client run typecheck` pass 100%.

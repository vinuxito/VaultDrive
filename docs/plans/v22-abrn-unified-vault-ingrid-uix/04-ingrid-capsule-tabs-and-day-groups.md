# Step 04 — Unified Center Explorer: Subfolder Pills, Underline Count Tabs, Day Groups & Floating In-Grid Capsule

## Target Files
- `vaultdrive_client/src/components/vault/FileSearch.tsx`
- `vaultdrive_client/src/components/vault/FileGrid.tsx`
- `vaultdrive_client/src/components/vault/StagingDock.tsx`
- `vaultdrive_client/src/pages/files.tsx`

## Implementation Details
1. **Subfolder Strip + 9 Live-Count Underline Tabs (`FileSearch.tsx` / `files.tsx`):**
   - Desktop subfolder quick-pill bar (`Todas` + child/root folders) and 9 underline tabs with live monospace counts (`Todos`, `Fijados`, `Recibidos Drop`, `PDF`, `XML CFDI`, `XLSX`, `4K y Video`, `Código`, `Enlaces #key`), while preserving backward-compatible `FileTypeFilter` props for tests and mobile!
2. **Day-Grouped In-Grid Rows + Floating Capsule (`FileGrid.tsx`):**
   - Group files into `HOY`, `ESTA SEMANA`, and `ANTERIORES` with right-aligned `N ÍTEMS` count headers.
   - `3.5px` ABRN burgundy left spine (`before:bg-primary`), `38×38px` visual document mini-thumbnails (`PDF`, `XML`, `XLSX`, `4K`, `MP4`, `SH` with color bar & document lines), inline gold `★` star, origin + folder + `SHA:<8hex>` subtext, semantic badge (`DROP CLIENTE`, `CFDI 4.0`, `ENLACE #KEY`, `HOJA XLSX`, `IMAGEN 4K`, `STREAM 64KB`, `SCRIPT`).
   - **In-Grid Inline Rename (`F2` or capsule pencil):** Inline `<input>` right inside the row that calls `onRenameFile(file, newName)` (`POST /api/v1/files/sync` with `type: "rename"` + optimistic UI update + offline queue fallback).
   - **Zero-Reflow Floating In-Grid Action Capsule (`position: absolute`):** Overlays `size + date` on hover/selected rows without shifting layout: `[🔗 Enlace #key]`, `[💬 WhatsApp]`, `[✏️ Renombrar (F2)]`, `[🛍 Canasta]`, `[★ Fijar]`, `|`, **2-click armed `[🗑]` -> `[¿Borrar?]`**, `[⋯]`, alongside persistent `[⬇]` and `[👁 abrir]` buttons!
3. **Canasta `#key` Dock (`StagingDock.tsx`) + Shortcut Hint Bar:**
   - Dark floating pill (`N archivos en Canasta` + green `WhatsApp (#key Lote)` + `Bajar ZIP` + `Recibo` + `Vaciar`) and bottom tactile shortcut bar (`Arrastra ⋮ para redimensionar · Mouse en fila o clic derecho para acciones rápidas | J / K | F2 Renombrar | Espacio | Enter 94vw`).

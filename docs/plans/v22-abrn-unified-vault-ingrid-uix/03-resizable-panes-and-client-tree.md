# Step 03 — Resizable Client & Folder Tree + 5-Subfolder Accountant Template

## Target Files
- `vaultdrive_client/src/components/vault/VaultTree.tsx`
- `vaultdrive_client/src/components/folders/FolderModal.tsx`
- `vaultdrive_client/src/components/vault/VaultContextMenu.tsx`
- `vaultdrive_client/src/pages/files.tsx`

## Implementation Details
1. **`VaultTree.tsx`:**
   - Top `CLIENTES Y CARPETAS` kicker + `[+ Carpeta]` button + instant folder filter input (`Ir rápido a carpeta o cliente…`).
   - Sections for `CARPETAS Y CLIENTES`, `FILTROS RÁPIDOS` (`Todos los archivos`, `Destacados ★`, `Recibidos vía Drop`, `Compartidos conmigo`), `BUZONES SECURE DROP`, and encrypted storage footer (`Clic derecho en carpeta para opciones`).
2. **`FolderModal.tsx` & `files.tsx`:**
   - Optional 1-click toggle in `FolderModal` (`mode === "create"`): *"Crear las 5 subcarpetas contables base automáticamente (`01 Expediente Legal`, `02 Constancia y 32-D`, `03 Estados de Cuenta`, `04 Facturas XML`, `05 Entregables`)"* that creates the parent folder + 5 child subfolders via `POST /api/folders`.
   - Also expose `Generar 5 Subcarpetas Base` and `Pedir Documentos (Drop)` directly in `VaultContextMenu` when right-clicking any folder.

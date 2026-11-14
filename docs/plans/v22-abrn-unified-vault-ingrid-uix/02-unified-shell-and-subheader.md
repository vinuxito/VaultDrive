# Step 02 — Unified Shell, Topbar Actions, Subheader Presets & Tactile Splitters

## Target Files
- `vaultdrive_client/src/styles/skins.css`
- `vaultdrive_client/src/components/layout/sidebar.tsx`
- `vaultdrive_client/src/components/layout/dashboard-layout.tsx`
- `vaultdrive_client/src/pages/files.tsx`

## Implementation Details
1. **`sidebar.tsx` (`62px ⟷ 238px` ABRN Rail):**
   - Expanded rail width `w-[238px]`, compact `w-[62px]`, `ABRN Drive · ABRN Asesores` brand header, quick triggers on `/files` (`Subir y Ordenar`, `Buzón Drop`) alongside canonical routes (`Mis Archivos`, `Compartidos`, `Grupos`, `Centro de Acceso`), and `shrink-0` badges so labels never touch pills.
2. **`dashboard-layout.tsx` (Unified Topbar):**
   - `ABRN Asesores` `Libre Baskerville` header identity, Omnibar search bar (`Busca por cliente, banco, RFC, #etiqueta o sello SHA-256… ⌘K`), `ABRN Cream` / `ABRN Slate` mode bar, plus desktop `/files` quick actions (`Pedir Docs`, `Enviar Carpeta`, `Bloquear`, `Subir y Ordenar`) bridged cleanly via custom window events (`abrn-vault-action`).
3. **`files.tsx` (Subheader + Layout Presets + Tactile Splitters):**
   - Subheader with `Bóveda ABRN › <Active Folder>`, `Libre Baskerville` heading, `Blindado · AES-256-GCM` emerald pulse pill, `3 Paneles | Lista Ancha | Lectura` preset buttons, clickable `1px`-divided Telemetry Strip (`Archivos`, `Drop Cliente`, `Enlaces #key`, `SHA-256 100% íntegro`), and `10px` 4-dot grip vertical splitters with live `px` HUD (`248 px` / `368 px`) while dragging.

# Step 4: Drive and Dashboard Features

**Objective:** Translate the core user experience: the file explorer, context menus, share modals, and dashboard views.

## Action Plan

### 1. File Explorer
- Table/Grid Headers: "Name", "Size", "Modified", "Owner" -> "Nombre", "Tamaño", "Modificado", "Propietario".
- Empty states: "Drop files here or click to upload" -> "Arrastra archivos aquí o haz clic para subir".
- Toast notifications: "File uploaded successfully" -> "Archivo subido correctamente".

### 2. Context Menus & Actions
- Translate right-click menu items: Preview, Download, Share, Rename, Move, Delete.
- Handle dynamic text carefully: "Delete {{fileName}}?" -> "¿Eliminar {{fileName}}?".

### 3. Modals (Share, Rename, Delete)
- The Share modal is complex. Translate roles (Viewer, Editor -> Lector, Editor).
- Translate the copy link actions ("Copy Link", "Link copied!").
- Warning text on destructive actions: "Are you sure you want to permanently delete this item? This action cannot be undone."

### 4. Upload States
- The upload progress widget needs translations for "Uploading...", "{{count}} files remaining", and "Upload complete". 
- Pay special attention to pluralization in `i18next`:
  ```json
  "uploading": {
    "file_one": "Subiendo 1 archivo...",
    "file_other": "Subiendo {{count}} archivos..."
  }
  ```

## Verification
- Upload a file and verify the progress widget in both languages.
- Right-click a file and verify all context menu options.
- Open the share modal and confirm role dropdowns and input placeholders are translated.

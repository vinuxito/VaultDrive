# Step 04: 5-Format `MobileInspectorSheet` & Mobile File Card Touch Actions

- **Goal:** Build `MobileInspectorSheet.tsx` matching Scenario 4 of `/abrn/previews/mobile.html` (`PDF`, `4K`, `MP4`, `CFDI`, `XLSX` RAM preview tabs, Sacred SHA-256 Receipt bar, full-screen `FilePreviewModal` decrypt trigger, and sticky `← Carpeta` / `WhatsApp` / `Descargar` dock) and polish mobile file cards in `FileGrid.tsx` with 1-tap `[Share]` and `[Inspect]` buttons.
- **Files:**
  - `vaultdrive_client/src/components/mobile/MobileInspectorSheet.tsx`
  - `vaultdrive_client/src/components/mobile/MobileInspectorSheet.test.tsx`
  - `vaultdrive_client/src/components/vault/FileGrid.tsx`
- **Verification:** Focused Vitest tests for `MobileInspectorSheet` 5-format switching & dock actions, plus `FileGrid.test.tsx` regression pass.

# Step 04: Cinemascope 3-Zone Modal & Sticky Tactical Dock Integration

## 1. Resulting Behavior & Prerequisites
- Upgrades `FilePreviewModal.tsx` into the **Cinemascope `92vw` (`max-w-[92vw] xl:max-w-6xl`) 3-Zone Executive Modal** (`filemon-modal-uix` + `21-brenda-executive-modal-dock`):
  - **Zone 1 — Frozen Top Hero Header (`sticky top-0 z-30`):**
    - Displays the **Filemón Office** plugin badge (`FILEMÓN OFFICE`), the host scope pill (`Quantix ABRN SAT • Amarre Fiscal`), the file heading (`<h2 id="preview-title">`), headline telemetry, Download button, and Close (`Esc`) button.
  - **Zone 2 — Breathable Content Stage (`flex-1 overflow-y-auto`):**
    - Automatically parses `.xlsx`, `.csv`, `.tsv`, `.xml`, `.json`, `.md`, `.txt`, and `.pdf` into `officeDoc` (`FilemonOfficeDocumentContract`) upon decryption and renders `<FilemonOfficeStage />` alongside existing `<pre>` / `<iframe>` / media views so every existing test assertion in `FilePreviewModal.test.tsx` continues to pass.
  - **Zone 3 — Frozen Sticky Bottom Tactical Dock (`sticky bottom-0 z-30`):**
    - **Left:** `← Volver a Bóveda (Esc)` (`min-h-[48px]` trucker target).
    - **Center:** Cryptographic Lineage Receipt (`Original SHA-256: ... • 0 Bytes Delta • Filemón Office RAM`).
    - **Right:** Primary Hero CTA `Descargar Original` (`min-h-[48px]` trucker target).

## 2. Files Owned
- `vaultdrive_client/src/components/vault/FilePreviewModal.tsx`
- `vaultdrive_client/src/components/vault/FilePreviewModal.test.tsx`

## 3. Exit Condition
- All 12 existing tests in `FilePreviewModal.test.tsx` + new Filemón Office integration tests pass without regression.

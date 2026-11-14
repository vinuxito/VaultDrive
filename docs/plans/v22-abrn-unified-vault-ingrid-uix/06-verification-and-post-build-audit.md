# Step 06 — Verification, Real Browser (`bsk`) Audit, Post-Build Audit & Closeout

1. Run `npm --prefix vaultdrive_client run typecheck` (`0 errors`).
2. Update and run focused Vitest suites (`FileGrid.test.tsx`, `VaultInspectorPane.test.tsx`, `VaultContextMenu.test.tsx`, `SmartUploadOrderModal.test.tsx`, `WhatsAppDropRequestModal.test.tsx`, `dashboard-layout.test.tsx`, `sidebar.test.tsx`, `skin-contrast.test.ts`).
3. Run `npm --prefix vaultdrive_client run build` and record `sha256sum vaultdrive_client/dist/index.html`.
4. Verify live `https://abrndrive.filemonprime.net/abrn/files` in `bsk` at `1440×900` (ABRN Cream & ABRN Slate, 3-pane splitters + `px` HUD, layout presets, Floating In-Grid Capsule, inline `F2` rename, `Subir y Ordenar`, `Pedir Docs`, `94vw` Cinemascope modal) and `390×844` mobile regression check.
5. Generate `docs/reports/2026-11-14-v22-abrn-unified-vault-ingrid-uix-audit.json` and pass `check-post-build-audit.py`.
6. Write session memory, MD + HTML verification reports, update `README.md`, archive ticket, commit to `main`, and push to `origin/main`.

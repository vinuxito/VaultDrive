# Step 05: Active Folder Hero Card in `files.tsx`, Live Browser Verification & Audit Closeout

- **Goal:** Wire the **Active Folder Hero Card**, **Subfolder Quick-Share Strip**, **Mobile Cerebro Ciego Pill**, **`MobileFolderShareSheet`**, **`MobileFolderSheet`**, and **`MobileInspectorSheet`** into `files.tsx` (plus mobile ABRN Cream/Slate toggle in `dashboard-layout.tsx`), run `typecheck` + focused `vitest` + `npm run build`, verify live mobile & desktop viewports via `bsk`, run `check-post-build-audit.py`, and archive the resolved ticket.
- **Files:**
  - `vaultdrive_client/src/pages/files.tsx`
  - `vaultdrive_client/src/components/layout/dashboard-layout.tsx`
  - `docs/memories/session-2026-11-12-v21-abrn-mobile-uix-folder-sharing.md`
  - `docs/reports/2026-11-12-v21-abrn-mobile-uix-folder-sharing-verification.md`
  - `docs/reports/2026-11-12-v21-abrn-mobile-uix-folder-sharing-verification.html`
  - `docs/reports/2026-11-12-v21-abrn-mobile-uix-folder-sharing-audit.json`
  - `README.md`
- **Verification:** `npm run typecheck` (`0 errors`), focused Vitest (`100% pass`), `npm run build`, live `bsk` mobile (`390×844`) & desktop (`1440×900`) verification in both `ABRN Cream` and `ABRN Slate`, and `check-post-build-audit.py` (`PASS`).

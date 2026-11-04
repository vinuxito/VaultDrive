# Step 05: Post-Build Audit, Real Browser Verification (`bsk`), & Ticket Archival

## Goal
Verify the completed build in cold execution, inspect the live application in the user's real browser via `bsk`, run the post-build audit gate, and archive the resolved ticket.

## Verification & Closeout Steps
1. Persist `/abrn/previews/drive.html` and `/abrn/previews/index.html` in `vaultdrive_client/public/previews/` so every `npm run build` ships the pure HTML previews automatically.
2. Run `npm --prefix vaultdrive_client run typecheck`.
3. Run focused Vitest suites (`skin-contrast.test.ts`, `brand-theme.test.ts`, `VaultInspectorPane.test.tsx`, `FileGrid.test.tsx`, `VaultContextMenu.test.tsx`, `FilePreviewModal.test.tsx`, `dashboard-layout.test.tsx`).
4. Run `npm --prefix vaultdrive_client run build`.
5. Verify in real browser via `bsk` (`https://abrndrive.filemonprime.net/abrn/files` and `https://abrndrive.filemonprime.net/abrn/previews/drive.html`).
6. Run `python3 .agents/skills/resolucion-de-tickets-nivel-dios/scripts/check-post-build-audit.py`.
7. Write session memory (`docs/memories/session-2026-11-04-v20-abrn-vibe-resizable-drive.md`), verification reports (`docs/reports/2026-11-04-v20-abrn-vibe-resizable-drive-verification.{md,html}`), archive ticket (`docs/tickets/archived/2026-11-04-ticket-v20-abrn-vibe-resizable-drive.md`), update `README.md`, commit, and push to `origin/main`.

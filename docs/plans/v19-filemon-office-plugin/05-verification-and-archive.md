# Step 05: Post-Build Audit, Verification & Ticket Archival

## 1. Resulting Behavior & Prerequisites
- Run strict cold verification (respecting the owner's full-suite hold):
  - `npm --prefix vaultdrive_client run typecheck` (`0 errors`)
  - `npx --prefix vaultdrive_client vitest run src/utils/filemon-office.test.ts src/components/vault/FilemonOfficeStage.test.tsx src/components/vault/FilePreviewModal.test.tsx`
  - `npm --prefix vaultdrive_client run build`
- Execute the mandatory post-build audit gate from `resolucion-de-tickets-nivel-dios`:
  - `python3 .agents/skills/resolucion-de-tickets-nivel-dios/scripts/check-post-build-audit.py docs/reports/2026-10-14-v19-filemon-office-plugin-audit.json --project /lamp/www/ABRN-Drive --build-id <sha256>`
- Write session memory, verification Markdown/HTML reports, update `README.md`, and archive the resolved ticket under `docs/tickets/archived/2026-10-14-ticket-v19-filemon-office-plugin.md`.

## 2. Files Owned
- `docs/memories/session-2026-10-14-v19-filemon-office-plugin.md`
- `docs/reports/2026-10-14-v19-filemon-office-plugin-verification.md`
- `docs/reports/2026-10-14-v19-filemon-office-plugin-verification.html`
- `docs/reports/2026-10-14-v19-filemon-office-plugin-audit.json`
- `docs/tickets/archived/2026-10-14-ticket-v19-filemon-office-plugin.md`
- `README.md`

## 3. Exit Condition
- `check-post-build-audit.py` exits `0` (`PASS`), ticket is archived, and `git status` is 100% clean and pushed to `origin/main`.

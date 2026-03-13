# Task 07 — Files Explorer & Bulk Selection

## Request

> "I want a select all files so that I can download them all at once. And check that tree interface, it can be better, more useful"

## What Was Built

The Files page was upgraded so users can select every file in the current visible view and run bulk download from the existing credential-aware flow. The left sidebar was also improved from a flat folder list into a more useful nested explorer with counts, active-path expansion, and better drop-link ordering.

This task also included a hardening pass after the main feature work:

- bulk delete now requires confirmation
- bulk delete only removes files from UI state after confirmed server success
- the misleading wrapped-key field was renamed from `drop_wrapped_key` to `pin_wrapped_key`

## Backend Changes

### Stable folder filtering

The files list query now returns `drop_folder_id` in addition to `drop_folder_name`, so the frontend filters folder views by stable IDs instead of names.

### Wrapped key naming cleanup

The files query and API response now expose `pin_wrapped_key`, which better reflects how drop-upload files are decrypted.

| File | Change |
|------|--------|
| `sql/queries/files_with_drop_source.sql` | Added `drop_folder_id`, renamed wrapped key alias to `pin_wrapped_key` |
| `handle_list_files.go` | Exposed `drop_folder_id` and `pin_wrapped_key` in the files API response |
| `internal/database/files_with_drop_source.sql.go` | Regenerated via `sqlc generate` |

## Frontend Changes

### Current-view select all

`vaultdrive_client/src/pages/files.tsx` now derives selection from the active visible result set and renders a master checkbox in the table header. The checkbox supports checked and indeterminate states and only selects files currently shown by the active folder, search, shared/starred view, and file-type filter.

### Bulk action feedback

`BulkActionBar` now shows scope-aware copy (`N selected in this view`) and only shows destructive bulk delete when the selected files are owner-deletable.

### Nested sidebar explorer

`VaultTree`, `FolderTree`, and `FolderTreeItem` now work together to render the folder hierarchy inside the left sidebar with:

- nested folders
- active folder highlighting
- ancestor auto-expansion
- per-folder file counts
- folder quick actions
- active drop links sorted before inactive ones

### Bulk delete hardening

Bulk delete now opens its own confirmation modal and keeps failed files selected if some delete requests fail.

## Verification

The latest implementation was re-verified after the follow-up hardening pass.

### Build and test evidence

- `cd vaultdrive_client && npm run build` — PASS
- `cd vaultdrive_client && npx eslint src/pages/files.tsx src/components/vault/BulkDownloadModal.tsx src/components/vault/CreateShareLinkModal.tsx src/components/vault/FilePreviewModal.tsx src/components/share-modal.tsx src/components/vault/BulkActionBar.tsx src/components/files/MyFilesSection.tsx` — PASS (repo-wide lint still has unrelated pre-existing issues outside this feature)
- `"/usr/local/go/bin/go" test ./...` — PASS
- `"/usr/local/go/bin/go" build ./...` — PASS

### End-to-end check

The Go server serves the production frontend from `vaultdrive_client/dist` in `main.go`, so rebuilding the frontend updates the served app path. A Playwright browser check against `https://abrndrive.filemonprime.net/files` confirmed:

- the files page loads after login
- the header checkbox selects all visible rows
- the bulk bar shows `2 selected in this view`
- the bulk delete button opens a `Delete 2 Files` confirmation modal
- cancelling that modal closes it cleanly

## Remaining Risks

- Repo-wide frontend lint still reports pre-existing issues outside the Files feature area; they did not block this feature path
- The screenshot-based verification covered the changed flows without mutating live data; deeper destructive e2e checks would need a dedicated test account or seeded local environment

## Files Changed

| File | Change |
|------|--------|
| `vaultdrive_client/src/pages/files.tsx` | Current-view select all, folder-id filtering, bulk delete confirmation and partial-failure handling |
| `vaultdrive_client/src/components/vault/VaultTree.tsx` | Nested folder explorer wiring, folder counts, sorted drop links |
| `vaultdrive_client/src/components/folders/FolderTree.tsx` | Sidebar-capable nested folder tree with active-path expansion |
| `vaultdrive_client/src/components/folders/FolderTreeItem.tsx` | Active state, sidebar styling, quick actions, file-count badges |
| `vaultdrive_client/src/components/vault/BulkActionBar.tsx` | Scope-aware selection copy and deletable-count-aware delete action |
| `vaultdrive_client/src/components/vault/BulkDownloadModal.tsx` | Renamed wrapped-key field usage to `pin_wrapped_key` |
| `vaultdrive_client/src/components/vault/CreateShareLinkModal.tsx` | Renamed wrapped-key field usage to `pin_wrapped_key` |
| `vaultdrive_client/src/components/vault/FilePreviewModal.tsx` | Renamed wrapped-key field usage to `pin_wrapped_key`, cleaned effect dependencies |
| `vaultdrive_client/src/components/share-modal.tsx` | Renamed wrapped-key prop to `pinWrappedKey`, cleaned search effect dependencies |
| `vaultdrive_client/src/components/files/MyFilesSection.tsx` | Updated wrapped-key prop naming |
| `sql/queries/files_with_drop_source.sql` | Added `drop_folder_id`, renamed alias to `pin_wrapped_key` |
| `handle_list_files.go` | Added `drop_folder_id` and `pin_wrapped_key` to file responses |
| `docs/plans/2026-03-13-files-explorer-bulk-selection.md` | Captured the implementation plan used for this work |

# Files Explorer Bulk Selection Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add current-view select-all for bulk download/delete and upgrade the Files sidebar into a more useful nested explorer.

**Architecture:** Extend the existing `/files` page rather than introducing a new store. Stabilize folder filtering by returning a folder id from the files API, then reuse the existing folder tree components to render a hierarchical explorer with counts and quick actions.

**Tech Stack:** React 19, TypeScript, Vite, Tailwind CSS, Go, sqlc, PostgreSQL.

---

### Task 1: Return stable folder metadata with files

**Files:**
- Modify: `sql/queries/files_with_drop_source.sql`
- Modify: `handle_list_files.go`
- Regenerate: `internal/database/files_with_drop_source.sql.go`

**Step 0: Verify the response shape that will change**

Run a focused check against the existing handler or fixture flow so the new field can be validated after the change.

**Step 1: Update the SQL query**

Add `fol.id as drop_folder_id` to the query so the frontend can filter by the actual folder row id instead of folder name. Use `fol.id`, not `u.target_folder_id`, so the API only reports a folder id when the folder join is valid.

**Step 2: Regenerate sqlc output**

Run: `sqlc generate`
Expected: generated files update without errors.

**Step 3: Expose the new field in the API response**

Add a `drop_folder_id` JSON field in `handle_list_files.go` and populate it when present.

**Step 4: Re-run the response-shape check**

Verify that drop-linked files now return `drop_folder_id` and non-drop files still omit it.

**Step 5: Verify the backend still builds**

Run: `go build ./...`
Expected: PASS

### Task 2: Add current-view select-all behavior to the files table

**Files:**
- Modify: `vaultdrive_client/src/pages/files.tsx`
- Modify: `vaultdrive_client/src/components/vault/BulkActionBar.tsx`

**Step 0: Extract testable selection helpers first**

Move selection-state calculations into small pure helpers in `files.tsx` so they can be reasoned about and validated before wiring UI.

**Step 1: Add selection helpers**

Compute `selectableFiles`, `allVisibleSelected`, and `someVisibleSelected` from the current `visibleFiles` array. Scope selection to the current panel view only.

**Step 2: Add the header checkbox**

Replace the placeholder cell in the list header with a real checkbox wired to select or clear the current visible result set.

**Step 3: Make selection state more legible**

Update the bulk action bar copy so it clearly says the selection is scoped to the current view.

**Step 4: Verify the frontend typechecks**

Run: `cd vaultdrive_client && npm run build`
Expected: PASS

### Task 3: Turn the vault sidebar into a nested explorer

**Files:**
- Modify: `vaultdrive_client/src/components/vault/VaultTree.tsx`
- Modify: `vaultdrive_client/src/components/folders/FolderTree.tsx`
- Modify: `vaultdrive_client/src/components/folders/FolderTreeItem.tsx`
- Modify: `vaultdrive_client/src/pages/files.tsx`

**Step 0: Clarify the tree integration point in code**

Embed the reusable `FolderTree` only inside the `My Folders` branch of `VaultTree`. Do not replace `Quick Access` or `Drop Links` with `FolderTree`.

**Step 1: Reuse the existing folder tree renderer**

Extend `FolderTree` so it can render inside the vault sidebar, accept active folder state, and optionally show actions.

**Step 2: Pass counts and actions into the tree**

Derive per-folder counts from the file list response grouped by `drop_folder_id`, then pass those counts into `FolderTree` so `FolderNode.fileCount` is no longer hardcoded.

**Step 3: Improve drop-link scanning**

Sort active links before inactive ones and keep badge styling clearer so the tree is easier to scan when many links exist.

**Step 4: Use folder ids for filtering**

Update the folder branch in `visibleFiles` so it filters by `drop_folder_id` instead of `drop_folder_name`.

### Task 4: Verify and polish

**Files:**
- Verify: `vaultdrive_client/src/pages/files.tsx`
- Verify: `vaultdrive_client/src/components/vault/VaultTree.tsx`
- Verify: `vaultdrive_client/src/components/folders/FolderTree.tsx`
- Verify: `vaultdrive_client/src/components/folders/FolderTreeItem.tsx`
- Verify: `handle_list_files.go`

**Step 1: Run diagnostics on modified frontend files**

Use LSP diagnostics and fix all errors.

**Step 2: Run verification commands**

Run:
- `cd vaultdrive_client && npm run lint`
- `cd vaultdrive_client && npm run build`
- `go build ./...`

Expected: all PASS

**Step 3: Manual UX verification**

Confirm that:
- the header checkbox selects only the current visible files
- the bulk bar text reflects current-view scope
- nested folders expand/collapse correctly
- folder selection still updates the main panel
- drop links remain selectable and readable

## Commit Strategy

- Commit 1 after Task 1: `feat(api): expose drop folder ids in files response`
- Commit 2 after Task 2: `feat(files): add current-view select all behavior`
- Commit 3 after Task 3: `feat(vault): upgrade folders sidebar explorer`
- Commit 4 after Task 4: `chore(qa): verify files explorer changes`

Plan complete and saved to `docs/plans/2026-03-13-files-explorer-bulk-selection.md`.

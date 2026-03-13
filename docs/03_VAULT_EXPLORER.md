# Task 03 — Vault Explorer (Files Module Redesign)

## Request

> "Now, redesign the files module. I want a real file tree like experience..."

## What Was Built

The Files page was rebuilt from a flat list into a split-pane Vault Explorer with a collapsible tree sidebar, context-aware file panel, origin badges, bulk actions, and instant search. The redesign introduced four new reusable components under `components/vault/`.

## Layout

```
┌──────────────────────────────────────────────────────────────┐
│  [≡] Vault Explorer                          [Search...]      │
├───────────────┬──────────────────────────────────────────────┤
│  VaultTree    │  File panel                                   │
│  (240px)      │                                               │
│               │  [file row] [file row] [file row] ...         │
│  All Files    │                                               │
│  Starred ★    │                                               │
│  ▼ My Folders │                                               │
│    folder-1   │                                               │
│    folder-2   │                                               │
│  Shared       │                                               │
│  ▼ Drop Links │                                               │
│    token-abc  │                                               │
│    token-xyz  │                                               │
│               │                                               │
│               │  ──────────────────────────────────────────  │
│               │  [BulkActionBar — appears on selection]       │
└───────────────┴──────────────────────────────────────────────┘
```

The sidebar can be collapsed (toggle button). Below 768 px it collapses automatically.

## Components

### `VaultTree` (`components/vault/VaultTree.tsx`)

The left-pane tree. Nodes:

| Node | Shows |
|------|-------|
| All Files | Every file the user owns or has access to |
| Starred | Files with `starred: true` |
| My Folders → per-folder | Files in that folder (`drop_folder_name`) |
| Shared with Me | Files where `is_owner: false` |
| Drop Links → per-token | Files uploaded via that token |

Each tree node is a button. Selecting it updates `selectedNode` state in `files.tsx`, which filters `visibleFiles`.

Drop Link nodes show a colored badge:
- Green — active
- Yellow — used / at max files
- Red — expired

### `OriginBadge` (`components/vault/OriginBadge.tsx`)

A small pill next to each filename showing where the file came from:

| Badge | Condition |
|-------|-----------|
| My Upload | Owner, no drop token |
| Drop: `token-name` | Uploaded via a Secure Drop link |
| @`username` | Shared by another user |
| Group | Shared via a group |

### `BulkActionBar` (`components/vault/BulkActionBar.tsx`)

A floating bottom bar that appears when one or more files are selected via checkbox. Shows:

- `N files selected`
- **Bulk Download** button → opens `BulkDownloadModal`
- **Bulk Delete** button → confirmation then sequential delete

The bar slides up from the bottom using a CSS transition.

### `BulkDownloadModal` (`components/vault/BulkDownloadModal.tsx`)

Handles sequential decryption and download of multiple selected files. Features:

- Detects per-file whether a PIN or password is needed
- Prompts once per credential type at the start
- Shows a per-file progress list with ✓ / ✗ status
- Non-blocking — errors on individual files don't stop the rest

**Credential detection logic:**

```typescript
const needsPin  = files.some(f => f.drop_wrapped_key || f.is_owner === false);
const needsPass = files.some(f => !f.drop_wrapped_key && f.is_owner !== false);
```

## Backend Change: `starred` field

`handle_list_files.go` was updated to include `starred: bool` in the file list response so the frontend can filter starred files client-side without a second API call.

## `files.tsx` — Key State

```typescript
selectedNode:  { type: "all" | "starred" | "folder" | "shared" | "drop", ... }
selectedFiles: Set<string>          // file IDs checked via checkbox
visibleFiles:  FileEntry[]          // filtered from myFiles by selectedNode
search:        string               // instant client-side filename filter
```

`visibleFiles` is derived from `selectedNode` on every render — no separate fetch needed when switching tree nodes.

## Search

The search input filters `visibleFiles` by `filename.toLowerCase().includes(search.toLowerCase())`. It is instant (no debounce needed — it's client-side).

## Files Changed

| File | Change |
|------|--------|
| `vaultdrive_client/src/pages/files.tsx` | Full redesign — split-pane, tree state, filtered views |
| `vaultdrive_client/src/components/vault/VaultTree.tsx` | New — left sidebar tree |
| `vaultdrive_client/src/components/vault/OriginBadge.tsx` | New — file source pill |
| `vaultdrive_client/src/components/vault/BulkActionBar.tsx` | New — floating multi-select bar |
| `vaultdrive_client/src/components/vault/BulkDownloadModal.tsx` | New — sequential bulk decrypt modal |
| `vaultdrive_client/src/components/vault/index.ts` | New — barrel export |
| `handle_list_files.go` | Added `starred` field to file list response |

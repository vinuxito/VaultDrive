# Step 2: Desktop-Class Spatial & Keyboard Navigation (Vim, Space Quick Look, `⌘K`)

## Overview
This step elevates ABRN Drive to the standard of Linear, Superhuman, and macOS Finder by introducing zero-mouse navigation. Power users can browse, preview, and manipulate files purely through muscle memory.

---

## Detailed Objectives

### 1. Spatial Traversal (`J`/`K` and Arrow Keys)
* In `files.tsx`, introduce an active focused index state (`focusedFileIndex`).
* Keybindings:
  - `J` or `↓`: Move focus to the next file row.
  - `K` or `↑`: Move focus to the previous file row.
  - `Enter` or `→`: Drill into folder if focused item is a folder; open decryption/preview if focused item is a file.
  - `Backspace` or `←` (or `H`): Navigate up to parent folder in the hierarchy.
* Visual Cue: Focused row displays a sleek, focused border accent (`ring-2 ring-primary/60 bg-primary/10`) with `scrollIntoView({ block: "nearest", behavior: "smooth" })` to ensure the focused row always stays visible during keyboard traversal.

### 2. macOS-Style `Spacebar` Instant Quick Look
* Tap `Spacebar` on any focused file:
  - If preview modal is closed, opens a floating Quick Look window without requiring mouse click.
  - If preview modal is open, tap `Spacebar` or `Esc` to instantly dismiss it.
  - If a folder is focused, tapping `Spacebar` displays an instant heads-up card with item count, total decrypted size, and active share route summary.

### 3. Omniscient Command Palette (`⌘K`) Expansion
* Upgrade `CommandPalette.tsx` to handle direct operational verbs:
  - `/share [filename]` or `⌘S`: Triggers share link modal for the currently selected or focused file.
  - `/download` or `⌘D`: Triggers instant client-side decryption & download.
  - `/sever` or `/revoke`: Quickly revokes external access for the selected file.
  - `/copy-link`: Copies the active secure link with hash fragment to clipboard.
  - `/lock`: Immediately locks current session credentials.

### 4. Zero-Friction Autofocus on Prompts
* When any modal or dialog opens (such as the 4-digit PIN prompt):
  - The input field receives autofocus immediately with zero delay.
  - Typing numbers instantly registers without having to click the input first.
  - Pressing `Enter` automatically triggers submission.

---

## Verification Plan
1. **Keyboard-Only Journey**: Navigate from root to nested folder using only arrow keys / `J`/`K`, tap `Space` to preview, tap `Space` to close, tap `Backspace` to return.
2. **Command Palette Proof**: Press `⌘K`, type `/download`, press `Enter`, verify file downloads without touching mouse.
3. **Automated E2E / Vitest**: Playwright spec verifying focused row index traversal and spacebar toggling.

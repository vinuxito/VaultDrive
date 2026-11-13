# Step 03: Upgraded `MobileFolderSheet` with 1-Tap Folder Share & Subfolder Hierarchy

- **Goal:** Upgrade `MobileFolderSheet.tsx` to match Scenario 2 of `/abrn/previews/mobile.html`: hierarchical root + indented child subfolder rows, direct 1-tap `[Compartir]` and `[Drop]` / `[Pedir Drop]` buttons on every folder row, and a sticky Zone 3 bottom dock (`[+ Nueva Carpeta]` + `[Compartir «Carpeta»]`).
- **Files:**
  - `vaultdrive_client/src/components/mobile/MobileFolderSheet.tsx`
  - `vaultdrive_client/src/components/mobile/MobileFolderSheet.test.tsx`
- **Verification:** Focused Vitest tests verifying folder selection, hierarchical subfolder display, 1-tap `[Compartir]` & `[Pedir Drop]` callbacks, and sticky bottom dock actions.

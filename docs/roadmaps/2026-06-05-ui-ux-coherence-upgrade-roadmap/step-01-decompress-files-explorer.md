# Step 1 — Decomposition of Monolithic Files Explorer (`files.tsx`)

- **Title:** Decomposition of Monolithic Files Explorer (`files.tsx`)
- **Category:** Architecture / Developer Experience
- **Why it matters now:**  
  The files explorer page (`vaultdrive_client/src/pages/files.tsx`) has grown to over 2,400 lines of code. It houses state management, folder tree hierarchies, drag-and-drop file uploads, sharing modals, bulk actions, and the grid/list UI. This extreme coupling blocks developer productivity, increases build verification times, makes UI refactorings (like mobile optimization) extremely high-risk, and leads to code duplication.
- **What exactly should be done:**  
  Decompose `files.tsx` into smaller, focused components placed under `src/components/vault/` and `src/components/files/`:
  1. **`FileGrid.tsx` / `FileList.tsx`:** Extract the grid/list visual file card renderers.
  2. **`VaultTree.tsx` / `SidebarFolderTree.tsx`:** Isolate the folder selection tree view.
  3. **`BulkActionBar.tsx`:** Move the bulk action floating bottom bar out.
  4. **`FileSearch.tsx`:** Modularize the search bar and filter dropdowns.
  5. Keep `files.tsx` as a clean layout container that orchestrates state from the context provider and binds these sub-components.
- **What existing work it builds on:**  
  - Composes the existing `SessionVaultContext` state provider which already tracks selected files and folders.
  - Builds on the theme-aware CSS custom properties configured in `index.css`.
- **What risks it avoids:**  
  - Visual regression bugs when modifying unrelated parts of the files page.
  - Merge conflicts in teams.
  - Unnecessary component re-renders due to bloated monolithic component states.
- **Expected payoff:**  
  - Main `files.tsx` file is reduced to under 600 lines.
  - Decomposed components can be unit-tested in isolation using Vitest/React Testing Library.
  - Future UI adjustments (like responsive styling) are localized to specific component files.
- **Definition of Done:**  
  - [ ] `files.tsx` line count is below 600 lines.
  - [ ] Sub-components (`FileGrid`, `VaultTree`, `BulkActionBar`) reside in separate files with 100% type safety.
  - [ ] All 42/42 Playwright E2E files explorer integration tests pass cleanly.
  - [ ] Unit tests added for newly extracted components verifying proper state propagation and callbacks.

# Plan Index: v12 Sovereign File Manager & Spatial Workspace Architecture

This document indexes all sequential, incremental implementation steps designed to elevate the **ABRN Drive** file manager into an ultra-responsive, desktop-grade spatial workspace (Finder / Linear grade).

---

## Strategic Objectives & UX Contract

1. **Horizontal Freedom & Space Reclamation**: Eliminate viewport bottlenecks. Enable full control over spatial allocation through a 3-way collapsible application sidebar (`expanded` | `compact rail` | `zen hidden`) and an interactive draggable tree pane splitter with auto-fit memory.
2. **Ergonomic Velocity via Native Context Menus**: Eliminate reliance on cramped row action buttons. Deliver a hardware-accelerated, theme-aware right-click context menu across files, folders, and canvas whitespace with hotkey accelerators (`Space`, `⌘D`, `P`, `M`, `S`, `Delete`).
3. **Natural Desktop Interactions (Lasso & Spring Loading)**: Support marquee drag multi-selection across files, seamless `Shift + Click` range selection, and spring-loaded folder tree navigation during drag operations.
4. **Contextual Intelligence & Fast Lateral Jumps**: Transform static breadcrumb text into active sibling navigation dropdowns, and enrich intake origin pills (`Drop: ...`) with instant cryptographic provenance inspection cards.
5. **Cold Execution & Invariant Preservation**: Zero regressions to cryptographic operations (AES-256-GCM, Web Crypto, golden SHA-256 seals, PIN tumbler haptics). Maintain 100% pass rate across the 101 test files and Playwright browser battery.

---

## Sequential Implementation Roadmap

1. **[Step 1: 3-Way Zen Application Sidebar (`expanded` / `compact rail` / `zen hidden`)](file:///lamp/www/ABRN-Drive/docs/plans/v12-step-01-collapsible-app-sidebar.md)**
   - Transform primary navigation into a tri-state layout: Expanded (256px), Compact Icon Rail (68px with floating glass tooltips), and Zen Hidden (0px with `⌘B` / `Ctrl+B` toggle).
   - Reclaim 180px–256px of horizontal table real estate for file names and cryptographic badges.
   - Persist mode in `localStorage` (`abrndrive_sidebar_mode`).

2. **[Step 2: Interactive Draggable Tree Splitter with Auto-Fit & Magnetic Snap](file:///lamp/www/ABRN-Drive/docs/plans/v12-step-02-resizable-tree-splitter.md)**
   - Replace fixed `w-60` folder pane with an interactive resizable container and illuminated drag handle (`col-resize`).
   - Dynamic boundary constraints (min 180px, max 520px) with magnetic auto-collapse (< 160px).
   - Double-click on splitter handle calculates the exact pixel width of the longest visible folder label and snaps to auto-fit.
   - Persist tree pane width in `localStorage` (`abrndrive_tree_pane_width`).

3. **[Step 3: Desktop-Grade Context Menu Engine (Right-Click & Long-Press Surface)](file:///lamp/www/ABRN-Drive/docs/plans/v12-step-03-desktop-context-menu.md)**
   - High-performance, theme-aware floating context menu attached to global window pointer coordinates with viewport edge collision clamping.
   - Full contextual action sets for single-file, multi-file selection, folder nodes, and canvas whitespace.
   - Built-in hotkey accelerators (`Space` Quick Look, `⌘D` Download, `P` Passport, `M` Move, `S` Star, `Supr` Revoke).

4. **[Step 4: Elastic Marquee Lasso Selection & Batch Action Surface](file:///lamp/www/ABRN-Drive/docs/plans/v12-step-04-marquee-lasso-selection.md)**
   - Pointer-drag rectangular lasso on empty canvas space with real-time collision detection against file rows and cards.
   - Seamless interoperability with standard modifier keys (`Shift + Click` continuous range, `⌘/Ctrl + Click` toggle).
   - Docked floating glass multi-selection action pill (`X items selected` | Download Batch | Move | Send to Staging Dock | Delete).

5. **[Step 5: Spring-Loaded Folders & Deep Drag-Drop Organization](file:///lamp/www/ABRN-Drive/docs/plans/v12-step-05-spring-loaded-folder-drag.md)**
   - Drag hover detector: hovering dragged files over a collapsed folder in `VaultTree` for 400ms automatically expands the branch with a soft micro-pulse.
   - Illuminated drop target highlights (`ring-2 ring-primary/60 bg-primary/10`) and folder drop zone feedback.
   - Seamless atomic file relocation via existing backend move pipeline with transactional toast undo.

6. **[Step 6: Interactive Breadcrumb Lateral Jumping & Origin Provenance Cards](file:///lamp/www/ABRN-Drive/docs/plans/v12-step-06-breadcrumb-jump-and-origin-cards.md)**
   - Transform breadcrumb crumb trails into dropdown navigation menus to instantly switch to sibling folders.
   - Upgrade Origin Badges (`Drop: RG Consulting`, `Vault`) with 250ms delayed hover cards rendering intake sender, verified delivery time, ticket token, and cryptographic seal.

---

## Execution Constraints & Single-Loop Guarantee

- **Sequential & Additive**: Each step compiles cleanly and can be applied iteratively without breaking any preceding features.
- **Strict Typing**: All components, hooks, and events must satisfy `npm run typecheck` (`tsc -b && tsc -p tsconfig.e2e.json --noEmit`) with 0 errors.
- **Verification Guarantee**: Cold execution of `npm test` (101/101 test files) and Playwright E2E after completion.

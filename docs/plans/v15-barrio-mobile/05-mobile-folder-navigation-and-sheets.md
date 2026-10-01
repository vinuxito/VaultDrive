# Step 5: Mobile Folder Navigation (Swipeable Breadcrumbs & Folder Bottom Sheet)

## Objective
Replace the desktop nested `VaultTree` on mobile with thumb-friendly horizontal breadcrumb chips and an accessible folder picker bottom sheet, fulfilling **Ley 2 (Ergonomía)** and **Ley 7 (Test de la Esquina)**.

## Problem Analysis
Currently on mobile, folder navigation relies on a 28px hamburger button nestled in the breadcrumb bar that opens the desktop tree view. The tree view contains small font, microscopic collapse/expand chevrons, and requires high motor precision to navigate.

## Architectural Changes
1. **Swipeable Breadcrumb Pills in `files.tsx`:**
   - On mobile screens, render a horizontally scrollable container with rounded pill chips:
     `[ 🏠 Bóveda ] → [ 📁 Facturas ] → [ 📁 2026 ]`
   - Each chip has a minimum touch height of 40px with generous tap padding and active state feedback.
2. **Mobile Folder Bottom Sheet (`MobileFolderSheet.tsx`):**
   - Clicking on a folder selector or "Ver Carpetas" opens a thumb-level Bottom Sheet.
   - Folders are rendered as large cards (56px minimum height) displaying:
     - Folder name with distinct folder icon.
     - Number of files inside (`N archivos`).
     - 1-tap navigation into subfolder with instant tactile response.
   - Includes a "Subir Nivel" (Go Up) button to return to the parent directory.

## Verification
- Test folder navigation flow on Android 13 via touch swipe and tap.
- Verify zero horizontal page scrolling or broken layout.

# Step 2: Thumb-Friendly File Cards & Metadata Visibility

## Objective
Eliminate the "blind mobile user" syndrome by ensuring file sizes, dates, and cryptographic seals are prominently visible on mobile viewports, while elevating all interactive targets to ≥48px to satisfy **Ley 2 (Ergonomía)**, **Ley 3 (Cero Mamadas)**, and **Ley 7 (Test de la Esquina)**.

## Problem Analysis
In `FileGrid.tsx`, `file_size` is hidden on mobile (`hidden md:block`), `created_at` is hidden (`hidden lg:block`), and the origin badge is hidden (`hidden sm:block`). The mobile row only displays a filename, a 16px checkbox, a 10px pulsing green receipt dot, and a three-dot menu. Tapping the 10px dot is virtually impossible on a moving bus without accidentally opening the full preview modal.

## Architectural Changes
1. **Responsive Card Layout in `FileGrid.tsx`:**
   - On viewports `< 640px` (`sm:` breakpoint), render a rich 2-line thumb card with min-height 64px:
     - **Top Line:** 
       - Selection checkbox with expanded 44×44px touch bounding box.
       - File icon with colored format badge (PDF, IMG, TXT, etc.).
       - Filename with clear, legible typography and ellipsis.
       - Quick action trigger (three dots).
     - **Bottom Line (Metadata & Receipts):**
       - Formatted file size (e.g., `2.4 MB`, `450 KB`).
       - Formatted relative timestamp (e.g., `Hoy`, `Ayer`, `14 Sep`).
       - Cryptographic seal chip: `🛡️ AES-256-GCM` or `🛡️ Blindado`.
       - Receipt Button: An accessible receipt badge (min 44×44px hit-box) with green status dot, replacing the microscopic 10px dot.
2. **Hit Target Hardening:**
   - Ensure a clear 8px clearance between selection, preview, and menu triggers.
   - Long-press support on mobile cards to toggle selection without opening preview.

## Verification
- Test in Android 13 via `filemon-mobile tap` simulation.
- Verify file size and date are immediately legible on a 360px viewport.

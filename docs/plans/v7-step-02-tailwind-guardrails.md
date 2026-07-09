# Step 2: Tailwind Build Guardrails & Theme Stripping

This step restricts the Tailwind compiler and cleans up remaining hardcoded styling overrides in the React components.

---

## 🎯 Goal
Overhaul Tailwind's theme mapping so standard color utilities (like `slate`, `zinc`, `neutral`) do not compile, and replace any remaining hardcoded color references with semantic theme variables (like `bg-card`, `border-border`, `text-muted-foreground`).

---

## 🏗️ Proposed Changes

### 1. Stripping Tailwind Standard Palette
#### [MODIFY] [index.css](file:///lamp/www/ABRN-Drive/vaultdrive_client/src/index.css)
- Restructure the `@theme` block or Tailwind configuration to override default colors, mapping them to empty values or disabling default extensions.
- Ensure that only semantic colors (`background`, `foreground`, `card`, `popover`, `primary`, `secondary`, `muted`, `accent`, `destructive`, `border`, `input`, `ring`) generate utility classes.

### 2. Eliminating Remaining Hardcoded Colors
#### [RUN] [fix_slate_neutrals.py](file:///lamp/www/ABRN-Drive/vaultdrive_client/fix_slate_neutrals.py) and [fix_hardcoded_colors.py](file:///lamp/www/ABRN-Drive/vaultdrive_client/fix_hardcoded_colors.py)
- Execute the cleanup scripts to perform safe substitutions across all source files.
- Manual audit: Find any residual hardcoded hex colors (e.g. `#7d4f50`, `#6b4345`, `bg-[linear-gradient(...)]` containing raw slates) and swap them for theme tokens.

---

## 🧪 Verification Plan
- **Production Compilation**: Run `npm run build` and verify that the generated CSS size is optimized and does not contain hardcoded default Tailwind colors.
- **Unit & E2E Tests**: Run `npm run test` to verify that layout adjustments did not break component rendering assertions.

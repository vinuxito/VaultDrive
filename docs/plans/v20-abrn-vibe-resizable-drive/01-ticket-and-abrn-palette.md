# Step 01: Immutable ABRN Asesores Brand Palette & Topbar Mode Switcher

## Goal
Restore ABRN-Drive's immutable **ABRN Asesores** palette across `vaultdrive_client/src/styles/skins.css`, `vaultdrive_client/src/components/theme-context.ts`, and `vaultdrive_client/src/components/layout/dashboard-layout.tsx` so the production app matches `/abrn/previews/drive.html`.

## Technical Changes
1. **`vaultdrive_client/src/styles/skins.css`**:
   - `[data-theme="light"]` (**ABRN Warm Cream & Burgundy**):
     - `--background: 36 33% 97%` (`#faf8f5`), `--foreground: 220 17% 21%` (`#2c323f`), `--card: 0 0% 100%`, `--primary: 352 60% 30%` (`#7a1f2b`), `--secondary: 36 22% 93%` (`#f2efe9`), `--muted: 36 22% 93%`, `--muted-foreground: 33 10% 33%` (`#5c544b`), `--accent: 358 24% 38%` (`#78494b`), `--border: 36 20% 87%` (`#e5e0d8`), `--font-display: "Libre Baskerville", Baskerville, Georgia, serif`.
   - `[data-theme="dark"]` (**ABRN Deep Slate & Rose-Burgundy**):
     - `--background: 225 23% 16%` (`#1e2330`), `--foreground: 36 15% 94%` (`#f2f0ed`), `--card: 225 18% 22%` (`#2c3240`), `--primary: 357 30% 76%` (`#d4aeb0`), `--primary-foreground: 225 23% 16%`, `--muted: 214 15% 25%`, `--muted-foreground: 36 15% 78%`, `--font-display: "Libre Baskerville", Baskerville, Georgia, serif`.
2. **`vaultdrive_client/src/components/theme-context.ts`**:
   - Update `SKINS` metadata for `light` (`swatchBg: "#faf8f5", swatchPrimary: "#7a1f2b", swatchAccent: "#7d4f50"`) and `dark` (`swatchBg: "#1e2330", swatchPrimary: "#c4999b", swatchAccent: "#7d4f50"`).
3. **`vaultdrive_client/src/components/layout/dashboard-layout.tsx`**:
   - Add the `ABRN Asesores` serif header identity and 1-click `ABRN Cream` / `ABRN Slate` mode bar (`data-testid="abrn-mode-bar"`) in the topbar when `branding.logoVariant === "abrn"`.

## Verification Criteria
- `npx vitest run src/config/skin-contrast.test.ts src/config/brand-theme.test.ts src/components/layout/dashboard-layout.test.tsx` passes 100%.

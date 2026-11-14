# Step 02 — Three Immutable ABRN Skins (`☀ Cream`, `☾ Slate`, `◆ OLED`) & `0ms` Continuum Bridge

## Files
- `vaultdrive_client/src/components/theme-context.ts`
- `vaultdrive_client/src/components/ThemeProvider.tsx`
- `vaultdrive_client/src/styles/skins.css`
- `vaultdrive_client/src/styles/abrn-unified-vault.css`
- `vaultdrive_client/src/config/skin-contrast.test.ts`
- `vaultdrive_client/src/utils/continuum-bridge.ts`
- `vaultdrive_client/src/components/layout/dashboard-layout.tsx`
- `vaultdrive_client/src/components/layout/sidebar.tsx`

## Exit Criteria
- `"oled"` (`#030712` background, `#0b0f19` card, `#eab5b8` rose-burgundy primary, `#f8fafc` foreground) persists in `abrn-drive-skin` and passes `skin-contrast.test.ts` (`>= 4.5:1` across all 13 token pairs).
- Topbar exposes `Escritorio | ⚡ Dual en Vivo | Estudio Móvil` and `☀ Cream | ☾ Slate | ◆ OLED` without breaking `dashboard-layout.test.tsx` or `sidebar.test.tsx`.

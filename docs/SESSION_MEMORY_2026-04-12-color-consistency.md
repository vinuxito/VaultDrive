# Session Memory — 2026-04-12: Theme Color Consistency Fix

## What Happened

Fixed full theme color consistency across all 6 skins. The root problem: the entire
codebase was using hardcoded hex values (`bg-[#7d4f50]`, etc.) in Tailwind arbitrary
classes, which bypass the CSS custom property system. Buttons, borders, panels, dropdowns
— everything was stuck at burgund no matter which skin was active.

## Critical Facts for Future Sessions

### Three Python scripts now in the repo
- `vaultdrive_client/fix_hardcoded_colors.py` — burgundy palette replacement (iter 1)
- `vaultdrive_client/fix_dark_gradients.py` — dark slate gradient removal (iter 2)
- `vaultdrive_client/fix_slate_neutrals.py` — slate/white neutrals (iter 3)

These scripts are idempotent and document the exact replacement mapping. If new
hardcoded colors are introduced, run them again.

### Replacement rules (reference)
- `bg-[#7d4f50]` → `bg-primary` (all skin primary color)
- `text-[#7d4f50]` → `text-primary`
- `hover:bg-[#6b4345]` → `hover:bg-primary/90`
- `text-[#f2d7d8]` on dark bg → `text-primary-foreground`
- `bg-[#f2d7d8]` → `bg-primary/10`
- `border-slate-200` → `border-border`
- `bg-slate-50` → `bg-muted`
- `bg-white` panels → `bg-card`
- `bg-white` dropdowns → `bg-popover`
- `text-slate-600/500` → `text-muted-foreground`

### main.go panic fix
`dbURL[:12]` panicked when DB_URL was empty. Fixed with length check + early Fatal.
Commit: part of session commit.

### E2E test invocation
Playwright defaults to port 8090 but production runs on 8083. Always use:
```
E2E_BASE_URL=http://127.0.0.1:8083/quantix npx playwright test
```

### What is intentionally NOT themed
- `elegant-complete.css` — excluded by policy; `.elegant-*` scoped classes only
- `luxury-tokens.css` — excluded by policy
- `SKINS` array `swatchBg/swatchPrimary/swatchAccent` — intentional hex for skin picker
- `bg-white text-primary` toggle buttons — intentional selected-state contrast

## Verification
- go build: OK
- go vet: OK
- tsc --noEmit: 0 errors
- npm run build: OK, 11s
- vitest: 68/68
- playwright: 38/38 (with E2E_BASE_URL=http://127.0.0.1:8083/quantix)

## Service
Needs `sudo systemctl restart quantixdrive` to deploy new binary (main.go panic fix).

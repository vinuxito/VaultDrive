# Theme Color Consistency Fix — 2026-04-12

## Problem

After the 6-skin theme system was shipped (session doc #26), buttons, borders, panels,
and other UI elements were still rendering in hardcoded burgundy (`#7d4f50`) regardless
of the active skin. This was because the original codebase used Tailwind arbitrary-value
classes like `bg-[#7d4f50]` which bypass the CSS custom property system entirely.

The `data-theme` attribute and CSS variable approach only works when components use
semantic Tailwind classes (`bg-primary`, `border-border`, etc.) — not hardcoded hex
values.

---

## Root Cause

Two independent causes:

1. **Hardcoded hex in arbitrary Tailwind values**: `bg-[#7d4f50]`, `text-[#7d4f50]`,
   `border-[#7d4f50]` etc. These always produce the Light skin's burgundy regardless of
   `data-theme`.

2. **`dark:bg-[linear-gradient(slate)]` overrides**: After replacing warm cream card
   backgrounds with `bg-card`, these dark: variants were overriding `bg-card` for all
   dark skins (QuantiX, Dark, Cyberpunk, Elegant) with a hardcoded Tailwind-slate gradient
   that didn't match any skin's `--card` variable.

---

## Scope

65+ components and pages. 70 files modified total.

---

## Replacement Map

### Primary palette

| Old | New | Rationale |
|-----|-----|-----------|
| `[#7d4f50]` | `primary` | Light skin's primary; Tailwind opacity modifiers `/N` survive intact |
| `[#6b4345]/30` | `primary/20` | Must handle before plain `[#6b4345]` to avoid `primary/90/30` |
| `[#6b4345]` | `primary/90` | Hover-state darker variant of primary |
| `text-[#f2d7d8]` | `text-primary-foreground` | Light pink on dark bg = text on primary |
| `bg-[#f2d7d8]` | `bg-primary/10` | Very light primary tint as bg |
| `[#f2d7d8]/N` | `primary-foreground/N` | opacity variants |
| `[#d4a5a6]/N` | `primary/N_reduced` | Muted primary tints |
| `[#e2b9bb]` | `primary/20` | Light pink background |
| `[#c4999b]` | `primary` | Dark skin's light burgundy = that skin's primary |
| `[#9f7475]` | `primary/60` | Mid gradient stop |
| `[#d7bbbc]` | `primary/20` | Light gradient stop |

### Borders and backgrounds

| Old | New |
|-----|-----|
| `[#e8d9d0]` warm border | `border` |
| `bg-[linear-gradient(cream)]` | `bg-card` |
| `dark:bg-[linear-gradient(slate)]` | removed |
| `[#fbfaf8]`, `[#fbf7f3]`, `[#2a1f1f]` | `card` |
| `border-slate-200` | `border-border` |
| `bg-slate-50` | `bg-muted` |
| `bg-white` (panel/modal) | `bg-card` |
| `bg-white` (dropdown/context menu) | `bg-popover` |
| `text-slate-600/500` | `text-muted-foreground` |
| `text-slate-700` | `text-foreground` |

### CSS files

- `index.css` `.brand-trust-shell`:
  - `rgba(125, 79, 80, 0.18)` → `hsl(var(--primary) / 0.18)`
  - `rgba(212, 165, 166, 0.18)` → `hsl(var(--secondary) / 0.18)`
- `about.tsx` inline style: `"#7d4f50"` → `"hsl(var(--primary))"`

### rgba shadows

All `rgba(125,79,80,N)` in Tailwind shadow arbitrary values → `rgba(0,0,0,N)`.
Shadows remain equally subtle; now skin-neutral.

---

## Three-Iteration Process

### Iteration 1 — Python bulk replace (63 tsx/ts files)

Script: `vaultdrive_client/fix_hardcoded_colors.py`

Replaced all hex palette values (`#7d4f50`, `#6b4345`, `#f2d7d8`, `#d4a5a6`, `#e2b9bb`,
`#c4999b`, `#9f7475`, `#d7bbbc`, `#e8d9d0`, `#fbfaf8`, `#fbf7f3`, `#2a1f1f`) plus
all warm cream card gradient backgrounds and rgba shadows.

Key ordering rule: handle `[#6b4345]/30` and `[#f2d7d8]/N` with opacity **before**
the plain `[#6b4345]` and `[#f2d7d8]` patterns, to prevent invalid double-opacity
constructs like `primary/90/30`.

Result: 3 remaining (SKINS metadata in theme-provider + 1 inline style in about.tsx).

### Iteration 2 — Targeted fixes (10 files + 2 CSS edits)

Script: `vaultdrive_client/fix_dark_gradients.py`

- Fixed about.tsx and index.css manually
- Removed 8 `dark:bg-[linear-gradient(slate)]` overrides that were fighting `bg-card`
- Normalized `border-border dark:border-slate-700` → `border-border`

### Iteration 3 — Slate neutrals (28 files)

Script: `vaultdrive_client/fix_slate_neutrals.py`

- Dropdown menus: `bg-white border-slate-200` → `bg-popover border-border`
- Panel containers: `bg-white` → `bg-card`
- `bg-slate-50` → `bg-muted`
- `border-slate-200` → `border-border` (81 remaining instances)
- Text: `text-slate-600/500` → `text-muted-foreground`, `text-slate-700` → `text-foreground`

---

## What Was NOT Changed

- `elegant-complete.css` — explicitly excluded per session policy. Hardcoded burgundy
  inside it only fires on `.elegant-*` selectors used by the Elegant skin, where the
  values approximate that skin's `--primary` anyway.
- `luxury-tokens.css` — excluded per session policy.
- SKINS metadata array in `theme-provider.tsx` — `swatchBg/swatchPrimary/swatchAccent`
  fields are intentional hex values used for the skin picker swatch squares.
- `bg-white text-primary` toggle-button patterns — intentional: white bg + primary text
  creates a contrast indicator for selected state (works on all skins).
- `admin.tsx` remaining table whites — admin-only page, low priority.

---

## Files Changed (key ones)

All components in `src/components/` subdirectories:
`files/`, `folders/`, `layout/`, `mobile/`, `onboarding/`, `settings/`, `upload/`,
`vault/`, `control-plane/`, `elegant/`, `ui/`, `share-modal.tsx`, `theme-provider.tsx`

All pages in `src/pages/`:
`login.tsx`, `settings.tsx`, `files.tsx`, `dashboard.tsx`, `admin.tsx`, `about.tsx`,
`drop-upload.tsx`, `groups.tsx`, `shared.tsx`, `access-center.tsx`, and more.

CSS: `src/index.css`

---

## Additional Fix: main.go panic hardening

`main.go:74` had `dbURL[:12]` which panics when `DB_URL` env var is empty. Fixed with:

```go
if dbURL == "" {
    log.Fatal("DB_URL environment variable is required")
}
preview := dbURL
if len(preview) > 12 {
    preview = preview[:12]
}
```

This was discovered when Playwright tried to start a fresh binary without env vars.

---

## Verification Results

| Check | Result |
|-------|--------|
| `go build ./...` | OK |
| `go vet ./...` | OK |
| `npx tsc --noEmit` | OK (0 errors) |
| `npm run build` | OK — 11s, clean |
| `npm test -- --run` (vitest) | 68/68 pass |
| Playwright E2E | 38/38 pass (vs live service on :8083) |

---

## Remaining Risks

1. **`elegant-complete.css`**: Hardcoded burgundy for `.elegant-*` selectors. Risk is
   minimal — only the Elegant skin's components use these, and the values are close to
   that skin's gold/warm palette (the CSS fights itself slightly but doesn't visually break).

2. **`admin.tsx` table `bg-white`**: Admin-only page. The table rows still use
   `bg-white` and `divide-gray-200`. On QuantiX (dark skin) this makes the admin table
   white, which is jarring but only affects admin users.

3. **Deploy**: `sudo systemctl restart quantixdrive` required for new binary (main.go fix).

4. **Playwright default port**: `playwright.config.ts` defaults to port 8090 but production
   service runs on 8083. Always run E2E as:
   `E2E_BASE_URL=http://127.0.0.1:8083/quantix npx playwright test`

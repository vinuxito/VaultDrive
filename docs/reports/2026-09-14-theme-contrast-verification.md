# Six-template contrast and visibility repair — 2026-09-14

## Final verification results

Status: **DEPLOYED AND VERIFIED**. Published index SHA-256:
`3c156ccb1159d0328f549b19511b861cacebd573af23abc597ed654d9eda43b6`.

| Check | Result | Exit |
|---|---|---|
| Frontend unit tests (`npm test`) | 246 passed, 1 skipped; 47 files passed, 1 skipped | 0 |
| Semantic skin contrast tests | 78 pairs passed across 6 templates (included above) | 0 |
| TypeScript + Vite production build | Passed; 52 assets | 0 |
| Final staged release checks | 12 passed, including all six expanded form flows and 4 downloads | 0 |
| Public browser suite | 30 passed across the 29-case sweep plus Spanish check; includes 4 downloads | 0 |
| Rendered contrast/visibility records | 426 captures; 15,672 measured text nodes; 0 contrast failures or horizontal overflows | 0 |
| Template persistence | All 6 choices persisted after navigation and reload | 0 |
| Public HTML vs staged HTML | SHA-256 identical | 0 |
| Backend health / readiness | HTTP 200; DB, secrets, uploads OK; migration 49; 439 stored files | 0 |
| Service state | Active, enabled, 0 restarts | 0 |
| Repository lint | 75 existing errors, 29 warnings; unchanged error counts versus original HEAD | 1 |
| Final source + new browser-test lint | 66 existing errors, 29 warnings; no new errors | 1 |
| Git diff whitespace check | Passed | 0 |
| Independent shared CSS/layout review | No actionable findings | — |

The staged sweeps identified remaining contrast failures in the mobile Logout
label and selected-upload size. Both were corrected before publication; the complete
public suite then verified the final assets. Raw per-state results are in
[the JSON evidence](2026-09-14-theme-contrast-results.json). A screenshot gallery
is embedded in [the self-contained HTML report](2026-09-14-theme-contrast-verification.html).

Final rollback copy: `/home/vinuxito/.cache/abrndrive-theme/dist-before-final`. Restore that backup's `index.html`
atomically to roll back; previous hashed assets remain available.

## Scope and diagnosis

The reported protection dialog combined a light modal with hardcoded white text
and dark translucent trust panels. Global utility overrides, legacy two-theme
branches, and foreground tokens used on the wrong surface repeated the problem
across forms and pages. A view-transition name on the dashboard wrapper also
created a stacking context that let navigation cover the preview.

The six existing templates remain: Light, Business, Dark, QuantiX, Cyberpunk,
and Elegant. Their primary palettes, typography, route structure and layouts
are retained. Muted text and status colors were adjusted for contrast; cards,
inputs, labels, buttons and alerts now use matching semantic color pairs.
Long dialogs scroll within the viewport. The preview sits above navigation.
Theme selection survives navigation and reload.

Primary changes are in `src/styles/skins.css`, `src/index.css`,
`src/styles/elegant-complete.css`, the dashboard layout, shared UI components,
vault/share/upload dialogs, onboarding and page-level cards/forms. Encryption,
API contracts and stored files were not changed by this CSS repair.

## Verification method

`e2e/theme-visibility.spec.ts` visits all 21 declared route patterns in all six
templates at 1280 and 390 pixels wide. It additionally opens protection and PIN
dialogs, three settings tabs, folder/upload-link forms, link-created receipts,
share/move dialogs, agent-key/admin/group forms and all four onboarding steps.
A supplemental Spanish phone check covers navigation, Files and the PIN preview
in all six templates. The main route/form matrix uses English.
The short upload form viewport is 390 × 650; other phone states use 390 × 844.

The browser audit measures rendered text against composited CSS backgrounds:
4.5:1 for normal text, 3:1 for large text, with a 0.03 rounding tolerance.
Gradient endpoints are checked conservatively. Disabled controls, hidden text,
transitions below 95% opacity and unknown image backgrounds are excluded.
Screenshots supplement these checks. This is targeted regression coverage,
not a formal accessibility certification or physical-device acceptance.

All browser API responses use synthetic fixtures, including synthetic encrypted
key material for onboarding and real AES-GCM fixture decryption for download
tests. No customer account, PIN, document or production API mutation is used.
Live backend readiness is verified separately.

## Commands

Run frontend commands from `vaultdrive_client/`:

```bash
npm test
npm run lint -- --format json
npm run build -- --outDir /home/vinuxito/.cache/abrndrive-theme/dist-final --emptyOutDir
E2E_BASE_URL=http://127.0.0.1:4173/abrn/ \
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/opt/google/chrome/chrome \
THEME_AUDIT_OUTPUT=/home/vinuxito/.cache/abrndrive-theme/staged-release \
./node_modules/.bin/playwright test e2e/theme-visibility.spec.ts e2e/download-autofill.spec.ts \
  --project='Desktop Chrome' --workers=3 --reporter=line \
  --grep 'first-time PIN setup|light 390|dark 390|autofill and PIN retry'
```

The deployed full check removes the `--grep` filter and uses
`E2E_BASE_URL=https://abrndrive.filemonprime.net/abrn/` and a separate audit output
directory. Live checks also run `curl -fsSL` for `/ready` and `/api/healthz`,
plus `systemctl show abrndrive.service -p ActiveState -p UnitFileState -p NRestarts`.
An already-running preview is required for the staged test, avoiding
the default test server's database/migration startup.

## Deployment notes

Static assets are served dynamically; this repair requires no sudo or backend
restart. The final publication copies assets before atomically replacing the
HTML entry point and preserves old hashed assets for existing open tabs.

During implementation an intermediate default Vite build wrote into the live
static directory. Prior hashed assets were restored immediately from the previous
download-repair stage. Subsequent builds used a private staging directory. The
final verified publication supersedes that intermediate build.

The last fully verified pre-theme frontend, including the PIN repair, remains at
`/home/vinuxito/.cache/abrndrive-download/dist`. Its hashed assets were retained.
The earlier download-repair backup remains available at
`/home/vinuxito/.cache/abrndrive-download/dist-before`. The original service data,
database and uploads were not altered. Pre-existing unrelated worktree changes
and untracked directories are preserved rather than removed to claim a clean tree.

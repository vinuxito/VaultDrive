# Frontend lint repair — 2026-09-14

All 75 pre-existing errors and 29 warnings are resolved with the existing ESLint
configuration. No dependencies, lint rules, ignores, or rule suppressions changed.
The production frontend was built privately, tested, and published with rollback
assets retained. Database, uploads, backend binary and service configuration were
not changed by this repair.

## Verification

| Check | Exit code | Result |
| --- | ---: | --- |
| Baseline lint | 1 | 75 errors / 29 warnings |
| Final lint | 0 | 0 errors / 0 warnings |
| Unit tests | 0 | 265 passed / 1 skipped |
| TypeScript + production build | 0 | Private staged ABRN build |
| Staged browser matrix | 0 | 30 passed; six templates, desktop and phone |
| Published browser smoke | 0 | 6 passed; template persistence, Spanish phone, PIN/download |
| Public readiness and health | 0 | ready / ok; migration 49; 439 stored files |
| Diff whitespace check | 0 | No patch whitespace errors |

Baseline unit suite: 246 passed, 1 skipped. Final suite: 265 passed,
1 skipped. New regressions cover action removal/restoration, modal reopen
and changed account/file data, request cancellation, fresh SSE callbacks,
automatic biometric login, translation merging and preview metadata compatibility.
The existing skipped test remains skipped; it was not disabled by this change.

## Changes and review

- Explicit recovery, custodian, sharing, translation, IndexedDB and worker-message
  types replace loose `any` declarations. WebCrypto buffer parameters are typed;
  AES-GCM, RSA-OAEP and key derivation parameters are preserved.
- Preview metadata continues to accept missing, null and empty salts for drop
  uploads. Recovery reconstruction continues to reject empty approved shares.
- Row-action content mounts only when actions exist, preserving hook order and
  resetting a dismissed mobile drawer. File-history and email-edit content reset
  on reopen and changes to their resource data.
- Effects have complete dependencies and request cleanup. Automatic biometric
  login remains tied to PIN-mode entry, without repeating on email edits.
- Theme, toast and session-vault provider components are separated from shared
  contexts/hooks. Public import paths remain compatible. Unused button/badge
  variant exports were removed; the unauthorized-session helper has its own module.
- Independent review caught and corrected stale modal loading, restored mobile
  drawer state, same-account updates, and biometric re-prompt risks before release.

The 30 staged browser tests use synthetic API fixtures across all six templates,
21 route patterns, desktop and phone viewports, dialogs and settings forms.
The download tests exercise real AES-GCM fixture decryption, autofill resistance,
wrong-PIN retries and downloaded bytes. The six published smoke tests repeat
PIN/download flows, template persistence and Spanish phone navigation/preview.
No customer account credentials, PINs or documents were used. Hardware passkey
authentication and all mutation-heavy backend E2E suites were not exercised.

## Exact commands

Frontend commands run from `/lamp/www/ABRN-Drive/vaultdrive_client`:

```bash
npm run lint -- --format json
npm test
npm run build -- --outDir /home/vinuxito/.cache/abrndrive-lint/dist --emptyOutDir
npm run preview -- --host 127.0.0.1 --port 4173 --outDir /home/vinuxito/.cache/abrndrive-lint/dist
env -u CI E2E_BASE_URL=http://127.0.0.1:4173/abrn/ \
  PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/opt/google/chrome/chrome \
  THEME_AUDIT_OUTPUT=/home/vinuxito/.cache/abrndrive-lint/staged-browser \
  ./node_modules/.bin/playwright test e2e/theme-visibility.spec.ts e2e/download-autofill.spec.ts \
  --project='Desktop Chrome' --workers=3 --reporter=line
env -u CI E2E_BASE_URL=https://abrndrive.filemonprime.net/abrn/ \
  PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/opt/google/chrome/chrome \
  THEME_AUDIT_OUTPUT=/home/vinuxito/.cache/abrndrive-lint/live-browser \
  ./node_modules/.bin/playwright test e2e/theme-visibility.spec.ts e2e/download-autofill.spec.ts \
  --project='Desktop Chrome' --workers=3 --reporter=line \
  --grep 'template selection persists|autofill and PIN retry|Spanish phone'
git -c safe.directory=/lamp/www/ABRN-Drive diff --check
```

Browser commands reused an already-running preview/live service. The default
Playwright database-creation/migration server was not started. Routine package
freshness/terminal-color notices are not ESLint rule warnings.

## Publication and rollback

- Staged/published index SHA-256: `10d7c6374d3b902959ff86d6b75beb8d4d42da55ecc5fe4d98e4213a32ba2aa4`.
- Previous index SHA-256: `3c156ccb1159d0328f549b19511b861cacebd573af23abc597ed654d9eda43b6`.
- Rollback directory: `/home/vinuxito/.cache/abrndrive-lint/dist-before`.
- Service state: `NRestarts=0; ActiveState=active; UnitFileState=enabled`.
- Assets copied first; HTML entry point replaced atomically. Previous hashed assets
  remain available to existing tabs. No sudo or service restart was needed.
- Source hashes, raw logs, screenshots and deployment metadata:
  `/home/vinuxito/.cache/abrndrive-lint/`.

Pre-existing modified backend binary, `.omc` runtime files, and untracked runtime,
agent, codegraph and historical backup directories were preserved. Only this
repair's source, tests, plan and documentation belong in its commit.

Verdict: **SEGURO CONTINUAR**.

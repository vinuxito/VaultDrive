# ABRN Drive download/PIN repair — 2026-09-14

Status: DEPLOYED AND VERIFIED. Live browser regressions: 4/4 passed.

## User-visible failure and fixes
Opening bulk download exposed a password field without a form boundary. The file
search was an unclassified text input, susceptible to being paired as a username
field by browser/password-manager heuristics. A synthetic autofill input event
reproduced the screenshots: search became an email, visible selection became
empty, and the modal read “Download 0 files” / “Credentials ready” with no PIN.

The download batch is now captured when opened, including folder context.
Background vault content is inert and search is disabled during credential
prompts. Search has its own search form and autocomplete hints; credentials have
separate form boundaries and PIN/password autocomplete hints. Empty batches
cannot start. The shared credential classifier recognizes drop PIN, owner PIN,
shared RSA PIN, folder-key, and older password formats.

A wrong owner PIN also cached an unverified key before decryption, preventing
corrected credentials from succeeding. File keys are now cached only after
AES-GCM authenticated decryption succeeds. Single-download prompts stay open
on failure and clear rejected credentials. Start/Cancel/Done form behavior was
checked, including the Done double-submit regression.

## Verification matrix
| Check | Evidence | Result |
|---|---|---|
| Original selection/autofill reproduction | Playwright injected email input event before repair | RED: Download 1 disappeared; Download 0 shown |
| Wrong-PIN cache reproduction | Reinstated old early cache in local source; owner browser test | RED: corrected PIN produced no download |
| Single-PIN retry reproduction | Browser test before removing premature prompt close | RED: retry input disappeared |
| Focused modal/classifier tests | vitest run for BulkDownloadModal.test.tsx and file-credential.test.ts | 15 passed, exit 0 |
| Full frontend unit suite | npm test | 162 passed, 1 skipped; exit 0 |
| Changed-file lint | eslint files.tsx, FileSearch, BulkDownloadModal, classifier and regression tests | exit 0 |
| Production build/typecheck | npm run build -- --outDir /home/vinuxito/.cache/abrndrive-download/dist | exit 0 |
| Local browser suite | download-autofill.spec.ts, Desktop Chrome, synthetic API fixtures | 4 passed, exit 0 |
| Public HTML identity | curl followed redirects; sha256sum compared with staged index | identical |
| Live server readiness | GET https://abrndrive.filemonprime.net/ready | HTTP 200, 439/439 files, migrations 49, DB/secrets/uploads ok |
| Live browser suite | Same four tests against public deployed assets | 4 passed (16.0s), exit 0 |
| Independent code review | 7 changed source/test files | approved, no findings |

Browser cases cover single and bulk downloads for drop-wrapped and owner PIN
files. They inject an autofill event even when search is disabled, require the
PIN prompt, decrypt and save a real encrypted fixture, and compare downloaded
bytes with original plaintext. Owner cases enter a wrong PIN before retrying.
Normal search is verified after the modal closes. Actual browser password-manager
autofill heuristics are not automated; the resulting input event is reproduced.
All API responses in these browser cases are intercepted synthetic fixtures;
no real user login, PIN, or documents are used. Backend readiness is a separate
live check, not a substitute for the browser regressions.

## Deployment and rollback
Only frontend assets were published. No backend/service restart or database,
secret or ciphertext mutation was needed. Existing hashed assets were retained
for tabs still holding the previous HTML. New assets were copied first, then the
index was replaced atomically. Reload the open application tab to load the fix.

- Backup: `/home/vinuxito/.cache/abrndrive-download/dist-before`
- Staged build: `/home/vinuxito/.cache/abrndrive-download/dist`
- Prior index SHA-256: `9aabd264c397d9470c33d0e246f43fc1345b9cd046c5279e455357f5f62b0e36`
- Published index SHA-256: `073f916a168802ddca9689d3a7aaebac5a7e12b7a759ba2d9c6d46506f7e8cce`

To roll back, restore the backed-up index atomically; old hashed assets are still
present. Restore other backed-up static files only if needed. Do not touch uploads.
Existing unrelated dirty worktree files remain preserved.

## Exact browser command
```bash
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/opt/google/chrome/chrome \
E2E_BASE_URL=https://abrndrive.filemonprime.net/abrn/ \
./node_modules/.bin/playwright test e2e/download-autofill.spec.ts \
  --project='Desktop Chrome' --workers=1 --reporter=line
```

# UI/UX coherence coverage ledger — 2026-09-14

Implementation baseline: `1f42296`; iteration3 source: `3b26b8d`. This ledger is updated through iteration7. Current status: **iteration4 proof in progress; not a production acceptance certificate**.

## Evidence meanings

- **Implemented/source** identifies a current route and integration seam, not an accepted user journey.
- **Component/Go tests** exercise explicit logic and failures; private PostgreSQL tests use schema49 in a socket-only test cluster.
- **Intercepted browser fixture** uses real rendering/crypto with synthetic API responses. It proves the stated UI behavior, not server authorization or production availability.
- **Isolated backend browser** uses synthetic accounts/files on `127.0.0.1:8091/abrn/` and a private database/upload directory.
- **Physical device / user accepted / production deployed** require separate evidence. None is inferred from responsive Chromium, fixture success, or a Git commit.

All21 existing route patterns plus the new fallback are listed below, relative to `/abrn/`. Route visibility never substitutes for API authorization or successful file bytes.

| Route | Audience | Implemented source | Proof status / limit |
|---|---|---|---|
| `/` | Visitor | `home.tsx` | All six skins/desktop+phone route fixtures passed in iteration4 baseline; EN/ES interaction pass in5 |
| `/about` | Visitor | `about.tsx` | All six skins/desktop+phone route fixtures passed in4 |
| `/login` | Owner / new user | `login.tsx` | Isolated signup/password/PIN login passed in iterations2–3; intent/passkey negatives expanding |
| `/recover` | Recovering owner | `recover.tsx` | Malformed/cancelled recovery components pass; isolated custodian reset/new PIN RSA bytes and original PIN legacy bytes pass |
| `/force-password-change` | Owner with reset flag | `force-password-change.tsx` | Route implemented; complete browser outcome not yet confirmed in this implementation run |
| `/drop/:token` | Public sender | `drop-upload.tsx` | Existing isolated full Drop cycle passed during iteration4 baseline; partial/unknown browser proof expanding |
| `/share/:token` | Public recipient | `PublicSharePage.tsx` | Real crypto/bytes in intercepted browser fixture passed; isolated lifecycle suite running |
| `/folder-share/:token` | Public recipient | `PublicFolderSharePage.tsx` | Isolated owner PIN recovery/full fragment URL/fresh recipient ZIP exact bytes passed in4 |
| `/request/:token` | Public sender | `FileRequestPage.tsx` | Mixed-batch/unknown proofs pass; isolated sender-to-owner exact password-decrypted bytes passed in4 |
| `/dashboard` | Owner | `dashboard.tsx` | Independent count error/stale/real-zero components and six-skin route matrix pass |
| `/files` | Owner / recipient | `files.tsx` | Quick Share and autofill browser fixtures pass; isolated owner upload and Drop decryption passed |
| `/shared` | Direct/group recipient | `shared.tsx` | Error/forbidden/retry component proof passes; isolated recipient bytes expanding |
| `/profile` | Owner | `profile.tsx` | Single-shell component proof and six-skin route matrix pass |
| `/settings` | Owner | `settings.tsx` | Isolated PIN/agent-key/audit surface checks passed; full suite running |
| `/groups` | Group owner/member | `groups.tsx` | Isolated membership/deletion/UI-create passed; strict duplicate button selector repaired |
| `/groups/:id` | Group owner/member | `groups.tsx` | Independent-source component proof; isolated share/revoke-from-group API checks passed |
| `/admin` | Administrator | `admin.tsx` | 503/403 components and retry browser fixture pass; no customer admin mutation |
| `/admin/tests` | Administrator | `admin-tests.tsx` | Six-skin visibility-only matrix passed; built-in mutating diagnostic runner not used on production |
| `/access-center` | Owner | `access-center.tsx` | Recovery/revoke/source-error components passed; real full-link recovery proof expanding |
| `/help` | Owner / administrator | `help/index.tsx` | Role/query-section component proof passes; bilingual/contextual visual pass pending |
| `/room/:roomId` | Room participant | `zk-room.tsx` | Existing isolated room creation/read-only/expiry checks passed in4 baseline |
| `*` | Any visitor | `not-found.tsx` | Named fallback/back/Files tests pass; explicit browser check pending |

## Observed regression ledger

| Recon ID | Original failure | Owning change / evidence | Remaining gate |
|---|---|---|---|
| B01 | Spanish landing/login still mixed English | Translation pass is iteration5 | Full critical EN/ES matrix |
| B02 | Palette ignores Escape; English Files/palette in ES | Keyboard/focus tests pass in iteration1; text pass iteration5 | Browser EN/ES actions |
| B03 | Two shells on Access Center | Nested layouts removed; one-shell component tests pass | Full route visibility matrix |
| B04 | Phone nav lacks Access Center/Help | Destinations added and tested | Open drawer across six skins/EN/ES/zoom |
| B05 | Access503 renders empty grants/zero | Independent unknown/stale/timestamp/retry tests pass | Critical-state visual matrix |
| B06 | Failed dashboard sources render0 | Per-source nullable counts and retry tests pass | Critical-state visual matrix |
| B07 | Ciphertext503 blames missing fragment, no recovery | Typed transport error and explicit retry; browser real-crypto exact bytes and no automatic one-use replay pass | Isolated lifecycle suite / actual device save |

## Release and acceptance gates

- Raw commands/results/artifacts: `.omx/reports/coherence-implementation-2026-09-14/`; session narrative: [implementation log](../SESSION_MEMORY_2026-09-14-ui-ux-coherence-implementation.md).
- Iteration3:374 frontend tests/0 skips;63 private-DB Go tests/0 skips with race detector;7 staged browser checks. Later rows must use later-run counts, not extrapolate.
- Full existing browser baseline:73 passed/11 failed out of84; ten test-harness drift cases and one real mobile overlay bug were repaired. Targeted reruns cover all eleven failures:2 group/key,2 demo/onboarding,7 six-skin PIN/share+mobile. All passed; no skips/deleted failures. Final cold combined suite remains iteration7.
- Five-person unassisted trials, physical phone/passkey/save acceptance, service reboot/restore and privileged production cutover are **not run** in this ledger. Final report must retain these distinctions.
- No client upload-id lookup exists in current APIs. Ambiguous POST acceptance is deliberately unknown with recipient/owner confirmation and no blind resend; exact filename/count matches are insufficient proof.

Iteration4 final static/unit evidence:387 frontend tests across87 files,0 skips;64 private PostgreSQL Go tests with race detector,0 skips. App+E2E types, lint, private builds, Go vet, config and whitespace all exit0. Folder/request proofs each1/1; upload4/4; offline2/2. Account session1/1 and recovery cohort1/1 passed: new-PIN RSA shared bytes plus original-PIN legacy bytes.

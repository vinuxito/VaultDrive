# ABRN Drive: UI/UX coherence upgrade roadmap

Date: **2026-09-14 (UTC)**. Scope: **`/lamp/www/ABRN-Drive` only**. Source baseline: `570ec0a` on `main`. Status: planning and reconnaissance complete; the seven upgrades below are **proposed, not implemented**.

The goal is a user who understands where they are, chooses the right action, trusts its outcome, and finishes without the builder beside them. Preserve the six existing templates and their identities. Prioritize broken journeys and misleading states before adding features.

## Current-state assessment

### 1. Strongest areas

1. **A recovered, observable deployment.** Fresh read-only production checks returned `ready` and `ok`; readiness reported migration 49 and 439 stored files. `abrndrive.service` was active, enabled, and had zero restarts. This supports current availability, not reboot survival or every authenticated operation. See the [service recovery report](../../reports/2026-09-14-service-recovery-verification.md) and fresh evidence below.
2. **A substantially better visual baseline.** The [September theme report](../../reports/2026-09-14-theme-contrast-verification.md) records 426 visual states covering 21 route patterns, six templates, desktop and phone viewports, with zero recorded contrast/overflow failures. Preserve that work. Its measured states do not certify every open overlay, keyboard path, or physical device.
3. **Real credential/download regressions.** The [download repair](../../reports/2026-09-14-download-pin-verification.md) protects selection from autofill, preserves editable wrong-PIN retries, and checks decrypted fixture bytes. The [latest lint report](../../reports/2026-09-14-frontend-lint-verification.md) records 265 unit passes, one skip, zero lint errors/warnings, 30 staged browser passes and six published smoke passes. These are reviewed same-day reports, not full suites rerun for this roadmap.
4. **Reusable coherence mechanisms already exist.** [DataState](../../../vaultdrive_client/src/components/ui/data-state.tsx#L19), [row actions](../../../vaultdrive_client/src/components/ui/row-action-menu.tsx), [shared copy](../../../vaultdrive_client/src/constants/copy.ts), EN/ES resources, the PIN/session-vault layer and [activity receipts](../../../vaultdrive_client/src/components/vault/ActivityReceiptDrawer.tsx#L88) give builders a base to extend. Inconsistent adoption is the problem; another component framework is unnecessary.
5. **The main product journeys and a broad test harness are present.** The app implements owner storage, public file/folder sharing, inbound Drop/File Request collection, user/group sharing, recovery and administration. [Current E2E specs](../../../vaultdrive_client/e2e), [backend routes](../../../main.go#L375), and the [trust harness](../../15_TRUST_PROOF_HARNESS.md) provide implementation and regression starting points. A spec's presence alone does not prove its latest execution passed.

### 2. Weak spots and blind spots, in priority order

| Finding | Evidence and user consequence | Roadmap owner |
| --- | --- | --- |
| Access Center Copy/Open produces fragmentless file/folder share URLs | [URL construction](../../../vaultdrive_client/src/pages/access-center.tsx#L250) omits the decryption fragment that [file creation](../../../vaultdrive_client/src/components/vault/CreateShareLinkModal.tsx#L163) and [folder creation](../../../vaultdrive_client/src/components/vault/CreateFolderShareLinkModal.tsx#L251) include. A recipient receives an unusable link. Confirmed in source; no real customer's link was copied. | Step 01 |
| Recoverable transfer failures become dead ends | Fresh browser B07: a complete synthetic public share link receiving HTTP 503 shows missing-`#` advice, an English fetch error, and no retry. [Public error rendering](../../../vaultdrive_client/src/pages/PublicSharePage.tsx#L517) treats unrelated failures alike. | Step 02 |
| Failure looks like absence or success | Fresh B05: Access Center's two list requests returning 503 render zero grants and “No access grants match this filter.” B06: failed dashboard count sources render zeros. [Access loading](../../../vaultdrive_client/src/pages/access-center.tsx#L70) and [dashboard loading](../../../vaultdrive_client/src/pages/dashboard.tsx#L94) confirm the cause. | Step 03 |
| Navigation and language change between surfaces | Fresh B01–B04: Spanish chrome surrounds English landing/file/command-palette content; Escape leaves the palette open; Access Center has two headers; phone drawer lacks Access Center and Help. These increase orientation and support costs even when a screen has adequate text contrast. | Step 04 |
| Security setup and recovery still require interpretation | [Onboarding](../../../vaultdrive_client/src/components/onboarding/OnboardingWizard.tsx#L33) already covers privacy, PIN and first folder. [Recovery](../../../vaultdrive_client/src/pages/recover.tsx#L384) shows indefinite waiting and “Reconstructing” while still asking for a new password. Distinct PIN, account-password, sender-password and legacy credentials need contextual explanation, not indiscriminate renaming. | Step 05 |
| Trust copy/events can exceed the actual outcome | [Single-use handling](../../../handle_public_share_links.go#L269) consumes access before streaming, ignores the stream-copy result and then records a completed-download event. [Spanish copy](../../../vaultdrive_client/src/locales/es/drive.json#L148) describes deleting a server key and self-destructing the file, although the handler deactivates the link. Receipts/help need accurate events and consequences. | Steps 02, 06 |
| The documented trust model has flow-specific exceptions | [Drop owner recovery UI](../../../vaultdrive_client/src/components/upload/UploadLinkCard.tsx#L55) sends a PIN to its recovery endpoint; [the handler](../../../handle_drop.go#L979) unwraps and returns a key server-side. This existing path is not browser-only key recovery. Do not expand it or repeat an absolute “server never sees keys” claim without reconciling the specific contract. | Steps 01, 06 |
| Evidence and runbooks have drifted | [README](../../../README.md) mixes fresh September results with July “production-ready/certified” language and a sibling-project deploy section. [Frontend README](../../../vaultdrive_client/README.md) and old harness docs contain older counts/defaults. CI has browser coverage, but [main CI](../../../.github/workflows/ci.yml) lacks an explicit frontend lint gate. | Step 07 |

### 3. Product direction

The [root README's product description](../../../README.md#L3), [frontend product truths](../../../vaultdrive_client/README.md#L40), and [PIN/sharing design](../../04_RSA_PIN_SHARING.md) describe a self-hosted, browser-encrypted drive with controlled sharing, account-free collection, group collaboration, scoped agent access and auditability, branded here as ABRN Drive. The next product layer should make those existing capabilities legible as everyday tasks: store privately, send access, receive files, understand who can access what, and recover from failure. Treat the documented cryptographic model as an implementation contract to preserve and test, not an independent security certification. Nothing in the inspected sources justifies a new marketplace, pricing system, collaboration platform or visual identity.

### 4. Momentum check

The immediate sequence was service restoration (`497bc61`), download/PIN/autofill repair (`efee0b3`), template contrast repair (`a585d0c`), and frontend lint cleanup (`570ec0a`). The next logical layer is **cross-screen flow coherence and truthful outcomes**.

This roadmap supersedes the *prioritization* of the [April roadmap](../2026-04-26-ui-ux-coherence-upgrade-roadmap.md) and [June roadmap](../2026-06-05-ui-ux-coherence-upgrade-roadmap/index.md) for this ABRN workspace. It does not erase their history. [April foundations](../../SESSION_MEMORY_2026-04-27-coherence-foundations.md), [June mobile closeout](../../memories/session-2026-06-06-mobile-bottom-sheets-closeout.md), current onboarding and receipt code show that several old recommendations are already implemented. Do not restart them from scratch or repeat old “fully verified” claims as current acceptance.

## Reconnaissance and evidence ledger

Read the requested Filemón philosophy brief first and applied its practical principles: establish the intended result, inspect reality, separate evidence from inference, preserve unrelated work, choose small reversible changes, and document limits. Inspected root/frontend READMEs, latest September session notes and reports, earlier coherence plans, frontend routes/components/tests, backend sharing/readiness handlers, service installation docs and CI. No `feature-audit.md` was found in the inspected project inventory; this ledger is the bounded audit for the roadmap.

### Fresh browser use

Used the project Playwright CLI skill against the deployed app, then programmatic Playwright against the **same deployed assets** for deterministic failure injection. The latter intercepted all `/api/**` requests with synthetic account/file responses and blocked service workers. No customer PINs, credentials, file contents or backend writes were used. Browser viewport checks are not physical-device tests.

| ID | Mode and action | Observation |
| --- | --- | --- |
| B01 | Live public homepage: switch EN → ES; follow login | Navigation translates, but landing content stays English; Spanish login includes “Recover Lost Account.” |
| B02 | Synthetic authenticated owner, ES, 1280×900: open Files and command palette, press Escape | File filters and palette remain English; palette remains open after Escape despite its ESC hint. |
| B03 | Synthetic owner: open Access Center | Two header instances and duplicated navigation text; screenshot confirms the nested shell. |
| B04 | Synthetic owner, 390×844: open phone navigation | Drawer offers Files, Groups, Shared, Profile, Settings; Access Center and Help are absent. |
| B05 | Inject 503 for `/v1/shares` and `/drop/tokens` | Access Center displays zeros and “No access grants match this filter,” with no load-error recovery action. |
| B06 | Inject 503 for dashboard `/files`, `/drop/tokens`, `/groups`; `/files/shared` remains a healthy empty fixture | Failed sources render zeros instead of unavailable counts. Other healthy fixture endpoints do not make those count responses valid. |
| B07 | Open valid-format synthetic `share/:token#key`; click Download; inject 503 for ciphertext fetch | “Algo salió mal,” “Failed to fetch file (503),” and advice to include `#`; no retry button. No ciphertext was downloaded in this diagnostic case. |

The final scripted pass completed with exit 0 and captured **nine states**: Files, palette open, palette after Escape, healthy Access Center, phone menu, Access Center failure, dashboard failure, public-share ready, public-share failure. Early fixture attempts had harness errors; they were corrected and excluded from findings. Raw scripts, JSON, snapshots and synthetic screenshots are local diagnostic artifacts under `.omx/reports/ui-ux-coherence-2026-09-14/`; the observations and source links above are the portable record.

### Current route and flow inventory

[App.tsx](../../../vaultdrive_client/src/App.tsx#L45) defines these **21 route patterns**, relative to deployed `/abrn/`. This is a source inventory; fresh browser use is limited to B01–B07. Admin/group/room authorization and completed mutation flows require their own tests.

| Surface | Routes | Implemented purpose |
| --- | --- | --- |
| Public introduction | `/`, `/about` | Product entry and explanation |
| Account entry/recovery | `/login`, `/recover`, `/force-password-change` | Password/PIN/passkey entry and account recovery/change gates |
| Public recipient/sender | `/share/:token`, `/folder-share/:token`, `/drop/:token`, `/request/:token` | File/folder downloads and account-free collection |
| Authenticated owner/member | `/dashboard`, `/files`, `/shared`, `/groups`, `/groups/:id`, `/access-center` | Overview, vault, inbound sharing, membership and outbound-link management |
| Account/support | `/profile`, `/settings`, `/help` | Account, security/configuration and role-aware help |
| Administration | `/admin`, `/admin/tests` | Administrative controls and diagnostics |
| Existing collaboration | `/room/:roomId` | Encrypted room journey; retain support, defer expansion |

### Verification boundary

| Check | Evidence | Limit |
| --- | --- | --- |
| `curl -fsS https://abrndrive.filemonprime.net/ready` | Exit 0; `status: ready`; migration 49; files 439; database/migrations/secrets/storage OK, at approximately 15:44 UTC | Point-in-time readiness only |
| `curl -fsS https://abrndrive.filemonprime.net/api/healthz` | Exit 0; `status: ok`; `version: dev`; uptime about 15h13m | Does not identify an immutable backend release or prove all operations |
| `systemctl show abrndrive.service -p ActiveState -p UnitFileState -p NRestarts -p ExecMainStartTimestamp -p WorkingDirectory` | Exit 0; active/enabled; `NRestarts=0`; started 00:30:42 UTC; ABRN working directory | No reboot/restart was performed |
| Public CLI + intercepted Playwright | B01–B07 above; final Node browser audit exit 0 | Synthetic authenticated/failure responses, not live customer end-to-end acceptance |
| Latest application verification | September lint/theme/download reports linked above | Full unit/backend/mutation suites were **not rerun** for this documentation-only task |
| `python3 .omx/reports/ui-ux-coherence-2026-09-14/verify-roadmap.py` | Exit 0; eight roadmap Markdown files, seven steps, 49 required field/section checks, 131 relative references valid; nine owned staged files including README | Structure, file/line references and commit scope only |
| `git -c safe.directory=/lamp/www/ABRN-Drive diff --cached --check` | Exit 0; no patch whitespace errors | Documentation-only patch |
| Independent critic review | Approved after correcting Drop recovery boundaries, unrepresentable terminal reasons and interrupted-stream completion semantics; no remaining blockers | Planning/source review, not execution of proposed acceptance tests |

### Unknowns and how to resolve them

| Unknown | Required verification |
| --- | --- |
| Real unassisted completion rate and support volume | Observe representative owners, recipients and senders using synthetic documents; record completion, wrong turns and requests for help. No percentage improvement is claimed today. |
| Current full backend/E2E green state and remote CI result | Run existing suites in a verified isolated DB/upload/build environment and inspect fresh CI artifacts at the exact candidate revision. |
| Hardware passkeys, mobile save behavior, interrupted large files | Test physical Android/iOS and available authenticators with fixtures; compare saved bytes and explicitly document unsupported combinations. |
| Recovery eligibility and post-reset decryption for all account cohorts | Exercise prepared accounts with/without custodians, legacy wrapping and PIN re-enrollment; never imply that support can reconstruct an unavailable key. |
| Recovery material for every old file/folder/drop link | Inspect the specific stored wrapped-key format and client recovery path; exercise old fixtures before enabling Copy. If unavailable, offer an honest owner recreation path. |
| Production reboot survival and restore readiness | A separately scheduled operator exercise with rollback and restore evidence; current active/enabled state is insufficient. |
| Immutable backend release identity | Match an approved binary/build identifier to source and report it; `version: dev` and a modified local binary cannot establish parity. |

## A. The full seven-step roadmap

Ranked by immediate user harm first, then durable coherence. Complexity is a planning estimate: **S** = narrow component/copy change, **M** = several related screens plus tests, **L** = cross-layer contract/compatibility work. These are not delivery promises. Each linked step contains its complete builder scope and definition of done.

| Rank | Step | Category | Complexity | Expected result |
| --- | --- | --- | --- | --- |
| 1 | [Make copied links usable and access controls dependable](step-01-usable-links-and-access-controls.md) | UX / security | M–L | Recipients receive decryptable links; owners understand and control future access. |
| 2 | [Finish transfers and recover without losing work](step-02-transfer-completion-and-recovery.md) | UX / architecture | M–L | Recoverable errors have useful actions; partial work and credentials remain recoverable. |
| 3 | [Make loading, failure and synchronization states truthful](step-03-truthful-data-and-service-states.md) | UX / observability | M | Unknown counts are not zeros; users see stale, offline and pending work honestly. |
| 4 | [Unify navigation, language and interaction across templates](step-04-navigation-language-and-templates.md) | UX / product | M | One recognizable app across owner/admin/public journeys, phone and desktop. |
| 5 | [Guide first use, credentials and account recovery](step-05-first-use-and-credential-guidance.md) | product / security | M | Users know which secret is needed and what the next valid step is. |
| 6 | [Explain trust and help at the point of action](step-06-contextual-trust-and-help.md) | UX / observability | M | Users can explain the outcome and resolve common confusion without technical support. |
| 7 | [Make coherent journeys a release requirement](step-07-journey-proof-and-release-docs.md) | testing / developer experience | M initially; ongoing | Evidence and runbooks stay tied to actual releases and user completion. |

## B. The three most urgent upgrades

1. **Step 01 — usable links. Impact: critical; complexity: M–L.** A successful-looking Copy action currently generates an incomplete share URL. First correct that path using existing client-side key recovery, with an explicit unavailable state where recovery is unsupported. Do not wait for the full access-management polish.
2. **Step 02 — transfer recovery. Impact: critical; complexity: M–L.** An ordinary server failure becomes a dead end and misleading key advice. Start with typed errors and safe retry; separately settle limited-use consumption semantics before changing the protocol.
3. **Step 03 — truthful states. Impact: high; complexity: M.** A failed security inventory must not tell the owner there are no grants. Start with independent error states and retry for Access Center, then dashboard counts and pending synchronization.

## C. The two biggest long-term strategic upgrades

1. **A consistent access-and-evidence model: Steps 01 and 06.** Make each grant's direction, recipient scope, present status, actual revocation consequence and evidence understandable wherever it appears. This realizes the existing control-plane product promise without another management product.
2. **Repeatable independent usability acceptance: Step 07.** Keep browser fixtures, actual backend contracts, physical-device checks and unassisted user trials distinct but connected. This prevents “build passed” or a dated certification label from replacing proof that people can finish.

## D. What NOT to do yet

- Add or replace templates, redesign the brand, or create a new CSS/component framework. Extend existing tokens and test open/error states across all six templates.
- Split `files.tsx` wholesale, adopt a global state library, or migrate every request to SWR merely for uniformity. Extract only the boundary needed to fix a named journey.
- Add rooms/chat features, billing, subscriptions, marketplaces or multi-organization routing. Existing rooms/agent/admin surfaces remain supported and tested; expansion waits.
- Rewrite encryption, collapse distinct credentials into one field, or expose keys to the server to simplify link copying. Preserve existing formats and security boundaries.
- Perform migrations, deploy from the sibling-project runbook, run default E2E against live storage, or declare uptime/recovery certified from health checks alone. No infrastructure change is part of authoring this roadmap.

## E. Recommended execution order

1. **Quick win / coherence pass:** prepare Step 07's baseline evidence checklist, then deliver Step 01's broken-copy repair, Step 03's false-empty repair, and Step 04's duplicate-shell/phone navigation/ESC/critical-language fixes as small slices. A Step 01 key-compatibility investigation can proceed alongside Step 04's independent UI work; assign separate file ownership.
2. **Flow hardening:** finish Steps 01–03 through real backend fixtures; then Step 05 onboarding/recovery and Step 06 contextual trust/help. Step 04 supplies shared vocabulary and navigation contracts; Step 06 consumes actual outcomes established in Steps 01–03. Protocol changes require a documented decision and compatibility tests before release.
3. **Testing:** run focused regressions before and after each slice, then lint, typecheck, unit tests and a privately staged build. Extend existing Playwright lifecycle suites on isolated storage. Check six templates, EN/ES, keyboard, phone/desktop and negative states; perform physical-device and unassisted trials for the relevant claims. Step 07 is a continuous gate, not a final cleanup week.
4. **Documentation / session update:** after every verified slice, record revision, commands, exit codes, exact scope, evidence and remaining unknowns in repo session/report Markdown. Update this index's step status and the root/frontend README evidence pointers; archive superseded claims instead of silently carrying them forward. No global Codex memory changes are needed.
5. **Commit strategy:** work on `main`, with one behavior-focused commit containing source, regression and its evidence; separate reusable shell changes from access/transfer contracts. Review `git diff --check` and the staged file list, commit only owned changes, and push `origin/main`. Preserve unrelated binary/runtime/history changes. Build privately and publish only verified application changes using the ABRN-specific deployment procedure; a roadmap-only commit requires no deployment.

## Builder handoff and stop condition

Use each step file as an independently reviewable task. All acceptance criteria below are **targets**, not current pass claims. Scope additions need evidence of a blocked existing user journey. The roadmap is delivered when this index and seven linked files are validated; the app upgrade is complete only when their acceptance evidence exists. Fewer wrong turns, truthful outcomes and independent flow completion are the success measures—not screen count.

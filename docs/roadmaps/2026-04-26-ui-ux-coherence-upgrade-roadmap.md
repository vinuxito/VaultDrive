# UI/UX Coherence Upgrade Roadmap — QuantiX Drive

**Date:** 2026-04-26
**Author:** Senior strategist / architect / UX coherence audit
**Status of project at time of writing:** Hardened, verified green (38/38 E2E, 72/72 unit, backend `go test ./...` ✅) per [docs/28_BUILD_VERIFICATION_2026-04-16.md](../28_BUILD_VERIFICATION_2026-04-16.md). Branch is commit-safe, deployable.

> ⚠️ **Scope correction.** The original brief mentioned "calendar event rows + closet item cards" — those surfaces do not exist in QuantiX Drive. They appear to be carried over from another project. In this roadmap, the `<RowActionMenu>` pattern is adopted across the **actual** row/card surfaces in this app: file rows, folder rows, share-link rows, folder-share-link rows, drop-link rows, file-request rows, agent-key rows, group-member rows. The pattern is the same; the surfaces are repo-truth.

---

## 1. Current-state assessment

### 1.1 Project direction (one paragraph)

QuantiX Drive is a **zero-knowledge encrypted file control plane** that doubles as a reusable upstream product (downstream overlays like ABRN-Drive only override branding/config). The product's center of gravity is **trust**: every server action is surfaced to the owner, all encryption is browser-side, every share/drop/request has receipts. The next phase is *not* a new feature domain — it is converting hard-won technical hardening into a **coherent, calm, guided user surface** that an unassisted real user can navigate without a builder standing next to them.

### 1.2 Momentum check

The last six months of work, in order, delivered:

- Encryption + sharing primitives (PIN, RSA, drop, public share, file requests) — *complete and proven*.
- Trust UX (TrustRail, receipts, security timeline) — *complete*.
- Enterprise polish 1 (3-tab settings, skeleton loaders, dashboard clarity) — *complete*.
- One-PIN unification + credential cache — *complete*.
- Admin user management + force-password-change — *complete*.
- E2E suite (38 tests) + Playwright self-bootstrapping harness — *complete*.
- Skin system (6 themes) + theme-color consistency (no hardcoded hex anywhere) — *complete*.
- Latest pass (2026-04-16): session-vault clearing on login, cached-PIN recovery in folder-share modal, isolated test DB/upload harness, fresh green verification.

**The next logical layer is not more crypto, not more domains, not new features.** It is **coherence and confidence**: the same row pattern across every surface, the same destructive-confirmation copy everywhere, the same loading/empty/error vocabulary, the same "what just happened" feedback. The repo has 90% of the *atoms*. The missing layer is the *grammar* that makes them feel like one product.

### 1.3 Strongest areas (leverage these)

1. **Zero-knowledge crypto + trust receipts** — *Evidence:* [docs/04_RSA_PIN_SHARING.md](../04_RSA_PIN_SHARING.md), [docs/13_TRUST_UX_HARDENING.md](../13_TRUST_UX_HARDENING.md), browser-only key handling, AccessPanel surfaces every outbound link. *Leverage:* every UX upgrade should *reuse* the trust-receipt language ("the server cannot read this file") rather than invent new copy.
2. **Theming infrastructure** — *Evidence:* [docs/26_SKIN_SYSTEM_2026-04-12.md](../26_SKIN_SYSTEM_2026-04-12.md), [docs/27_THEME_COLOR_CONSISTENCY_2026-04-12.md](../27_THEME_COLOR_CONSISTENCY_2026-04-12.md), 6 skins, all CSS vars, no hex. *Leverage:* new components inherit theme correctness for free — the cost of polish has dropped dramatically.
3. **E2E + Playwright self-bootstrap** — *Evidence:* [vaultdrive_client/playwright.config.ts](../../vaultdrive_client/playwright.config.ts), 38/38 green, isolated DB + uploads. *Leverage:* every UX change can be locked in by adding one E2E case rather than relying on visual review.
4. **Component library maturity** — *Evidence:* [src/components/ui](../../vaultdrive_client/src/components/ui) (avatar, badge, button, card, dialog, dropdown-menu, switch, tabs, tooltip), [src/components/vault](../../vaultdrive_client/src/components/vault), [src/components/upload](../../vaultdrive_client/src/components/upload). *Leverage:* `<RowActionMenu>` does not need to be invented from scratch — it can compose dropdown-menu + button + tooltip primitives that already exist.
5. **Single-binary deploy + stable `/api/v1/`** — *Evidence:* [README.md](../../README.md), Dockerfile, governance settings, agent API keys. *Leverage:* the backend contract is stable enough that all the remaining work is frontend coherence; we are not pulled back into API churn.

### 1.4 Weak spots / blind spots (rank-ordered by user impact)

| # | Weakness | Where it shows | Why it hurts the user |
|---|----------|----------------|------------------------|
| 1 | **Inconsistent row affordances** | Files explorer rows, share-link rows in AccessPanel, folder-share rows, drop-link rows, file-request rows, agent-key rows, group-member rows all have *different* action layouts (some MoreHorizontal, some inline buttons, some hover-revealed). | User has to relearn "how do I act on this thing" on every screen. |
| 2 | **Destructive-confirmation copy is scattered** | Delete file, revoke share, revoke drop, remove group member, delete user, delete file request, expire link — each lives in its own component with its own wording, button label, and risk language. | Inconsistent risk signals. Some confirmations say "Are you sure?", some say "This cannot be undone", some say nothing. |
| 3 | **Loading copy is ad-hoc** | "Loading...", "Decrypting...", "Uploading...", "Working...", inline spinners with no label, blank cards with no skeleton. | User does not know whether the app is broken or just busy. Particularly painful in the crypto-heavy flows (decrypt private key, unwrap file key) which can take 1–3 seconds. |
| 4 | **Empty states under-explain next action** | Empty Files explorer, empty AccessPanel, empty Groups, empty Agent Keys, empty File Requests. Some have icons + headings; some are just blank. | Brand new users land on an empty page with no narrated "do this next." Onboarding is partial. |
| 5 | **Error surfacing is inconsistent** | Some errors raise toasts, some inline `<AlertCircle>` banners, some throw to console, some replace the whole panel. PIN-cache-fail recovery in folder-share is a model of correctness — most other modals do not match it. | User can't predict where errors will appear, so they don't know where to look. |
| 6 | **Onboarding ends abruptly** | The PIN-setup banner exists, but after the user sets their PIN there is no "now try this" hand-off into a meaningful first action (upload? receive a drop? share?). | Drop-off after step 1. |
| 7 | **Settings vs. Access Center vs. Profile boundary is fuzzy** | Three pages exist; some user-state flows overlap (sessions live in Settings, sharing lives in Access Center, identity lives in Profile). | Users hunt across tabs to find a single setting. |
| 8 | **Trust language is denser on some surfaces than others** | The Drop pages and AccessPanel lean into trust copy ("the server cannot read this") well. Files explorer and Dashboard barely echo it. | The product's biggest differentiator is invisible on the most-visited surface. |
| 9 | **Mobile coverage unknown** | `components/mobile/` exists but no recent verification report covers small-screen flows. | **UNKNOWN** — needs a verification pass before assuming. |
| 10 | **Skin switcher discoverability** | 6 skins shipped; only Settings exposes the switch. | A delight feature is hidden. |

---

## 2. The 7-step roadmap

Each step has: Category, Why now, What exactly, What it builds on, What risks it avoids, Expected payoff, Definition of done.

---

### Step 1 — Adopt `<RowActionMenu>` across every row surface

**Category:** UX, developer experience

**Why this step matters now**
The repo has at least 7 different "row of stuff with actions on it" surfaces (file rows, folder rows, share-link rows, folder-share rows, drop-link rows, file-request rows, agent-key rows, group-member rows). Each was built at a different time and has its own action affordance. The user re-learns the interaction model every time they switch screens. Picking *one* row pattern and rolling it out is the highest-leverage coherence move available — it touches every screen the user actually uses, and nothing about the data model changes.

**What exactly should be done**
1. Promote a single `<RowActionMenu>` component into [src/components/ui/row-action-menu.tsx](../../vaultdrive_client/src/components/ui/row-action-menu.tsx). It composes the existing `dropdown-menu.tsx` + `button.tsx` + `tooltip.tsx` primitives. Props:
   - `actions: Array<{ id, label, icon, kind: 'default' | 'destructive', disabled?, tooltip?, confirmRequired?: boolean, onSelect: () => void }>`
   - `align?: 'start' | 'end'`
   - `density?: 'comfortable' | 'compact'` (file row vs. dense access list)
2. Replace inline action clusters in:
   - [src/pages/files.tsx](../../vaultdrive_client/src/pages/files.tsx) (file rows, currently mix `Share2`, `Star`, `Download`, `Trash2`, `MoreHorizontal`).
   - [src/components/files/file-card.tsx](../../vaultdrive_client/src/components/files/file-card.tsx).
   - [src/components/vault/AccessPanel.tsx](../../vaultdrive_client/src/components/vault/AccessPanel.tsx) (revoke link).
   - [src/components/vault/FolderSharedLinksSection.tsx](../../vaultdrive_client/src/components/vault/FolderSharedLinksSection.tsx).
   - [src/components/upload/UploadLinksSection.tsx](../../vaultdrive_client/src/components/upload/UploadLinksSection.tsx).
   - [src/components/vault/FileRequestsSection.tsx](../../vaultdrive_client/src/components/vault/FileRequestsSection.tsx).
   - Agent keys list inside [src/pages/settings.tsx](../../vaultdrive_client/src/pages/settings.tsx).
   - Group members list inside [src/pages/groups.tsx](../../vaultdrive_client/src/pages/groups.tsx).
3. Define a destructive-action visual variant once (red label, leading icon, divider above) — never copy/paste it again.

**What existing work it builds on**
- Existing `dropdown-menu.tsx` shadcn primitive.
- Existing icon set (lucide-react already imported in every relevant file).
- Existing trust receipt language for confirm modals.

**What risks it avoids**
- User confusion from mismatched affordances.
- Future feature drift (every new domain inventing its own row pattern).
- Hover-only action regressions (the [SESSION_MEMORY_2026-03-14.md](../SESSION_MEMORY_2026-03-14.md) bug where Share buttons were invisible because of `opacity-0` hover-only CSS — `<RowActionMenu>` makes that class of bug structurally impossible).

**Expected payoff**
- One row interaction model across the whole product.
- Lower diff-cost on every future feature.
- Visible coherence in the first 10 seconds a user spends on Files or Access Center.

**Definition of done**
- [ ] `<RowActionMenu>` ships at `src/components/ui/row-action-menu.tsx` with unit-test coverage of `default`, `destructive`, `disabled`, and keyboard navigation paths.
- [ ] All 8 row/card surfaces above use `<RowActionMenu>`. No surface still uses ad-hoc inline action clusters.
- [ ] No `opacity-0` hover-revealed action exists anywhere in the codebase (`grep` proof).
- [ ] One Playwright case per surface verifies the menu opens, has the right destructive items, and confirms before destruction.
- [ ] Visual regression: Files explorer row, AccessPanel row, Agent-key row look like the same family.

---

### Step 2 — Centralise destructive + loading + empty copy in `constants/copy.ts`

**Category:** UX, product

**Why this step matters now**
Right now, "are you sure?" lives in seven components with seven wordings. "Loading…" lives everywhere with a different label or no label. Empty states differ in tone. The cost to *fix this once* is low; the cost to keep paying for inconsistency every release is high and growing.

**What exactly should be done**
1. Create `vaultdrive_client/src/constants/copy.ts` with three exported maps:
   - `CONFIRM_DESTRUCTIVE` — keyed by action, e.g. `deleteFile`, `revokeShareLink`, `revokeFolderShare`, `expireDropLink`, `removeGroupMember`, `deleteAgentKey`, `forceLogoutSession`. Each entry has `{ title, body, confirmLabel, cancelLabel, irreversible: boolean }`.
   - `LOADING` — keyed by operation, e.g. `decryptingPrivateKey`, `unwrappingFileKey`, `uploadingFile`, `creatingShareLink`, `revokingLink`, `loadingVault`. Each is a short verb-phrase in present-progressive (`"Decrypting your vault…"` not `"Loading…"`).
   - `EMPTY` — keyed by surface, e.g. `vaultEmpty`, `accessCenterEmpty`, `groupsEmpty`, `agentKeysEmpty`, `fileRequestsEmpty`. Each has `{ title, body, primaryAction: { label, route } }`.
2. Replace every hardcoded confirmation/loading/empty string across:
   - All `Modal.tsx` components in `vault/`, `files/`, `folders/`, `upload/`, `links/`.
   - `BulkActionBar`, `BulkDownloadModal`.
   - `Settings`, `Groups`, `Admin`, `AccessPanel`.
3. Use the trust language consistently: every destructive copy says explicitly *what the server can/cannot still do* (e.g. revoking a share link cannot retroactively un-decrypt downloads already in progress — say so).
4. Add a lint rule (or simple test) that fails if a JSX text node matches `/Loading\.{3}|Are you sure/i` outside `copy.ts`.

**What existing work it builds on**
- The trust-receipt language already defined in [docs/13_TRUST_UX_HARDENING.md](../13_TRUST_UX_HARDENING.md) and surfaced in AccessPanel.
- Existing dialog primitive [src/components/ui/dialog.tsx](../../vaultdrive_client/src/components/ui/dialog.tsx).

**What risks it avoids**
- User mistrust caused by tonal whiplash (one screen says "Are you sure?", the next says nothing).
- Future support burden ("the app didn't tell me this would happen").
- Localisation pain later — all copy is now in one indexable file.

**Expected payoff**
- The product *sounds* like one product.
- Destructive actions become safer (every confirmation states reversibility honestly).
- Future features inherit copy for free.

**Definition of done**
- [ ] `constants/copy.ts` shipped with full coverage of confirm/loading/empty surfaces.
- [ ] `grep -r "Are you sure"` in `src/` returns zero matches outside `copy.ts`.
- [ ] `grep -rE "Loading\\.{3}"` in `src/` returns zero matches outside `copy.ts`.
- [ ] One Playwright case verifies the new destructive copy renders with the correct *irreversible* flag for at least 3 distinct destructive actions.
- [ ] [docs/INDEX.md](../INDEX.md) entry added documenting the copy system.

---

### Step 3 — Unify loading / empty / error states under a `<DataState>` wrapper

**Category:** UX, architecture

**Why this step matters now**
Steps 1 and 2 give us *components* and *strings*. Step 3 gives us *the contract* that says *every list-bearing surface must declare its loading, empty, and error UI explicitly*. Right now, missing-data handling is decided per component, which is why some surfaces flash, some go blank, some show a spinner with no label, and the crypto-heavy flows feel broken when they're actually decrypting.

**What exactly should be done**
1. Add `src/components/ui/data-state.tsx`:
   ```ts
   <DataState
     loading={isLoading}
     empty={items.length === 0}
     error={error}
     loadingLabel={LOADING.decryptingPrivateKey}
     emptyConfig={EMPTY.vaultEmpty}
     onRetry={refetch}
   >
     {/* render rows */}
   </DataState>
   ```
2. Wire it through every list-bearing surface: Files explorer, AccessPanel (3 lists: file shares / folder shares / drop links), UploadLinksSection, FileRequestsSection, Groups, Agent Keys (Settings), Audit log.
3. Standardise the skeleton: shimmer rows in the row's own height, never a blank box.
4. Standardise the error path: friendly title + "Try again" button + an "open audit log" link when relevant.

**What existing work it builds on**
- Step 2 (copy.ts).
- Step 1 (`<RowActionMenu>` is what gets rendered inside the loaded state).
- Existing skeleton work documented in [docs/16_ENTERPRISE_POLISH_UX.md](../16_ENTERPRISE_POLISH_UX.md).

**What risks it avoids**
- The "is the app broken or just slow?" feeling, especially during ~1–3s crypto operations.
- Silent empty states (the user assumes the app is broken, but it's just empty).
- Inconsistent error recovery — some surfaces force a full reload, some have inline retry; with `<DataState>` it's always inline retry.

**Expected payoff**
- The whole app starts to feel *predictable*. The user learns the loading/empty/error grammar once and it works everywhere.
- Crypto-heavy flows finally tell the truth ("Decrypting your vault…" instead of a silent spinner).

**Definition of done**
- [ ] `<DataState>` shipped and unit-tested for the four states (`loading`, `empty`, `error`, `data`).
- [ ] Every list surface in `src/pages/` uses `<DataState>` — no surface still renders raw conditional `if (loading) return <Spinner/>` blocks.
- [ ] Playwright assertion: the AccessPanel shows the named-empty-state copy when the test user has zero shares, not a blank panel.
- [ ] Manual: throttle network in DevTools, observe that every list surface shows the same shimmer + label pattern.

---

### Step 4 — Onboarding hand-off: convert PIN-setup into a "first 60 seconds" flow

**Category:** UX, product

**Why this step matters now**
Onboarding currently delivers the user to a vault. It does not deliver them to *their first successful action*. The product's value (zero-knowledge upload, share, drop, request) is invisible at the moment they are most willing to try it. This is the single biggest free retention/activation lever still on the table.

**What exactly should be done**
1. After PIN setup completes (today: dismisses the banner), route the user into a *guided three-card hand-off* on the dashboard:
   - **Card A — Upload your first file** (opens the upload sheet, shows a 1-line "browser-side encrypted" caption).
   - **Card B — Share with a single click** (only enabled once Card A is done; opens `<CreateShareLinkModal>` pre-pinned to the just-uploaded file).
   - **Card C — Receive a file from someone without an account** (creates a one-shot drop link and copies it to clipboard).
2. Cards persist their done-state in localStorage (`quantixdrive-onboarding`) and dismiss together once all three are complete.
3. The dashboard exposes a "Show getting-started again" link in the empty state for users who skipped.
4. Use the trust-receipt language verbatim from [docs/13_TRUST_UX_HARDENING.md](../13_TRUST_UX_HARDENING.md): the cards explain *why* this is safe, not just *how*.

**What existing work it builds on**
- The PIN-setup banner already in `src/components/onboarding/`.
- `<CreateShareLinkModal>`, `<CreateDropLinkModal>`, the upload sheet — all exist.
- Trust copy already battle-tested on the Drop pages.

**What risks it avoids**
- Activation drop-off after PIN setup.
- The "I set up an account, now what?" moment.
- Users discovering the product's strongest features by accident only after weeks of use.

**Expected payoff**
- A new user reaches their first successful share/drop within 60 seconds, with the trust story narrated as they do it.
- The product's biggest differentiator (zero-knowledge sharing) is encountered on day one, not week three.

**Definition of done**
- [ ] Three onboarding cards rendered on dashboard for users with `onboarding.complete !== true`.
- [ ] Each card transitions to "done" only when its underlying action succeeds (upload → confirmed file in vault; share → link generated and copied; drop → link generated and copied).
- [ ] Playwright happy-path test: new user registers → sets PIN → completes all three cards → onboarding state persists across reload.
- [ ] Dashboard exposes a way to re-trigger the hand-off.
- [ ] Empty Files explorer references the same hand-off (no orphan empty states).

---

### Step 5 — Verify mobile coverage, then close the gaps

**Category:** UX, testing

**Why this step matters now**
`src/components/mobile/` exists but no recent verification report (post 2026-04-12 skin pass) confirms the mobile surfaces look right or work end-to-end. Mobile is **UNKNOWN** today — the brief says mark unknowns explicitly. Without a coverage check before any new mobile-focused work, we'd be guessing.

**What exactly should be done**
1. **Verification pass first** (do not redesign blind):
   - Run an iPhone-13 viewport pass through Login → PIN → Dashboard → Files → Share modal → AccessPanel → Settings.
   - Capture screenshots; produce `docs/29_MOBILE_VERIFICATION_2026-04-26.md`.
   - Catalogue: missing tap targets (<44px), horizontal scroll bugs, modals that exceed viewport, dropdowns that clip.
2. **Then** prioritise the gaps. Likely outcomes (predicted, not assumed):
   - Bulk action bar probably needs a sheet pattern on mobile.
   - File row dropdown probably needs a bottom sheet, not a popover.
   - Modals probably need a full-screen variant under 640px.
3. Close gaps incrementally — do not rebuild mobile from scratch.

**What existing work it builds on**
- Existing `mobile/` components.
- Step 1's `<RowActionMenu>` (it should grow a `density="compact"` and a sheet behaviour for mobile).

**What risks it avoids**
- Shipping mobile features that the team has not actually used on a phone.
- Wasted work redesigning surfaces that turn out to already work.

**Expected payoff**
- Either a confident "mobile is good" stamp or a precise punch-list, both of which beat the current ambiguity.

**Definition of done**
- [ ] `docs/29_MOBILE_VERIFICATION_2026-04-26.md` ships with screenshots and a punch-list.
- [ ] All Critical/High mobile bugs in the punch-list are fixed.
- [ ] Playwright project gains an iPhone-13 viewport job covering Login + Files + Share.

---

### Step 6 — Trust-language pass on the high-traffic surfaces (Dashboard + Files)

**Category:** product, UX

**Why this step matters now**
The product's differentiator — *the server cannot read your files* — is loud on the Drop and Access pages and quiet on the surfaces a logged-in user spends 90% of their time on (Dashboard, Files explorer). One short, consistent line per surface, woven into the existing chrome (not a banner, not a popup), keeps the trust story present without being intrusive.

**What exactly should be done**
1. Dashboard: replace the current header subtitle with a single-line trust statement that names the *current* user state (e.g. *"Your vault is locked with your PIN. The server has never seen your private key."*).
2. Files explorer header: a one-line "encrypted in your browser" tooltip on the lock icon at the top of the page (the icon is already imported).
3. Upload modal: the existing description gains the verbatim "your browser encrypts before upload" sentence used on the public drop page.
4. Share modal + Folder share modal: surface the *same* "the recipient never sends a key to us" line that AccessPanel already uses.
5. Use the verbatim copy from `constants/copy.ts` (Step 2). Do not invent new wording.

**What existing work it builds on**
- The trust receipts and language locked in [docs/13_TRUST_UX_HARDENING.md](../13_TRUST_UX_HARDENING.md).
- Step 2's `copy.ts`.

**What risks it avoids**
- The biggest product strength being *invisible* to logged-in users.
- New surfaces inventing their own crypto explanations and getting subtle facts slightly wrong.

**Expected payoff**
- Owners can see the trust story every time they use the app, not only when they create a share.
- The product's identity finally lives on its most-visited screens.

**Definition of done**
- [ ] Dashboard, Files header, Upload modal, Share modal, Folder share modal all surface a one-line trust statement.
- [ ] Every surfaced sentence is sourced from `copy.ts` (no inline strings).
- [ ] Playwright asserts presence of one canonical trust string on Dashboard and Files.
- [ ] Visual regression: trust line height/position is consistent across all 6 skins.

---

### Step 7 — Audit log → "What just happened" inline drawer

**Category:** UX, observability, trust

**Why this step matters now**
The audit log already exists ([docs/11_TRUST_API_AGENT_KEYS.md](../11_TRUST_API_AGENT_KEYS.md)) and has CSV/JSON export. But it lives on its own page, far from the moments where the user actually wants to know what happened ("did my share go through?", "did the agent really only read metadata?"). A small, contextual drawer that slides in *next to the action that produced the entry* converts the audit log from a compliance tool into a confidence tool.

**What exactly should be done**
1. Add a small "Why did this happen?" / "View receipt" affordance next to:
   - Just-completed uploads (existing toast),
   - Just-created share links (in the modal that pops the link),
   - Just-revoked links (in `<AccessPanel>`),
   - Agent key activity (in Settings),
   - Bulk delete confirmations.
2. Clicking opens a slide-over `<ActivityReceiptDrawer>` showing the relevant audit entries (filtered by `resource_id` + last 60s) with timestamps, IPs, scopes, and status.
3. Drawer is read-only and links out to the full audit page for power users.
4. Reuses the existing audit API; no new backend work.

**What existing work it builds on**
- Existing audit log + governance settings ([docs/24_SECURITY_GOVERNANCE_PRODUCTIZATION.md](../24_SECURITY_GOVERNANCE_PRODUCTIZATION.md)).
- Existing trust receipts surface — this is the inline twin of that page-level surface.
- Existing dialog/drawer primitives.

**What risks it avoids**
- Trust receipts being a *product feature in theory* but invisible at the *moment of doubt*.
- Users emailing support with "did this share go through?" when the system already has the answer one click away.

**Expected payoff**
- Confidence at the *moment the user is uncertain*, not in a separate compliance tab.
- Strong defence against "the AI agent did something weird" worries — the receipt is one click from the action.

**Definition of done**
- [ ] `<ActivityReceiptDrawer>` ships at `src/components/control-plane/`.
- [ ] Trigger affordance present on at least: post-upload, post-share-create, post-revoke, agent-key activity, bulk delete.
- [ ] Drawer queries the audit endpoint and renders entries filtered by resource and time window.
- [ ] Playwright: after creating a share, the user clicks "View receipt" and sees the matching audit entry.
- [ ] No P95 regression on share/upload/revoke flows (audit lookup is async after the action settles).

---

## 3. The 3 most urgent upgrades

| Rank | Step | Why first | Complexity | Impact |
|------|------|-----------|------------|--------|
| 🥇 | **Step 1 — `<RowActionMenu>` rollout** | Touches every screen the user spends time on. Biggest visible coherence delta per hour of work. Unlocks Steps 2, 3, 4 by giving them a stable component to compose with. | Medium | High |
| 🥈 | **Step 2 — `constants/copy.ts`** | Cheapest possible "feels like one product" change. Should ride on the same PR as Step 1 because Step 1 reveals every place a destructive confirmation lives. | Low | High |
| 🥉 | **Step 3 — `<DataState>` wrapper** | Closes the "is it broken or just slow?" loop that hurts the crypto-heavy flows the most. Cheap to implement once Steps 1 + 2 are in. | Low–Medium | High |

These three together are the **fastest path to "undeniable progress"** because they raise the floor on every single screen at once.

---

## 4. The 2 upgrades with biggest long-term strategic value

| Step | Why it compounds | What it unlocks |
|------|------------------|------------------|
| **Step 4 — Onboarding hand-off** | Every new user encounters the product's strongest features on day 1. The compounding is on the *user side*: a user who has shared once will share again. A user who never shared will assume the product is "just storage". | Sets up real activation metrics; sets up the foundation for a future template gallery (drop templates, share templates) without further onboarding work. |
| **Step 7 — Activity Receipt drawer** | Receipts are QuantiX Drive's defining concept. Putting them at the moment of doubt (rather than on a separate page) compounds trust *every time the user takes an action that mattered to them*. | Sets up the foundation for agent-action transparency at scale (any future agent integration can drop receipts into the same drawer with no UI changes). It's the surface where the product's identity lives long-term. |

---

## 5. What NOT to do yet

1. **Do not add a new feature domain** (calendar, tasks, comments, chat, e-signatures, mobile native app). The atoms are not yet coherent — adding new atoms widens the gap.
2. **Do not rebuild the file explorer.** [docs/03_VAULT_EXPLORER.md](../03_VAULT_EXPLORER.md) and [docs/07_FILES_EXPLORER_BULK_SELECTION.md](../07_FILES_EXPLORER_BULK_SELECTION.md) shipped real, hardened explorer behaviour. Rewriting it is scope creep masquerading as polish.
3. **Do not introduce a new state library** (Redux, Zustand, Recoil, etc.). The existing context (`SessionVaultContext`) is sufficient and already passes E2E. Migrating now would burn weeks for zero user-visible value.
4. **Do not begin localisation** until `copy.ts` (Step 2) lands. Localising scattered hardcoded strings is wasted work; localising one indexed map is straightforward.
5. **Do not over-polish the skins** beyond bug-fix level. The 6-skin system is already a delight feature — adding a 7th skin or tweaking palettes does not move the user-facing needle today.

---

## 6. Recommended execution order

1. **Quick win / coherence pass (combined PR)**
   1. Step 1 — `<RowActionMenu>` shipped + adopted on Files + AccessPanel first.
   2. Step 2 — `constants/copy.ts` shipped at the same time, populated by every string Step 1 touches.
2. **Flow hardening**
   3. Step 3 — `<DataState>` wrapper, rolled out across all list surfaces.
   4. Step 6 — Trust-language pass on Dashboard + Files (small, low-risk; ride on top of Step 2).
3. **Testing**
   5. Add Playwright cases for: row-action menus per surface, destructive copy correctness, `<DataState>` empty/error paths, Dashboard trust line.
4. **Documentation / memory update**
   6. Update [docs/INDEX.md](../INDEX.md) with three new entries (RowActionMenu, copy system, DataState).
   7. Write `SESSION_MEMORY_2026-XX-XX-coherence-pass.md` capturing what changed and what stayed verifiably green.
   8. Save a memory entry under `~/.claude/projects/-lamp-www-QuantiX-Drive/memory/` for the coherence convention so future sessions reuse the same patterns.
5. **Commit strategy**
   9. One PR per step. Each PR contains: implementation, copy entries, Playwright additions, doc update.
   10. Step 4 (onboarding hand-off), Step 5 (mobile verification), Step 7 (activity drawer) are *separate* feature PRs *after* the coherence pass lands. They benefit from the new primitives.

---

## 7. Final summary

QuantiX Drive is past the "does it work?" phase. The crypto, the sharing, the trust receipts, the agent keys, the governance, the test harness — all green, all hardened, all documented. The next layer is **coherence**: making the product *feel* like one product to a real, unassisted user.

The 7-step roadmap is deliberately concentrated on **shared primitives** (row menus, copy constants, data states, trust language) and **moments of truth** (onboarding hand-off, activity receipts at the point of action) rather than on new feature domains. Every step builds on what already exists. None of the steps requires a backend change of consequence. The frontend stays inside the same architecture, components compound, and each upgrade makes the next one cheaper.

If we ship Steps 1–3 in a single coherent pass, the product will feel measurably calmer the next morning. If we then layer Step 4 and Step 7, the product gains its soul — a user who can self-serve from "I just signed up" to "I just shared something I trust" without ever asking the builder for help. That is the definition of *undeniable*.

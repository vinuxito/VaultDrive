# ABRN Drive Next-Level Upgrade Roadmap

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Move ABRN Drive from a verified trust-first internal control plane to a more durable, sellable, and operationally undeniable platform without weakening the one-PIN doctrine or the zero-knowledge boundary.

**Architecture:** The roadmap deliberately compounds the strongest existing assets instead of opening new random feature branches. ABRN Drive is already differentiated where trust, collection, and delegation intersect: one-PIN owner trust, trust surfaces, Secure Drop / File Requests / public sharing, and the ciphertext-first API/agent plane. The next phase should therefore lock in proof, close operational trust gaps, unify control, and productize the collection and integration surfaces already in the repo.

**Tech Stack:** Go, React 19, TypeScript, PostgreSQL, Apache, Vite, Vitest, Playwright, Goose, sqlc

---

## Current Strongest Areas

### 1. One-PIN trust is a real product law

- Grounded in `docs/12_ONE_PIN_TRUST_FLOW.md`, `vaultdrive_client/src/components/onboarding/OnboardingWizard.tsx`, `vaultdrive_client/src/components/layout/dashboard-layout.tsx`, `vaultdrive_client/src/utils/pin-trust.ts`, `vaultdrive_client/src/utils/pin-enrollment.ts`, and `vaultdrive_client/src/utils/shared-session.ts`.
- This is the product's clearest moat: the PIN is not a narrow auth detail, it is the stable owner trust key used across normal protected work.

### 2. Trust UI has become differentiated

- Grounded in `vaultdrive_client/src/components/vault/TrustRail.tsx`, `vaultdrive_client/src/components/vault/FileSecurityTimeline.tsx`, `vaultdrive_client/src/components/vault/AccessPanel.tsx`, `vaultdrive_client/src/components/vault/FilePreviewModal.tsx`, `vaultdrive_client/src/pages/settings.tsx`, and `docs/13_TRUST_UX_HARDENING.md`.
- The trust story is now readable, calm, and product-like rather than purely technical.

### 3. Inbound collection already has real shape

- Grounded in `handle_drop.go`, `handle_file_requests.go`, `vaultdrive_client/src/pages/drop-upload.tsx`, `vaultdrive_client/src/pages/FileRequestPage.tsx`, `vaultdrive_client/src/components/upload/UploadLinksSection.tsx`, and `vaultdrive_client/src/components/vault/FileRequestsSection.tsx`.
- Secure Drop, File Requests, and public share are already solid primitives for a serious client-document workflow product.

### 4. The agent/control-plane foundation is already there

- Grounded in `middleware_actor.go`, `agent_api_keys.go`, `handle_v1_core.go`, `audit.go`, `vaultdrive_client/src/components/settings/AgentApiKeysSection.tsx`, and `docs/11_TRUST_API_AGENT_KEYS.md`.
- The API v1 + scoped agent key layer is not speculative; it is already a real differentiator.

---

## Most Dangerous Weak Spots / Blind Spots

### 1. The trust model is proven, but the proof is not yet codified

- Browser verification currently depends on temporary Playwright scripts and session notes, not a committed e2e suite.
- The strongest claims in the product still rely too much on manual ritual.

### 2. Operational trust gaps still exist around auth and deploy safety

- `vaultdrive_client/src/components/protected-route.tsx` still treats token presence as authenticated UI state.
- `handle_events.go` accepts JWT in the URL for SSE.
- deploy workflows do not yet act like hard release gates.

### 3. Access governance is powerful but fragmented

- Shares, file requests, upload routes, direct shares, group visibility, and agent keys are all understandable individually but not yet unified into a single control experience.

### 4. The app is getting heavier while the shell is getting more ambitious

- `vaultdrive_client/vite.config.ts` already has manual chunking, but the build still warns.
- Premium calm will erode quickly if shell and control surfaces continue to grow without performance budgets.

### 5. Commercialization is latent, not fully productized

- The repo already contains branded sender surfaces, organization naming, route control, audit, and agent keys.
- What is missing is packaging: templates, governance exports, reusable workflows, and integration kits.

---

## 7-Step Upgrade Roadmap

### Step 1 - Commit The Trust Proof Harness

**Category:** developer experience

**Why this step matters now**

ABRN's moat is not just that the trust model exists; it is that the trust model can be proven. Right now the repo has good unit coverage and verified smoke flows, but the strongest product claims still are not continuously enforced in-repo.

**What exactly should be done**

- Commit a real Playwright/e2e suite for:
  - fresh signup -> password login -> onboarding -> PIN setup -> vault entry
  - PIN login
  - Secure Drop sender flow
  - File Request sender flow
  - public share open/download flow
  - one shared-file recipient flow
  - one agent-key lifecycle smoke flow
- Move current ephemeral smoke knowledge into `tests/e2e/`.
- Add CI execution, screenshots, traces, and deterministic seed/setup helpers.

**What existing work it builds on**

- `docs/12_ONE_PIN_TRUST_FLOW.md`
- `docs/14_VISUAL_REFINEMENT_VERIFICATION.md`
- current Vitest coverage in `vaultdrive_client/src/utils/*.test.ts`
- existing local browser smoke path already proven on `http://localhost:8082/abrn/`

**What risks it avoids**

- shipping trust regressions silently
- docs drifting away from executable reality
- every future feature becoming a trust gamble

**Expected payoff**

- Every later step becomes safer and faster.
- The product's strongest claims become continuously provable.

**Definition of done**

- committed e2e tests exist in the repo
- CI runs them on protected branches
- traces/screenshots are generated on failure
- owner and sender core flows pass without manual setup beyond test fixtures

### Step 2 - Close The Auth, Session, And Deploy Safety Gaps

**Category:** security

**Why this step matters now**

The cryptographic model is strong, but a few operational edges are still weaker than the product's own trust posture. Fixing them now protects the momentum you already have.

**What exactly should be done**

- Harden `vaultdrive_client/src/components/protected-route.tsx` so UI auth is not based on token presence alone.
- Replace query-string SSE bearer auth in `handle_events.go` with a less log-exposed mechanism.
- Shorten JWT lifetime in `handle_login.go` and finish the refresh-token path cleanly.
- Add rate limiting around password login and sensitive auth edges in `main.go`.
- Add real test gates to `.github/workflows/backend-deploy.yml` and `.github/workflows/azure-static-web-apps-proud-dune-0024f9810.yml`.

**What existing work it builds on**

- one-PIN flow hardening already done
- `middleware_actor.go` and current auth structure
- current verified browser/login flows

**What risks it avoids**

- broken authenticated UI states
- bearer-token exposure in logs
- regressions shipping without guardrails
- brute-force or long-lived-session risk growing with adoption

**Expected payoff**

- The product's operational trust story catches up to the trust UX and cryptography story.

**Definition of done**

- protected routes validate or refresh auth meaningfully
- deploy pipelines fail on test/build regression
- SSE auth no longer relies on URL-borne long-lived bearer tokens
- auth-sensitive routes have rate-limit coverage

### Step 3 - Ship The Compliance-Grade Audit And Governance Layer

**Category:** commercialization

**Why this step matters now**

ABRN Asesores is a document-heavy professional-services environment. Intake workflows get much more credible when the audit/reporting layer is ready before or alongside the workflow productization itself.

**What exactly should be done**

- Add exportable audit reports (CSV / JSON, possibly PDF later).
- Add date-range, actor, route-type, and resource filters to the audit surface.
- Add dashboard-level anomaly summaries (stale links, stale keys, repeated failed access, expiring routes).
- Add retention/governance settings for audit visibility and export scope.

**What existing work it builds on**

- `audit.go`
- `/api/v1/audit`
- `vaultdrive_client/src/components/settings/AuditLogSection.tsx`
- trust timeline and access metadata already present

**What risks it avoids**

- intake workflows appearing useful but not governable
- credibility gaps with serious clients or regulated document handling
- audit becoming a raw event store instead of a product surface

**Expected payoff**

- Stronger enterprise/professional-services trust.
- A more credible "control plane" story for buyers and internal stakeholders.

**Definition of done**

- audit reports can be exported meaningfully
- audit filtering is usable for real review workflows
- dashboard surfaces at least one anomaly/governance summary card

### Step 4 - Build A Unified Outside Access Center + Vault Search

**Category:** product

**Why this step matters now**

The product promise is "all access visible and revocable." The repo already has the primitives, but they are spread across multiple surfaces. This step turns a strong capability into an unmistakable product story. It also adds the practical search layer that a document-heavy workflow will need before multi-tenant ambitions matter.

**What exactly should be done**

- Create a dedicated owner-facing surface that unifies:
  - public share links
  - direct shares
  - group exposure
  - upload routes / Secure Drop links
  - file requests
  - agent keys
- Add state filters for active / expired / revoked / stale / never-used.
- Add PostgreSQL-backed search for filename and key metadata paths so owners can find routes/files quickly across larger vaults.
- Design this surface so future service-account onboarding can plug into it cleanly later.

**What existing work it builds on**

- `vaultdrive_client/src/components/vault/AccessPanel.tsx`
- `vaultdrive_client/src/components/settings/AgentApiKeysSection.tsx`
- `vaultdrive_client/src/components/upload/UploadLinksSection.tsx`
- `vaultdrive_client/src/components/vault/FileRequestsSection.tsx`
- `GET /api/v1/files/{id}/access-summary`
- `GET /api/v1/agent-keys`
- `GET /api/v1/file-requests`
- `GET /api/v1/files?q=` foundation already documented in README

**What risks it avoids**

- fragmented access governance
- users losing confidence because control exists but is cognitively scattered
- search pain becoming the next quiet bottleneck

**Expected payoff**

- Biggest visible product leap in the shortest time.
- A much clearer "outside access is governed here" control-plane identity.

**Definition of done**

- one dedicated outside-access center exists
- major external access types can be reviewed and revoked there
- search works across meaningful vault/access metadata
- the surface has obvious extension points for future integration/service-account work

### Step 5 - Productize Client Collection Workflows

**Category:** product

**Why this step matters now**

Secure Drop and File Requests are already some of the most commercially promising parts of the repo. The next logical move is to turn them from strong primitives into repeatable client workflows.

**What exactly should be done**

- Add reusable request/upload templates.
- Add branded collection variants using the existing owner/org identity surfaces.
- Add required-document checklists, route instructions, and clear workflow states.
- Bind collection routes to business workflows, not just folders.
- Add intake analytics such as created, opened, uploaded, completed, revoked.

**What existing work it builds on**

- `handle_drop.go`
- `handle_file_requests.go`
- `vaultdrive_client/src/pages/drop-upload.tsx`
- `vaultdrive_client/src/pages/FileRequestPage.tsx`
- organization naming in `vaultdrive_client/src/pages/settings.tsx`

**What risks it avoids**

- under-productizing the most client-visible feature family already built
- adding unrelated collaboration noise instead of deepening a high-signal use case

**Expected payoff**

- Stronger client-facing maturity.
- Better path from internal tool to reusable document-intake product.

**Definition of done**

- owners can create reusable branded collection workflows
- sender pages reflect workflow context, not just generic routes
- owners can track workflow completion state in-app

### Step 6 - Finish The Performance And Shell Scalability Pass

**Category:** scalability

**Why this step matters now**

The shell is richer, the trust surfaces are denser, and the bundle warning is already a known recurring debt. This step keeps the premium feel from being undermined by weight and latency.

**What exactly should be done**

- Add route-level lazy loading for heavy authenticated pages and complex modals.
- Split the main bundle further beyond current `manualChunks`.
- Profile `files.tsx`, settings, trust components, and larger list surfaces.
- Improve list scalability where vault contents, audit entries, and route inventories will grow.
- Tighten SSE and background UI work so always-on shell features stay lightweight.

**What existing work it builds on**

- `vaultdrive_client/vite.config.ts`
- trust UX cleanup already done
- current chunk split foundation already in place

**What risks it avoids**

- premium-feeling UI being betrayed by sluggish load behavior
- mobile and low-bandwidth usage falling behind
- future feature work compounding a slow shell

**Expected payoff**

- Faster perceived product quality and more room for later roadmap steps.

**Definition of done**

- the build warning is materially reduced or eliminated
- route transitions and first loads improve measurably
- large list surfaces stay responsive under realistic data volume

### Step 7 - Ship The Agent Integration Kit

**Category:** commercialization

**Why this step matters now**

ABRN already has the control-plane backend and the scoped key model. What it lacks is packaging. Without that, the agent story stays technically impressive but commercially underused.

**What exactly should be done**

- Create an official SDK or CLI for API v1.
- Add scope presets for common external jobs.
- Add webhook/event delivery for key lifecycle, route, and file events.
- Add sample integrations that demonstrate the ciphertext-first model in real use.
- Improve onboarding for service-like external systems using the existing key scope model.

**What existing work it builds on**

- `middleware_actor.go`
- `agent_api_keys.go`
- `handle_v1_core.go`
- `audit.go`
- `docs/11_TRUST_API_AGENT_KEYS.md`

**What risks it avoids**

- the API/agent plane remaining a hidden internal superpower
- external integrations becoming bespoke one-offs every time

**Expected payoff**

- Stronger developer adoption.
- A clearer partner and automation story.
- A more visible commercialization path for the sovereign control-plane idea.

**Definition of done**

- SDK/CLI exists in-repo with docs and examples
- webhooks or event subscriptions work for major lifecycle events
- at least one sample integration proves the developer story end-to-end

---

## If The Goal Is Fast Undeniable Progress

Start with:

1. **Step 1 - Commit The Trust Proof Harness**
2. **Step 2 - Close The Auth, Session, And Deploy Safety Gaps**
3. **Step 4 - Build A Unified Outside Access Center + Vault Search**

If the near-term buyer pressure is compliance-heavy, move **Step 3** ahead of **Step 4**.

---

## Recommended Sequence

1. Trust Proof Automation
2. Auth / Session / Deploy Hardening
3. Compliance-grade Audit & Governance
4. Unified Outside Access Center + Vault Search
5. Client Collection Workflow Productization
6. Performance & Shell Scalability
7. Agent Integration Kit

---

## Not In This 7-Step Plan (On Purpose)

- Full multi-tenant/workspace re-architecture is intentionally deferred.
- It may become necessary later, but relative to the current repo state it is a higher-YAGNI move than proof, hardening, governance, control unification, intake productization, and the agent kit.

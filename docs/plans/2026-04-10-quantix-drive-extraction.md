# QuantiX-Drive Extraction Plan

**Date:** 2026-04-10
**Author:** Session with Claude
**Base branch:** `gnhf/make-sure-we-can-upl-56c5d2` (ABRN-Drive)
**Go module (current):** `github.com/vinuxito/VaultDrive`

---

## Objective

Extract the current ABRN-Drive codebase into a generic product called **QuantiX-Drive** that
becomes the canonical upstream. ABRN-Drive is reclassified as a **branded customer deployment**
that tracks QuantiX-Drive and receives every upstream upgrade automatically.

**Mental model:**

```
 QuantiX-Drive  (upstream — generic product, where dev happens)
       │
       ▼   upstream-sync (periodic merge/rebase)
 ABRN-Drive    (downstream — ABRN branding, ABRN config, ABRN deploy targets)
```

New feature → commit to QuantiX-Drive → ABRN-Drive pulls it via `git merge upstream/main`.
No feature work ever happens directly on ABRN-Drive.

---

## Strategic Options Considered

### Option A — Hard fork (two separate repos, no git relationship)
- ABRN-Drive and QuantiX-Drive each have their own history
- Changes propagate by cherry-pick or patch files
- **Pros:** Simplest mental model, zero risk of cross-contamination
- **Cons:** Every upstream change needs manual replay. Divergence guaranteed within weeks. Rejected.

### Option B — Git upstream-downstream (two repos, git-tracked relationship) ⭐ RECOMMENDED
- QuantiX-Drive lives in a new repo (e.g. `github.com/vinuxito/QuantiX-Drive`)
- ABRN-Drive adds QuantiX-Drive as a git remote named `upstream`
- ABRN-Drive's `main` branch carries only ABRN-specific overrides (branding, config, deploy keys)
- Upstream syncs happen with `git fetch upstream && git merge upstream/main`
- **Pros:** Native git workflow. Automatic propagation of upstream work. Conflict surface is limited to the ABRN override files. Industry-standard (Linux distros, Odoo enterprise, etc.)
- **Cons:** Merge conflicts possible if ABRN overrides and upstream touch the same lines — but Phase 1 exists precisely to minimize this surface.

### Option C — Single repo with customer profiles (monorepo with build-time config)
- One repo, one codebase. Customer branding/config selected by env var at build time.
- **Pros:** Zero merge cost. Single source of truth.
- **Cons:** ABRN-Drive is the only customer today. Adding a "customer dir" now is speculative. Doesn't match the user's stated intent ("QuantiX-Drive is going to become the main origin"). If a second customer shows up, Phase 1 of Option B converges naturally to this anyway.

### Recommendation: **Option B** (upstream/downstream via git remotes)

This matches the user's stated mental model. The cost of the split is paid once (Phase 2). After
that, day-to-day feature work happens only in QuantiX-Drive. ABRN-Drive becomes a thin overlay.

---

## Reconnaissance: What is ABRN-Specific Today?

### Backend (Go + SQL) — 8 files

| File | What's hardcoded | Category |
|------|------------------|----------|
| `agent_api_keys.go:13` | `const agentAPIKeyPrefix = "abrn_ak"` | Product key prefix |
| `handle_drop.go:730` | `/abrn/drop/%s#key=%s` URL prefix | Base path |
| `handle_drop.go:808` | `/abrn/drop/%s` URL prefix | Base path |
| `handle_file_requests.go:40` | `/abrn/request/%s` URL prefix | Base path |
| `handle_file_star.go` | `/abrn/...` references | Base path |
| `handle_group_update.go` | `/abrn/...` references | Base path |
| `main.go:37` | CORS `https://abrndrive.filemonprime.net,https://dev-app.filemonprime.net,...` | CORS allowlist |
| `main.go:462-479` | `/abrn/` base-path redirect + static serving | Base path |
| `sql/schema/017_add_admin_role.sql` | `UPDATE users SET is_admin=TRUE WHERE email='filemon@abrn.mx'` | Admin bootstrap |
| `sql/schema/035_add_vcazares_admin.sql` | `UPDATE users SET is_admin=TRUE WHERE email='v.cazares@abrn.mx'` | Admin bootstrap |

### Frontend (TS/TSX) — 48 files

Hot spots:
- `components/branding/abrn-logo.tsx` — the logo component
- `components/branding/landing-footer.tsx` — the copyright footer
- `components/branding/index.ts` — barrel export
- `components/layout/*` (sidebar, dashboard-layout, mobile-nav, bottom-nav) — product name in navigation chrome
- `components/navbar.tsx` — top navbar branding
- `pages/home.tsx`, `pages/login.tsx`, `pages/about.tsx` — landing copy
- `pages/settings.tsx`, `pages/groups.tsx`, `pages/admin-tests.tsx` — product-name strings in headings
- Most vault/upload/settings components mention "ABRN Drive" in section labels

### Deploy + infra

| Resource | Current value | Abstraction |
|----------|---------------|-------------|
| Azure Static Web Apps workflow | `azure-static-web-apps-proud-dune-0024f9810.yml` | ABRN-specific deploy target |
| Backend deploy workflow | `backend-deploy.yml` (Docker → ABRN infra) | ABRN-specific |
| Production domain | `abrndrive.filemonprime.net` | ABRN-specific |
| Dev domain | `dev-app.filemonprime.net` | ABRN-specific |
| Base path (served under) | `/abrn/` | ABRN-specific |

### Already generic (no change needed)
- Go module name is `github.com/vinuxito/VaultDrive` — already renamed off `Pranay0205` in this session
- Component names: `FileRequestsSection`, `UploadLinksSection`, `VaultItem`, etc. — neutral
- Crypto, SSE, governance, rate limiting, collection templates — all domain-generic
- Directory names (`vaultdrive_client`, `sql/schema/`, top-level Go files) — already "VaultDrive", not "ABRN"

---

## Phased Implementation Plan

### Phase 0 — Decisions (blocks everything else)

Open questions for the user (see end of document). Pin these answers before Phase 1.

### Phase 1 — Make current code customer-agnostic (stays on ABRN-Drive branch)

**Goal:** Before the split, strip every ABRN-ism out of the codebase and replace it with
config-driven behavior. After Phase 1, ABRN-Drive still builds and behaves identically, but
no longer *contains* the string "abrn" anywhere except in the config file(s) it reads at runtime.

This phase has the highest line-change count but the lowest architectural risk — it's pure
refactoring, no new features.

#### 1.1 Backend config surface

Create `config.go` (or extend `ApiConfig`) with these env-driven fields:

```go
type ProductConfig struct {
    Name            string   // "QuantiX Drive" | "ABRN Drive"
    Slug            string   // "quantix" | "abrn"
    BasePath        string   // "/quantix/" | "/abrn/"
    AgentKeyPrefix  string   // "qx_ak" | "abrn_ak"
    PublicBaseURL   string   // "https://app.quantixdrive.io" | "https://abrndrive.filemonprime.net"
    CORSOrigins     []string // from env
    AdminBootstrap  []string // emails, from env
}
```

Env vars (read at startup, validated, fail-fast if missing):
- `PRODUCT_NAME`
- `PRODUCT_SLUG`
- `BASE_PATH`
- `AGENT_KEY_PREFIX`
- `PUBLIC_BASE_URL`
- `CORS_ALLOWED_ORIGINS` (comma-separated)
- `ADMIN_BOOTSTRAP_EMAILS` (comma-separated, optional)

#### 1.2 Replace hardcoded `/abrn/` base path

Every `/abrn/drop/...`, `/abrn/request/...` literal in Go becomes `cfg.Product.BasePath + "drop/..."`.

Affected files:
- `handle_drop.go` (2 call sites)
- `handle_file_requests.go` (1 call site)
- `handle_file_star.go`
- `handle_group_update.go`
- `main.go` — base path redirect + static serving logic uses `cfg.Product.BasePath`

#### 1.3 Replace `agentAPIKeyPrefix` constant

`agent_api_keys.go:13` → read from `cfg.Product.AgentKeyPrefix`. Existing keys in the DB keep
working because the DB stores the full key including its prefix; only new keys inherit the
new prefix.

#### 1.4 Replace CORS allowlist

`main.go:37` — read from `CORS_ALLOWED_ORIGINS` env var, split on comma.

#### 1.5 Admin bootstrap migration pattern

The existing hardcoded migrations `017_add_admin_role.sql` and `035_add_vcazares_admin.sql`
cannot be deleted (they are already applied to production and are part of history). Options:

- **Leave 017 and 035 as-is** (they're frozen history; changing them breaks migration hashes)
- **Add a new migration 045** that is a no-op for ABRN but becomes the mechanism for new
  QuantiX-Drive deployments: instead of writing SQL for each customer, the Go server reads
  `ADMIN_BOOTSTRAP_EMAILS` at startup and runs `UPDATE users SET is_admin=TRUE WHERE email = ANY($1)`
  idempotently on boot (after migrations complete).

Decision: **Leave 017/035 untouched. Implement startup bootstrap hook.**

#### 1.6 Frontend config surface

Add `vaultdrive_client/src/config/branding.ts`:

```ts
export interface BrandingConfig {
  productName: string;       // "QuantiX Drive"
  productShortName: string;  // "QuantiX"
  companyName: string;       // "ABRN" or "QuantiX Labs"
  logoComponent: "quantix" | "abrn" | "generic";
  primaryColor: string;      // hex
  accentColor: string;       // hex
  supportEmail: string;
  landingTagline: string;
  copyrightNotice: string;
}

const config: BrandingConfig = {
  productName: import.meta.env.VITE_PRODUCT_NAME ?? "QuantiX Drive",
  // ... etc
};
export default config;
```

- Replace every literal `"ABRN Drive"` / `"ABRN"` in the 48 frontend files with
  `branding.productName` / `branding.companyName`.
- `components/branding/abrn-logo.tsx` stays, but becomes one of several logo components
  selected by `branding.logoComponent`. Ship with `abrn-logo.tsx` and a new `quantix-logo.tsx`.
- `components/branding/index.ts` exports a `<BrandLogo />` component that picks from
  `branding.logoComponent`.

#### 1.7 Frontend env vars

Add to `.env.example`:
```
VITE_PRODUCT_NAME="QuantiX Drive"
VITE_PRODUCT_SHORT_NAME="QuantiX"
VITE_COMPANY_NAME="QuantiX Labs"
VITE_LOGO=quantix
VITE_PRIMARY_COLOR="#7a1f2b"
VITE_SUPPORT_EMAIL="support@quantixdrive.io"
VITE_API_BASE_PATH="/quantix/"
VITE_LANDING_TAGLINE="Zero-knowledge file vault"
VITE_COPYRIGHT="© QuantiX Labs"
```

Keep `vaultdrive_client/.env.abrn` with the ABRN overrides:
```
VITE_PRODUCT_NAME="ABRN Drive"
VITE_COMPANY_NAME="ABRN"
VITE_LOGO=abrn
VITE_API_BASE_PATH="/abrn/"
VITE_COPYRIGHT="© ABRN"
# ...
```

Build with `cp .env.abrn .env.local && npm run build` for ABRN deploys.

#### 1.8 Verification gate for Phase 1

Before merging Phase 1:
- [ ] `grep -rn "abrn\|ABRN" --include="*.go" .` returns **only** `.env.example`, comments, migration files (017/035), and test fixtures
- [ ] `grep -rn "abrn\|ABRN" vaultdrive_client/src/ --exclude-dir=__tests__` returns **only** `config/branding.ts` and `abrn-logo.tsx`
- [ ] `go build ./...` + `go vet ./...` clean
- [ ] `npx tsc --noEmit` clean, `npx vitest run` green (66/66)
- [ ] Running locally with `VITE_LOGO=quantix VITE_PRODUCT_NAME="QuantiX Drive" npm run dev` shows a fully unbranded-for-ABRN UI
- [ ] Running locally with the `.env.abrn` overrides shows the current ABRN UI byte-for-byte

Phase 1 ships as a PR on the ABRN-Drive repo titled `refactor: config-driven branding for upstream extraction`.

### Phase 2 — Create the QuantiX-Drive repo

With Phase 1 merged, the split becomes trivial.

#### 2.1 Decide product name + repo location

Blocked by Phase 0 question "Target product name exactly?" and "Where does QuantiX-Drive repo live?"

Working assumption: `github.com/vinuxito/QuantiX-Drive`, Go module
`github.com/vinuxito/QuantiXDrive` (Go convention: no hyphens in import paths, but the GitHub
repo name can have them).

#### 2.2 Mirror current ABRN-Drive history into the new repo

```bash
# On a clean working copy
git clone /lamp/www/ABRN-Drive /tmp/quantix-drive-seed
cd /tmp/quantix-drive-seed
git remote rename origin abrn-origin
git remote add origin git@github.com:vinuxito/QuantiX-Drive.git
```

**Decision needed:** preserve history or squash?

- **Preserve history:** fastest, keeps `git blame` working. Downside: the repo history openly
  shows "ABRN" references in old commits. Acceptable if the repo is private.
- **Squash to a single `init: quantix-drive extracted from ABRN-Drive` commit:** cleaner but loses blame.

Recommendation: **preserve history** (private repo, blame is valuable).

#### 2.3 Flip defaults to QuantiX in Phase-1 config files

On the new QuantiX-Drive repo's main branch (and only there):
- `.env.example` → `PRODUCT_NAME="QuantiX Drive"`, `BASE_PATH="/quantix/"`, `AGENT_KEY_PREFIX="qx_ak"`, etc.
- `vaultdrive_client/.env.example` → same
- Add a generic `quantix-logo.tsx` component
- Update `README.md` to describe QuantiX-Drive, not ABRN-Drive
- Remove `.env.abrn` (it belongs to the ABRN deployment, not the upstream product)
- Remove ABRN-specific deploy workflows (`azure-static-web-apps-proud-dune-0024f9810.yml`, domain-specific CORS defaults). Add a generic Docker Compose and a deploy-target-agnostic CI workflow (build + test + publish Docker image to GHCR).

#### 2.4 Optional: rename Go module

If we want the module to read `github.com/vinuxito/QuantiXDrive`:

```bash
go mod edit -module github.com/vinuxito/QuantiXDrive
grep -rl "github.com/vinuxito/VaultDrive" . | xargs sed -i 's|github.com/vinuxito/VaultDrive|github.com/vinuxito/QuantiXDrive|g'
go mod tidy
go build ./...
```

**Decision needed:** rename module or keep `VaultDrive`?

Recommendation: **keep `github.com/vinuxito/VaultDrive`**. The Go module name is already generic
(it was renamed from `Pranay0205` earlier today). Renaming again would touch 41 files for cosmetic
reasons. The product name is QuantiX Drive; the code engine is VaultDrive. Think: "QuantiX Drive
is powered by the VaultDrive engine." This is a common pattern (e.g. Supabase is powered by PostgREST).

#### 2.5 Push to new remote

```bash
cd /tmp/quantix-drive-seed
git push -u origin main
git push origin --tags
```

#### 2.6 Phase 2 verification gate

- [ ] New repo builds green (`go build`, `go vet`, `go test -race`, `npx vitest run`, `npm run build`)
- [ ] New repo's `.env.example` contains no ABRN references
- [ ] New repo's `README.md` describes QuantiX-Drive
- [ ] CI pipeline on the new repo runs and stays green

### Phase 3 — Turn ABRN-Drive into a downstream of QuantiX-Drive

The goal: ABRN-Drive's main branch is the QuantiX-Drive main branch + a small, stable
set of ABRN-specific override files (env, branding assets, deploy workflows).

#### 3.1 Add upstream remote to ABRN-Drive

```bash
cd /lamp/www/ABRN-Drive
git remote add upstream git@github.com:vinuxito/QuantiX-Drive.git
git fetch upstream
```

#### 3.2 Rebase ABRN-Drive onto QuantiX-Drive

The commits on ABRN-Drive's `main` are already identical to QuantiX-Drive's `main` (because
Phase 2 was just a copy). The divergence starts *now*:

- Create branch `abrn/overlay` from `main`
- Add only ABRN-specific files:
  - `vaultdrive_client/.env.abrn` (or `.env.local` at deploy time — see below)
  - `.github/workflows/azure-static-web-apps-proud-dune-0024f9810.yml`
  - `.github/workflows/backend-deploy.yml` (if it has ABRN-specific Azure secrets)
  - `deploy/abrn/` directory with Docker Compose override and secrets templates
- Remove files that only belong upstream (none expected after Phase 1)
- Commit as `chore: ABRN-specific overrides on top of QuantiX-Drive upstream`

#### 3.3 Document the sync workflow

Add `docs/UPSTREAM_SYNC.md` to ABRN-Drive:

```markdown
# Syncing ABRN-Drive from QuantiX-Drive upstream

## Routine sync (every Monday or before each ABRN release)

    git fetch upstream
    git checkout main
    git merge upstream/main
    # If conflicts: only the ABRN override files should ever conflict.
    # Resolve by keeping ABRN overrides intact.
    git push origin main

## Adding new features

New features MUST be developed on the QuantiX-Drive repo (the upstream), NOT on ABRN-Drive.
Workflow:

1. Clone QuantiX-Drive
2. Create feature branch
3. Implement, test, PR, merge to QuantiX-Drive/main
4. On ABRN-Drive, run the sync steps above
5. Deploy ABRN-Drive to Azure
```

#### 3.4 Phase 3 verification gate

- [ ] `git diff upstream/main main` on ABRN-Drive shows only override files (no source-code edits)
- [ ] ABRN-Drive builds and deploys to Azure with ABRN branding intact
- [ ] QuantiX-Drive still builds independently
- [ ] A test upstream change (e.g. a typo fix on QuantiX-Drive) merges cleanly into ABRN-Drive

### Phase 4 — End-to-end verification

- [ ] Deploy QuantiX-Drive locally (`docker compose up`) under `/quantix/` base path — confirm branding is generic
- [ ] Deploy ABRN-Drive locally — confirm burgundy ABRN branding
- [ ] Generate a fake upstream commit on QuantiX-Drive (e.g. adjust a copy string)
- [ ] Sync ABRN-Drive: `git fetch upstream && git merge upstream/main`
- [ ] Verify the change is present on ABRN-Drive, deploy-ready
- [ ] All automated tests green on both repos

### Phase 5 — Production migration

- [ ] Update ABRN production deploy pipelines to pull from the new ABRN-Drive repo (unchanged if the repo stays at the same origin; only `upstream` remote is new)
- [ ] Update documentation (README.md on both repos)
- [ ] Announce the split in a team doc
- [ ] Archive old planning docs that are ABRN-specific but live in the shared codebase (move to `deploy/abrn/docs/`)

---

## Risks and Mitigations

| Risk | Severity | Mitigation |
|------|----------|------------|
| Phase 1 refactor introduces a bug that only shows under specific env config | High | Run full test suite under both `.env.abrn` and QuantiX defaults before merging Phase 1. Add a CI matrix run. |
| `agent_api_keys.go` prefix change breaks existing ABRN API keys | High | Existing DB-stored keys still contain their original `abrn_ak` prefix; validation logic must accept ANY prefix in the DB (full-string match) and only use the config prefix for NEW keys. Audit `agent_api_keys.go` lookup path carefully. |
| Migration 017/035 mentions ABRN emails and becomes history-frozen in the upstream QuantiX repo | Low | Leave them frozen. Squash-from-history is not worth it. Document that early migrations are historical ABRN-era artifacts. |
| Upstream sync conflicts pile up if ABRN-Drive drifts | Medium | Strict rule: NO feature work on ABRN-Drive. Any ABRN-only bugfix must be backported to QuantiX-Drive first, then synced down. |
| Loss of git blame on the upstream repo if we squash | Low | Don't squash. Preserve history. |
| Two deploy pipelines to maintain | Medium | Accept this cost. QuantiX-Drive deploys to a demo/staging environment. ABRN-Drive deploys to Azure. |
| Frontend `.env.local` leaks secrets if checked in | High | `.env.local` stays gitignored. `.env.abrn` contains only public branding values, never API secrets. |
| Go module rename again breaks 41 files for marginal benefit | Low | Don't rename. Keep `github.com/vinuxito/VaultDrive` as the engine module name. |

---

## Open Questions (Phase 0 blockers)

Before implementation begins, the user needs to confirm:

1. **Exact product name:** `QuantiX Drive`, `QuantiX-Drive`, `QuantixDrive`, `quantix-drive`? (Affects capitalization everywhere.)
2. **Upstream repo location:** `github.com/vinuxito/QuantiX-Drive`? Private or public? New org?
3. **Is ABRN the only customer today?** If yes, Option B is correct. If there are unstated other customers, revisit Option C.
4. **Docker strategy:** Single generic image with runtime env config (preferred) vs per-customer build-time images?
5. **Preserve git history in QuantiX-Drive repo?** (Recommended: yes.)
6. **Go module rename?** Keep `github.com/vinuxito/VaultDrive` as the engine (recommended) or rename to `github.com/vinuxito/QuantiXDrive`?
7. **Primary color for QuantiX-Drive default branding:** Burgundy (inherited from ABRN) or a new distinct color (e.g. indigo, teal)? If distinct, ABRN keeps burgundy via override.
8. **QuantiX-Drive's own domain:** Is there a planned domain (e.g. `quantixdrive.io`)? Even a placeholder is fine — just needs to differ from `filemonprime.net`.
9. **GitHub Actions secrets:** Who owns the Azure/CI secrets on the new repo? Can they stay on ABRN-Drive only (since the upstream repo wouldn't deploy to ABRN's Azure)?
10. **Timeline pressure:** Is this a "fit between features" slow extraction (weeks) or a "block all other work" focused sprint (days)?

---

## Effort Estimate (rough)

| Phase | Line changes | Risk |
|-------|--------------|------|
| Phase 0 | 0 (discussion) | None |
| Phase 1 | ~800 LOC touched across ~55 files (mostly string replacements + config threading) | Medium — pure refactor, tests must stay green |
| Phase 2 | New repo, ~20 file edits on top of Phase 1 base | Low — isolated work on a new repo |
| Phase 3 | ~10 files added to ABRN-Drive as overrides | Low |
| Phase 4 | Verification only | Low |
| Phase 5 | Deploy pipeline tweaks | Medium — touches production |

Phase 1 is the single biggest batch of work. The rest are low-risk mechanical steps.

---

## Suggested First Action

**Do not start implementing yet.** Answer the 10 Phase 0 questions first. Once the user confirms
the product name, repo location, module-rename decision, and primary color, I can start Phase 1
(the config-driven refactor) inside the current ABRN-Drive branch. Phase 1 lands as a PR that
ships to ABRN production with zero visible change — proving the refactor is safe. Only then do
we create the QuantiX-Drive repo in Phase 2.

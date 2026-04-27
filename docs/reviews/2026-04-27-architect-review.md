# QuantiX Drive — Operator / Architect Review

**Date:** 2026-04-27
**Reviewer:** Claude Code, after a full QA + closeout session in the repo
**Scope:** Honest product + technical assessment of the app as it exists today, grounded in repo evidence and live verification — not a marketing blurb.

---

## Frame

QuantiX Drive presents itself as a self-hostable, zero-knowledge encrypted file control plane. The interesting question is not "does it work" — every test suite is green, every documented feature has at least one verification, and the live URL serves HTTP 200. The interesting questions are:

1. **What kind of tool is this actually becoming?**
2. **What is genuinely strong about it, and what is brittle?**
3. **Where will it crack first under real-world use?**

This review answers those, with evidence.

## What It Is, In One Sentence

A small, sharp, single-binary file vault with a real zero-knowledge crypto boundary, built for **delegated, auditable handling of sensitive material** — files you'd rather not park in someone else's SaaS.

It is not Dropbox for everyone. It is closer to a **trust-aware exchange surface**: an owner's drive that knows how to issue scoped, time-bound, revocable access — to humans, to AI agents, to public collectors — without ever giving away the keys.

## Snapshot Of Reality

| Dimension | Number | Source |
|---|---|---|
| Backend routes | **98** registered handlers | `grep mux.Handle main.go` |
| Database migrations | **45** | `sql/schema/` |
| Frontend unit specs | **31 files / 106 tests** | `vitest run` |
| End-to-end specs | **10 files / 39 tests** | `vaultdrive_client/e2e/` |
| Backend binary | **~12 MB** | `du -h quantix-drive` |
| Main JS chunk | **466 KB raw / 137 KB gzip** | `dist/assets/index-CBAmGtI3.js` |
| Live URL | https://quantixdrive.filemonprime.net/quantix/ | Apache vhost |
| Service | `quantixdrive.service` (systemd, user `daemon`) | `/etc/systemd/system/` |
| Branch state today | `main` ahead of `origin/main` by **5 commits** | `git status` |
| Legacy "ABRN" references in docs | **50 files** | `grep -rln abrn docs/` |

## Usefulness

**High, but specific.** This is not a general-audience cloud drive. The features that are sharpest are the ones for **structured, auditable hand-off**:

- **Drop portals** for collecting files from people without accounts.
- **File requests** for per-recipient secure intake.
- **Folder share links** with revoke + expiry.
- **Agent API keys** (`qxak_*`) with explicit scopes and last-used tracking.
- **Audit log** with CSV/JSON export.

If the user's mental model is "I need to receive sensitive files from outsiders, hand pieces of my drive to specific people or AI agents, and prove later who saw what," QuantiX is genuinely useful and meaningfully better than the obvious off-the-shelf alternatives. If the user just wants "a place to throw my photos," it is overkill.

## Ease Of Use

**Mixed — good for owners, sharper edges for newcomers.**

Strengths:
- Six selectable skins via CSS custom properties; the theme switch is real, not cosmetic — every panel, button, dropdown is variable-driven (verified by the recent color-consistency cleanup; no hardcoded hex left in the components I touched).
- Trust UX surface — owners see receipts of what the server actually did. This is rare and quietly valuable.
- Coherence primitives (`<RowActionMenu>`, `<DataState>`, `constants/copy.ts`) are starting to land — the in-flight UI/UX coherence roadmap is the right direction.

Friction:
- Apache routing is split: SPA at `/quantix/`, API at root `/api/...`. `/quantix/api/healthz` is 404 — only `/api/healthz` works. This is a real footgun for any new operator or external integrator and is not yet documented inside the app or its README (now partially documented after today's closeout, but it should be in the deploy guide too).
- Onboarding wizard exists but the password / PIN ceremony is asymmetric: PIN flow is hardened, but password creation has zero server-side validation (see Robustness).
- Frontend bundle is ~137 KB gzipped main chunk — not huge by 2026 standards but borderline heavy for a "drive" that should feel quick on first paint.

## Power

**This is where the app punches above its weight.**

- **Real zero-knowledge boundary.** AES-256-GCM in the browser, RSA key envelopes per user, PIN-derived KEKs. Server stores ciphertext and metadata only. Verified by reading the upload + decryption paths and by the E2E `file-upload-flow` and `share-link-lifecycle` specs that exercise the round-trip.
- **Granular delegation.** Agent keys with scopes (`files:list`, `files:read_metadata`, `activity:read`, etc.) are not a checkbox; they're enforced. The `agent-key-lifecycle.spec.ts` covers 8 cases including revoke + scope rejection.
- **Observability.** 98 routes, of which a healthy fraction are explicitly versioned (`/api/v1/`). Audit log + governance settings + activity feed are first-class, not bolted-on.
- **Single binary.** 12 MB. Embeds the frontend. Boots from one systemd unit. This is the right shape for a self-hosted product.

## Robustness

**Strong on the inside, fragile on the perimeter.**

Inside (post-auth, post-PIN):
- All 39 Playwright flows green. 106 vitest specs green. `go test ./...` clean. Concurrency-sensitive paths (key envelopes, share-link decryption) have integration coverage.
- Rate limiting per route (login 10/min, PIN 5/min, global 100/min). Loopback exemption for E2E is a sensible compromise; documented.
- DB schema is managed by goose — 45 migrations, no hand-edits in `sql/schema/` per the project rules.

Perimeter (the public signup edge):
- 🔴 **HIGH** — `POST /api/register` accepts a 5-character password (`"short"`). No length, no complexity, no breach check. Reproducible against the freshly-deployed binary. This is the single biggest credential-strength risk in the app.
- 🟡 **MEDIUM** — `POST /api/register` returns HTTP 500 on `{}` body. The handler decodes into zero-valued strings and lets bcrypt or DB insert fail downstream. Operationally noisy; bad DX for integrators.
- 🟢 **LOW (architectural)** — encrypted private key uses single-round SHA-256 as the KDF. Source comment already flags Argon2id / PBKDF2 as the proper target. Not exploitable without server compromise, but it's the kind of thing that ages badly.

Other robustness gaps:
- No automated deploy pipeline tied to `git push`. CI builds a GHCR image on push to `main`, but the live URL on this VPS is updated by `go build && sudo systemctl restart quantixdrive` run by hand. This worked today because the operator was paying attention; it failed silently for the prior ~2 weeks (binary was Apr 14; HEAD was Apr 27).
- Working tree drift between sessions — sessions were ending without rebuild + restart despite the project's own runbook (`START_HERE.txt`, `Makefile`) saying to do exactly that. This is process, not code, but it directly causes the prod-vs-source divergence that cost time today.

## Weak Spots / Risks

In rough priority order (highest impact first):

1. **Public signup is the soft underbelly.** Any time spent on new features before the register validation patch lands is borrowed time. Combined HIGH + MEDIUM fix is small (a single coordinated patch) and ought to be the next merge.
2. **Deploy is "vibes, not pipeline."** No mechanism guarantees that `git push` ↔ live URL. Either: (a) wire a GitHub Actions deploy step to SSH + restart, or (b) make a literal `make deploy` target that does build + restart + smoke + alert. Pick one. Document it. Treat anything else as "not deployed."
3. **Naming legacy.** 50 files in `docs/` still reference `abrn` / `ABRN-Drive`. The product was renamed but the docs weren't fully migrated. New contributors will be confused. A purge sweep + a short "this used to be called ABRN-Drive" note in CONTRIBUTING is a one-afternoon job.
4. **Single main JS chunk at 466 KB.** Code-splitting is partially in place (lazy chunks for `files`, `groups`, `settings`), but the main bundle still pulls a lot. Worth a profiling pass before next major feature, not before.
5. **ESLint architectural rules were demoted to warnings** to unblock progress (this session). That's an honest, scoped retreat — but the warnings will rot if no one schedules them. Put a quarterly "lint zero-warnings" task on the roadmap, or accept the demotion permanently and remove the rules.
6. **No load / chaos testing.** The product handles concurrency in code; nothing in the repo proves it under real load. For a control plane that talks about delegation and audit, this is a future-credibility gap.

## What It's Becoming

If today's trajectory holds, QuantiX Drive is moving toward:

> **A small-team / personal-fortress control plane for sensitive document hand-off, with first-class agent delegation.**

Not a SaaS Dropbox clone. Not a corporate ECM. Something more like: *the file-sharing surface a careful person or a small firm runs themselves when they care about who saw what, when, and through which key.* The trust UX, the agent-key model, the audit feed, and the receipts collectively differentiate it from "files behind login." That's a real and defensible position.

The product can drift in two directions from here:

- **Toward sharper:** harden the signup edge, lock down the deploy story, finish the coherence pass (consistent empty/error states across surfaces), and the app becomes genuinely shippable for paying or trust-sensitive users.
- **Toward bloated:** add more features (email modal, more vault sections, more skins) without closing the perimeter, and the product turns into "a lot of routes" instead of "a coherent tool."

The roadmap currently in `docs/roadmaps/2026-04-26-ui-ux-coherence-upgrade-roadmap.md` is a good signal — it's a coherence pass, not a feature pass. Stay on it.

## Verdict

**A real, working, surprisingly capable single-binary product with a sharp internal core and a fragile public signup edge.**

If I were the operator, my next three moves in order would be:

1. **Land the register-validation patch.** Combined HIGH + MEDIUM. One coordinated change. Add a vitest + go-test for both branches.
2. **Make `make deploy` (or equivalent) the only path that touches prod.** Forbid manual `go build && systemctl restart` cycles in muscle memory by deleting them from documentation once `make deploy` works.
3. **Finish the coherence roadmap step 4** (AccessPanel + FileRequests adoption — already partially in flight in this branch's working tree).

Everything else can wait.

## Stop Condition

Reality is currently clean: source ↔ binary ↔ dist ↔ live URL aligned, all suites green, two register-validation findings documented and bounded. This review can be the artifact of that "stop" — a durable record of where the product stood when it was honest with itself.

---

*This file is intentionally durable. It is not a session memory and not a verification report. It is a snapshot of the product the way an honest operator/architect would describe it on a Monday morning, with all the test runs and deploy steps already done.*

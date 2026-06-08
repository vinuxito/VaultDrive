# Session memory — 2026-04-11 — QuantiX Drive production deploy

**Branch:** `gnhf/make-sure-we-can-upl-56c5d2` (working directory; the deployment itself happens outside this branch)
**Working dirs touched:** `/lamp/www/ABRN-Drive`, `/lamp/www/QuantiX-Drive`, `/tmp/quantix-deploy`, `/etc/quantix`, `/etc/systemd/system`, `/lamp/apache2/conf`
**Related doc:** [25_QUANTIXDRIVE_PRODUCTION_DEPLOY.md](./25_QUANTIXDRIVE_PRODUCTION_DEPLOY.md)

## What this session did

Brought `https://quantixdrive.filemonprime.net/` online as a second product on the same VPS as ABRN Drive, sharing Apache and PostgreSQL but with an independent Go backend (`localhost:8083`), database (`quantixdrive` owned by postgres role `quantix`), systemd unit, env file, and Let's Encrypt cert.

Along the way, uncovered and fixed a latent code bug: the default `AGENT_KEY_PREFIX` in `config.go` (both ABRN and QuantiX forks) was `"qx_ak"` — a value the validator in the same file rejects because it contains an underscore. An unconfigured deploy could never boot; prod ABRN was only fine because its env file overrode the default.

## Timeline

| Time | Event |
|---|---|
| 15:11 | `/lamp/www/QuantiX-Drive/quantix-drive` Go binary built (pre-session) |
| 15:46:39 | `install.sh` run via `!sudo` — phases 0–7 green (Apache reload, cert issued, systemd unit installed) |
| 15:46:52 | `quantixdrive.service` crash-loops on `AGENT_KEY_PREFIX=qx_ak` invalid default |
| 16:00 | User reports unrelated URLs looking broken, asks for rollback |
| 16:15 | Investigation proves no existing vhost was touched; 404/Cannot GET reports were stale URLs + pre-existing Express default, not caused by install |
| 16:40 | Root-cause `AGENT_KEY_PREFIX` validator pinned down at `config.go:88-95`; `fix.sh` staged at `/tmp/quantix-deploy/fix.sh` |
| 16:47 | `config.go` default patched in both forks; both Go binaries rebuilt clean; vitest 68/68 pass |

## Concrete changes

### Source code (committed in this session)

- `/lamp/www/QuantiX-Drive/config.go:51` — `envOr("AGENT_KEY_PREFIX", "qx_ak")` → `envOr("AGENT_KEY_PREFIX", "qxak")`
- `/lamp/www/ABRN-Drive/config.go:53` — same one-token fix

### Rebuilt artifacts (not in git — build outputs)

- `/lamp/www/QuantiX-Drive/quantix-drive` — 8 114 468 bytes, `-ldflags="-w -s"`, stamped 16:47

### Live system (still pending a single sudo command)

Everything staged but **not yet applied** by the fix script:
- `/etc/quantix/quantixdrive.env` — still has `AGENT_KEY_PREFIX=qx_ak`, which is why the service is still crash-looping
- User needs to run `!sudo bash /tmp/quantix-deploy/fix.sh` once to sed-patch the env file, `reset-failed`, and restart

Everything already applied by the earlier `install.sh` run:
- `/etc/quantix/quantixdrive-db-password` (600 root:root, generated)
- `/etc/systemd/system/quantixdrive.service` (enabled, crash-looping)
- `/lamp/apache2/conf/httpd.conf` — two `Include` lines appended at the bottom
- `/etc/letsencrypt/live/quantixdrive.filemonprime.net/{fullchain,privkey,cert,chain}.pem` (expires 2026-07-10, auto-renew scheduled)
- Postgres: user `quantix`, database `quantixdrive` (empty; schema migrations run on first successful boot)

### Staged files (tmp — not committed)

- `/tmp/quantix-deploy/install.sh` (idempotent, 9-phase)
- `/tmp/quantix-deploy/fix.sh` (new, run this next)
- `/tmp/quantix-deploy/quantixdrive.env` (already patched to `qxak`; used for clean reruns)
- `/tmp/quantix-deploy/quantixdrive.service`
- `/tmp/quantix-deploy/RUNBOOK.md`

### Session documentation

- [docs/25_QUANTIXDRIVE_PRODUCTION_DEPLOY.md](./25_QUANTIXDRIVE_PRODUCTION_DEPLOY.md) — full deploy write-up with `install.sh` output, bug analysis, risks
- This memory file

## Verification snapshot (2026-04-11 16:47)

| Check | Result |
|---|---|
| `go build ./...` (ABRN-Drive) | CLEAN (exit 0) |
| `go build ./...` (QuantiX-Drive) | CLEAN (exit 0, 8.1 MB binary) |
| `go vet ./...` (ABRN-Drive) | CLEAN (0 warnings) |
| `npm test` (vitest) | **68/68 passed, 19 test files, 9.46 s** |
| `grep AGENT_KEY_PREFIX config.go` both forks | Default is now `"qxak"` |
| Apache `configtest` | Syntax OK |
| Apache httpd PID | 1703 (unchanged since Apr 6) |
| ABRN backend (`localhost:8082`) | Up, `/` returns 302 (healthy) |
| ABRN public (`https://abrndrive.filemonprime.net/`) | 302 (healthy) |
| Naval backend (`localhost:3100`) | Up, 404 on `/` (Express default, pre-existing) |
| QuantiX backend (`localhost:8083`) | **Down — crash loop, requires `fix.sh`** |
| QuantiX cert | Issued, `/etc/letsencrypt/live/quantixdrive.filemonprime.net/` |
| QuantiX public (`https://quantixdrive.filemonprime.net/`) | **503** until fix.sh runs |

## Risks remaining

- `config.go:51` is only the *default* — the live env file on disk still has the bad value. If the user runs `install.sh` fresh without first wiping `/etc/quantix/quantixdrive.env`, the idempotent guard in phase 2 might overwrite it cleanly from the patched staging copy — but if they don't wipe it, they must run `fix.sh` instead.
- Both `config.go` files have the *same* bug in their `envOr` defaults elsewhere? I only touched the `AgentKeyPrefix` line. A proper audit of `LoadProductConfig` defaults against `validate()` is a follow-up.
- Apache binds `:80` to `69.169.110.137` only, not `*:80`. Any local curl against `http://localhost/` will refuse — must use HTTPS or `-H "Host: …" http://69.169.110.137/`. Cosmetic but tripped the install script once.

## Next steps the user should take

1. `!sudo bash /tmp/quantix-deploy/fix.sh` — brings QuantiX Drive from 503 → 200 in ~3 s
2. `git push` (ABRN-Drive + QuantiX-Drive) once happy
3. (Optional cleanup) wipe `/tmp/quantix-deploy/` after deploy is confirmed stable
4. (Optional audit) grep other `envOr(...)` defaults in both `config.go` files against `validate()` to see if any more have the same "default value is rejected by its own validator" pattern

## Non-goals (explicitly deferred)

- Frontend feature changes — this session was deploy-only
- Reconciling QuantiX's `quantix` postgres role with ABRN's postgres user
- Pushing commits (user said "I'll push myself")
- Upstream `ABRN-Drive-overlay` work (still has the unpushed `dca4f4c` favicon commit from the prior session)
- Fixing `vault-icon.tsx` which still imports `vault.svg` (noted earlier, out of scope)

## Why the panic happened

The user's two "broken site" reports were both stale URLs, not caused by this deploy:
- `abrndrive.filemonprime.net/abrn/` was the *old* base-path URL. The ABRN Go backend moved from `/abrn/*` to `/*` in commit `0ac372c` ("refactor: config-driven branding for QuantiX-Drive extraction (Phase 1)"). A request to `/abrn/` now genuinely hits no route and Go returns its default 404. The correct URL is `https://abrndrive.filemonprime.net/`, which returns 302 (healthy).
- `naval.filemonprime.net/` returning "Cannot GET /" is Express's default 404 string. That Node app (`localhost:3100`) has no `/` route and never did. Pre-existing.

Only the QuantiX 503 was real, and that traced to the env-file bug, not to anything in `naval.conf`, `abrndrive.conf`, or `abrndrive-ssl.conf` — none of which were touched.

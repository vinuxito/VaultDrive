# Install the missing ABRN Drive service (2026-09-14 recovery)

The new `abrndrive.service`, `prepare-runtime-env.py`, and `install-abrndrive.sh`
restore the native backend. Prepare a current-source Go binary first. Stage all
three deployment files and the binary under a private user-owned directory
(mode 0700, files not writable by the service account). Run
`prepare-runtime-env.py` as the current user to create `runtime.env` beside the
staged installer; verify that snapshot before the sudo step. Then run:

```bash
sudo bash /home/vinuxito/.cache/abrndrive-recovery/install/install-abrndrive.sh /home/vinuxito/.cache/abrndrive-recovery/abrndrive
```

Do not sudo-execute the installer from the shared writable application tree.
The helper preserves `.env.runtime` precedence and existing secrets, translates
the Docker database address to `127.0.0.1:5432`, and preserves Compose's
`ENABLE_ARGON2ID=false`. The unit bind-mounts `uploads` at `/data/uploads` within
its filesystem namespace. PostgreSQL restart recovery uses `Wants`/`After`,
`pg_isready` and automatic backend restarts.

The installer backs up replaced files, installs only ABRN Drive, enables startup,
and verifies readiness plus public HTTPS. It does not run migrations. Full
systemd and public verification passed after the administrator completed the sudo
step on 2026-09-14: active/enabled, public HTTP 200, and 439/439 stored files.

---

# Reboot-survival hardening for the Drive backends

This directory makes **ABRN Drive** (`abrndrive.service`, port 8082) and
**QuantiX Drive** (`quantixdrive.service`, port 8083) come back up reliably
after every VPS reboot.

## The problem it fixes

After a VPS restart the backends could come up in a bad state. Root causes found:

1. **`abrn-watch.service` crash-loop.** A dev-only frontend auto-reload watcher
   ran `/lamp/www/ABRN-Drive/watch-and-reload.sh`, but that script was deleted
   from the repo. The unit failed with `203/EXEC` every 5 seconds on every boot,
   spamming the journal and showing a permanently failed service. The Go backend
   serves the frontend itself, so the watcher is obsolete → **disabled + masked**.

2. **Cold-boot Postgres race.** `postgresql.service` on this host is a *oneshot
   wrapper*; systemd marks it "started" the instant it forks the real
   `postgresql@16-main.service`, which is **not** yet accepting connections. On a
   cold boot the backends launched, failed to connect, and crash-looped.

3. **The start-rate limiter could give up.** With the default
   `StartLimitBurst`/`StartLimitIntervalSec`, a service that restarts enough
   times in a window is permanently parked in `failed` — the literal opposite of
   bulletproof.

## What this installs

| File | Installed to | Purpose |
|---|---|---|
| `wait-for-postgres.sh` | runs in-place from this deploy tree | ExecStartPre gate — blocks until `pg_isready` succeeds (≤120s), then hands off. Kept in-tree so it needs no root to update and survives redeploys |
| `abrndrive.service.d/hardening.conf` | `/etc/systemd/system/abrndrive.service.d/` | Drop-in: `Requires=postgresql`, `network-online`, `StartLimitIntervalSec=0`, `Restart=always`, the DB gate |
| `quantixdrive.service.d/hardening.conf` | `/etc/systemd/system/quantixdrive.service.d/` | Same hardening for QuantiX Drive |

> The DB gate runs as `User=daemon` (the service user) from the same world-writable
> app tree that already holds the service binaries, so it adds no new trust surface
> on this host.

`StartLimitIntervalSec=0` disables the rate limiter → the service retries
**forever**. Combined with the `pg_isready` gate, the backends wait for the DB
on a cold boot instead of crash-looping, and can never permanently fail.

These are **drop-ins** — the base `.service` units are left untouched, so the
change is additive and easy to reverse.

## Install / re-apply

```bash
sudo /lamp/www/ABRN-Drive/deploy/systemd/install-hardening.sh
# then, to apply to the already-running backends (brief blip):
sudo systemctl restart abrndrive.service quantixdrive.service
```

Idempotent — safe to re-run after any redeploy.

## Verify it survives a reboot

```bash
systemctl is-enabled abrndrive quantixdrive          # enabled
systemctl is-active  abrndrive quantixdrive          # active
systemctl is-active  abrn-watch                       # masked (inactive)
systemctl list-dependencies abrndrive | grep postgres # ordering present
ss -ltn | grep -E ':808[23]'                          # both ports listening
```

To prove the cold-boot path without a full reboot, you can stop Postgres,
restart a backend (it will wait in `wait-for-postgres`), then start Postgres and
watch it connect:

```bash
sudo systemctl stop postgresql && sudo systemctl restart abrndrive &
journalctl -fu abrndrive            # shows "wait-for-postgres" looping
sudo systemctl start postgresql     # backend connects within ~2s
```

## Reverse

```bash
sudo rm /etc/systemd/system/abrndrive.service.d/hardening.conf
sudo rm /etc/systemd/system/quantixdrive.service.d/hardening.conf
sudo systemctl unmask abrn-watch.service   # only if you want the watcher back
sudo systemctl daemon-reload
```

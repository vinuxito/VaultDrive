# ABRN Drive service recovery — 2026-09-14

Status: RECOVERED; administrator installation and independent public verification passed.
Verified 2026-09-14 at 00:31 UTC.

## Cause and repair
Apache returned 503 because localhost:8082 had no listener. The native service
was missing and Docker was inactive. The previous working deployment used Docker.
The native service is now installed, using PostgreSQL at 127.0.0.1:5432, preserving the
latest .env.runtime JWT/database credentials and the Compose crypto setting.
A service-private bind mount exposes existing host uploads at /data/uploads so
both relative and absolute stored paths work. Existing secrets and ciphertext
were preserved, with no migrations or manual database changes. The configured
idempotent admin bootstrap ran on production startup (journal: one user matched
from two configured candidate emails). The pre-existing repository binary remains
untouched; the rebuilt binary is installed under /usr/local/lib/abrndrive/.

## Verification
| Check | Command or method | Exit/result |
|---|---|---|
| Initial public endpoint | curl HTTPS root and /api/healthz | HTTP 503 |
| Current-source build | Go 1.25.14 go build -ldflags='-w -s' to staged binary | 0 |
| Storage regression tests | go test . -run 'Test(ResolveStoredFilePath\|CheckStoredFilePaths)' -count=1 | 0 / pass |
| Environment preparation | fixture assertions for precedence, encoded credentials, database identity and missing secret rejection | 0 / pass |
| Database identity | Read-only psql | 241 users, 439 files, migration 49 applied |
| Staged backend /ready | curl http://127.0.0.1:18082/ready in bwrap upload namespace | HTTP 200, 439 files available |
| Staged backend /health | curl http://127.0.0.1:18082/health | HTTP 200 |
| Frontend | Playwright landing and /abrn/login | rendered ABRN Drive |
| Shell syntax | bash -n deploy/systemd/install-abrndrive.sh | 0 |
| Unit syntax | systemd-analyze verify with staged executable path | 0; unrelated host swap ordering/inotify warnings |
| Actual daemon identity | ps -o user,group,pid,comm -p 2247924 | 0 / daemon:lampedit |
| Service state | systemctl show abrndrive.service | 0 / loaded, enabled, active, running, NRestarts=0 |
| Live readiness | curl -fsS https://abrndrive.filemonprime.net/ready | 0 / HTTP 200, all 439 files accessible |
| Live health | curl -fsS https://abrndrive.filemonprime.net/health | 0 / HTTP 200, status ok |
| Public landing | curl -fsSL https://abrndrive.filemonprime.net/ | 0 / HTTP 200 at /abrn/ |
| Public login | Playwright /abrn/login snapshot and console | 0 / email and password inputs rendered, 0 console errors |
| Installed binary identity | sha256sum installed and staged binaries | 0 / identical |
| Root ownership | stat unit, binary, environment directory | 0 / root:root, modes 644, 755, 700 |

The preview used port 18082 and disabled admin bootstrap for its smoke check.
The preview and browser sessions were stopped after verification.
No authenticated login, upload, download or reboot was exercised. Full suite was
not run; this is service recovery with focused storage and startup checks.

Binary SHA-256: `12b3fdbf8cf10b669669e817e1883687241b7241c8e5a7ad14aefa623f3e1b82`

## Installation
The administrator successfully ran the installer staged under the user's private cache (not the writable app tree):

```bash
sudo bash /home/vinuxito/.cache/abrndrive-recovery/install/install-abrndrive.sh /home/vinuxito/.cache/abrndrive-recovery/abrndrive
```

The installer backs up replaced files under /var/backups/abrndrive-recovery.*,
installs a root-owned binary/unit/environment, enables boot startup, starts the
service and checks readiness and public HTTPS. It changes only ABRN Drive.
Root-owned runtime configuration lives at /etc/abrndrive/runtime.env.
Source environment files remain untouched.
Backup directory: `/var/backups/abrndrive-recovery.G3v9wSao`.

The first curl connection refusal in installation output was the bounded readiness
retry before the backend started. The existing zram-swap.service orders itself
before swap.target while retaining default service dependencies, producing a
sysinit ordering cycle during unit validation. It did not block installation.
No unrelated host swap configuration was changed.

## Rollback
The installer prints its backup directory. On first installation, stop/disable
abrndrive and remove only the newly installed unit, environment and binary if
rollback is needed. On replacement, restore backed-up files and reload systemd.
Do not remove uploads or modify database records. Inspect before executing rollback.

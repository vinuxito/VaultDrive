#!/usr/bin/env bash
# Install the already-built backend, preserving existing secrets and uploads.
set -euo pipefail
if [[ $(id -u) != 0 ]]; then
    echo 'Run with sudo: install-abrndrive.sh /absolute/path/to/verified/abrndrive' >&2
    exit 1
fi
binary=${1:?Pass the absolute path to the verified backend binary}
[[ "$binary" = /* && -x "$binary" ]] || { echo 'Executable absolute binary path required' >&2; exit 1; }
src=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
/usr/bin/pg_isready -q -h 127.0.0.1 -p 5432
getent passwd daemon >/dev/null
getent group lampedit >/dev/null
if [[ -n "$(ss -H -ltn 'sport = :8082')" ]] && ! systemctl is-active --quiet abrndrive.service; then
    echo 'Port 8082 is occupied outside the active abrndrive service; refusing to replace it.' >&2
    exit 1
fi

scratch=$(mktemp -d)
trap 'rm -rf -- "$scratch"' EXIT
# Use the reviewed private snapshot; never reread the shared app env as root.
[[ -f "$src/runtime.env" ]] || { echo 'Missing prepared private runtime.env' >&2; exit 1; }

# Retain every file this installer replaces, including the sensitive environment.
backup=$(mktemp -d /var/backups/abrndrive-recovery.XXXXXXXX)
chmod 0700 "$backup"
for target in /etc/abrndrive/runtime.env /etc/systemd/system/abrndrive.service /usr/local/lib/abrndrive/abrndrive; do
    if [[ -e "$target" || -L "$target" ]]; then
        cp -a --parents -- "$target" "$backup/"
    fi
done
install -d -m 0700 /etc/abrndrive
install -m 0600 "$src/runtime.env" /etc/abrndrive/runtime.env
install -d -m 0755 /usr/local/lib/abrndrive
install -m 0755 "$binary" /usr/local/lib/abrndrive/abrndrive.new
mv -f /usr/local/lib/abrndrive/abrndrive.new /usr/local/lib/abrndrive/abrndrive
install -m 0644 "$src/abrndrive.service" /etc/systemd/system/abrndrive.service
systemd-analyze verify /etc/systemd/system/abrndrive.service
systemctl daemon-reload
systemctl enable abrndrive.service
systemctl restart abrndrive.service
systemctl is-active --quiet abrndrive.service

ready=0
for ((attempt=0; attempt<30; attempt++)); do
    if curl -fsS --max-time 5 http://127.0.0.1:8082/ready >"$scratch/ready.json"; then
        ready=1
        break
    fi
    sleep 1
done
if [[ "$ready" != 1 ]]; then
    echo "Readiness failed. Backup: $backup" >&2
    systemctl status abrndrive.service --no-pager || true
    exit 1
fi
cat "$scratch/ready.json"
systemctl is-active --quiet abrndrive.service
curl -fsS --max-time 15 https://abrndrive.filemonprime.net/health
curl -fsSL --max-time 15 https://abrndrive.filemonprime.net/ -o /dev/null
systemctl is-enabled abrndrive.service
systemctl is-active abrndrive.service
echo "ABRN Drive installed and verified. Previous files: $backup"

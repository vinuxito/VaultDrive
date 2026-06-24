#!/usr/bin/env bash
# install-hardening.sh — install reboot-survival hardening for the Drive units.
#
# Idempotent. Safe to re-run after any redeploy. Run as root:
#     sudo ./install-hardening.sh
#
# What it does:
#   1. Ensures the cold-boot DB gate (wait-for-postgres.sh) is executable.
#   2. Installs hardening drop-ins for abrndrive + quantixdrive.
#   3. Disables + masks the obsolete abrn-watch.service (its script was deleted
#      from the repo; the Go backend serves the frontend itself).
#   4. Reloads systemd.
#
# The DB gate is referenced in-place from this deploy tree (no /usr/local/bin
# copy), so the drop-ins keep working across redeploys without extra steps.
#
# It does NOT restart the running backends. Apply to live processes with:
#     sudo systemctl restart abrndrive.service quantixdrive.service
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "ERROR: must run as root (sudo ./install-hardening.sh)" >&2
  exit 1
fi

SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SYS=/etc/systemd/system

echo ">> [1/4] Marking wait-for-postgres.sh executable"
chmod 0755 "$SRC/wait-for-postgres.sh"

echo ">> [2/4] Installing abrndrive + quantixdrive hardening drop-ins"
install -d -m 0755 "$SYS/abrndrive.service.d"
install -m 0644 "$SRC/abrndrive.service.d/hardening.conf"   "$SYS/abrndrive.service.d/hardening.conf"
install -d -m 0755 "$SYS/quantixdrive.service.d"
install -m 0644 "$SRC/quantixdrive.service.d/hardening.conf" "$SYS/quantixdrive.service.d/hardening.conf"

echo ">> [3/4] Disabling + masking obsolete abrn-watch.service"
systemctl disable --now abrn-watch.service 2>/dev/null || true
systemctl mask abrn-watch.service 2>/dev/null || true

echo ">> [4/4] Reloading systemd"
systemctl daemon-reload

echo
echo "Done. Config is in place and applies on the next boot."
echo "To apply to the already-running backends now (brief blip):"
echo "    sudo systemctl restart abrndrive.service quantixdrive.service"

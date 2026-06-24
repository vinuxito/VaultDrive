#!/usr/bin/env bash
# wait-for-postgres.sh — block until the local PostgreSQL accepts connections.
#
# Why this exists:
#   On this host PostgreSQL is fronted by the oneshot `postgresql.service`
#   wrapper. systemd considers that wrapper "started" the moment it forks the
#   real `postgresql@16-main.service` — which does NOT mean the database is yet
#   accepting client connections. On a cold VPS reboot (cold disk cache, every
#   service contending for IO) that gap can be several seconds. Without a gate,
#   the Drive backends launch, fail to connect, and crash-loop.
#
#   Used as an ExecStartPre for abrndrive/quantixdrive so they WAIT for Postgres
#   instead of crash-looping.
#
# Usage:   wait-for-postgres.sh [timeout_seconds]   (default 120)
#
# Exit policy: ALWAYS exits 0. If the timeout is reached we still hand off to
# the backend; its own `Restart=always` covers the remaining gap. We never let
# this script block the boot indefinitely.
set -u

# Pin a stable locale: Ubuntu's pg_isready is a perl wrapper that spams
# "Setting locale failed" warnings into the journal under this host's locale.
export LC_ALL=C

HOST="${PGHOST:-127.0.0.1}"
PORT="${PGPORT:-5432}"
TIMEOUT="${1:-120}"

PG_ISREADY="$(command -v pg_isready || echo /usr/bin/pg_isready)"

deadline=$(( $(date +%s) + TIMEOUT ))
while true; do
  if "$PG_ISREADY" -q -h "$HOST" -p "$PORT"; then
    echo "wait-for-postgres: ${HOST}:${PORT} is accepting connections"
    exit 0
  fi
  if [ "$(date +%s)" -ge "$deadline" ]; then
    echo "wait-for-postgres: timed out after ${TIMEOUT}s waiting for ${HOST}:${PORT};" \
         "handing off to backend (Restart=always will cover)" >&2
    exit 0
  fi
  sleep 2
done

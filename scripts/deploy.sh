#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# QuantiX Drive + ABRN Drive — Deploy Script
# ─────────────────────────────────────────────────────────────────────────────
# Usage:   ./scripts/deploy.sh <quantix|abrn|both>
# Example: ./scripts/deploy.sh both
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

PRODUCT="${1:?Usage: deploy.sh <quantix|abrn|both>}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }

# ── Deploy QuantiX Drive ───────────────────────────────────────────────────
deploy_quantix() {
  log "═══ Deploying QuantiX Drive ═══"

  # Build frontend
  log "Building frontend..."
  cd "$PROJECT_DIR/vaultdrive_client"
  npm run build
  log "Frontend build complete"

  # Build Go binary with version info (to temp name to avoid 'Text file busy')
  log "Building Go binary..."
  cd "$PROJECT_DIR"
  GIT_HASH=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
  go build -ldflags="-w -s -X main.version=${GIT_HASH}" -o quantix-drive.new .
  log "Binary built: $(ls -lh quantix-drive.new | awk '{print $5}') (version: $GIT_HASH)"

  # Run migrations
  log "Running database migrations..."
  # Source env (strip \r from CRLF files)
  eval "$(sed 's/\r$//' /etc/quantix/quantixdrive.env 2>/dev/null)" 2>/dev/null || true
  if [ -n "${DB_URL:-}" ]; then
    go run github.com/pressly/goose/v3/cmd/goose@latest \
      -dir sql/schema postgres "$DB_URL" up 2>&1 || log "Migration warning — check output"
  else
    log "WARNING: DB_URL not set — skipping migrations"
  fi

  # Stop service → backup → swap → start
  sudo systemctl stop quantixdrive 2>/dev/null || true
  if [ -f "$PROJECT_DIR/quantix-drive" ]; then
    cp "$PROJECT_DIR/quantix-drive" "$PROJECT_DIR/quantix-drive.prev"
    log "Previous binary backed up to quantix-drive.prev"
  fi
  mv quantix-drive.new quantix-drive
  sudo systemctl start quantixdrive
  log "Service restarted"

  # Smoke test
  sleep 2
  local status
  status=$(curl -s -o /dev/null -w '%{http_code}' https://quantixdrive.filemonprime.net/quantix/api/healthz 2>/dev/null || echo "000")
  if [ "$status" = "200" ]; then
    log "✅ QuantiX Drive deployed successfully (healthz: 200)"
  else
    log "❌ QuantiX Drive healthz returned $status"
    log "   Rollback: sudo cp /usr/local/bin/quantixdrive.prev /usr/local/bin/quantixdrive && sudo systemctl restart quantixdrive"
    return 1
  fi
}

# ── Deploy ABRN Drive ─────────────────────────────────────────────────────
deploy_abrn() {
  log "═══ Deploying ABRN Drive ═══"

  # Build frontend with ABRN branding
  log "Building frontend (ABRN branding)..."
  cd "$PROJECT_DIR/vaultdrive_client"
  if [ -f .env.abrn ]; then
    npm run build -- --mode abrn
  else
    log "WARNING: .env.abrn not found — using default build"
    npm run build
  fi
  log "Frontend build complete"

  # Build Go binary with version info
  log "Building Go binary..."
  cd "$PROJECT_DIR"
  GIT_HASH=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
  go build -ldflags="-w -s -X main.version=${GIT_HASH}" -o abrndrive.new .
  log "Binary built: $(ls -lh abrndrive.new | awk '{print $5}') (version: $GIT_HASH)"

  # Run migrations
  log "Running database migrations..."
  # Source env (strip \r from CRLF files to prevent URL parse failures)
  eval "$(sed 's/\r$//' /lamp/www/ABRN-Drive/.env 2>/dev/null)" 2>/dev/null || true
  if [ -n "${DB_URL:-}" ]; then
    go run github.com/pressly/goose/v3/cmd/goose@latest \
      -dir sql/schema -allow-missing postgres "$DB_URL" up 2>&1 || log "Migration warning — check output"
  else
    log "WARNING: DB_URL not set — skipping migrations"
  fi

  # Stop service → backup → swap → start
  sudo systemctl stop abrndrive 2>/dev/null || true
  if [ -f /lamp/www/ABRN-Drive/abrndrive ]; then
    cp /lamp/www/ABRN-Drive/abrndrive /lamp/www/ABRN-Drive/abrndrive.prev
    log "Previous binary backed up to abrndrive.prev"
  fi
  mv abrndrive.new /lamp/www/ABRN-Drive/abrndrive
  cp -r vaultdrive_client/dist /lamp/www/ABRN-Drive/vaultdrive_client/dist
  sudo systemctl start abrndrive
  log "Service restarted"

  # Smoke test
  sleep 2
  local status
  status=$(curl -s -o /dev/null -w '%{http_code}' https://abrndrive.filemonprime.net/abrn/api/healthz 2>/dev/null || echo "000")
  if [ "$status" = "200" ]; then
    log "✅ ABRN Drive deployed successfully (healthz: 200)"
  else
    log "❌ ABRN Drive healthz returned $status"
    log "   Rollback: cp /lamp/www/ABRN-Drive/abrndrive.prev /lamp/www/ABRN-Drive/abrndrive && sudo systemctl restart abrndrive"
    return 1
  fi
}

# ── Main ───────────────────────────────────────────────────────────────────
case "$PRODUCT" in
  quantix) deploy_quantix ;;
  abrn)    deploy_abrn ;;
  both)    deploy_quantix && deploy_abrn ;;
  *)       echo "Unknown product: $PRODUCT. Usage: deploy.sh <quantix|abrn|both>" && exit 1 ;;
esac

log "═══ Deployment Complete ═══"

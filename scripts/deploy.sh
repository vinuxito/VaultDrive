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

  # Build Go binary
  log "Building Go binary..."
  cd "$PROJECT_DIR"
  go build -ldflags="-w -s" -o quantixdrive .
  log "Binary built: $(ls -lh quantixdrive | awk '{print $5}')"

  # Backup current binary
  if [ -f /usr/local/bin/quantixdrive ]; then
    sudo cp /usr/local/bin/quantixdrive /usr/local/bin/quantixdrive.prev
    log "Previous binary backed up to quantixdrive.prev"
  fi

  # Run migrations
  log "Running database migrations..."
  source /etc/quantix/quantixdrive.env 2>/dev/null || true
  if [ -n "${DB_URL:-}" ]; then
    go run github.com/pressly/goose/v3/cmd/goose@latest \
      -dir sql/schema postgres "$DB_URL" up 2>&1 || log "Migration warning — check output"
  else
    log "WARNING: DB_URL not set — skipping migrations"
  fi

  # Deploy binary
  sudo cp quantixdrive /usr/local/bin/quantixdrive
  sudo systemctl restart quantixdrive
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

  # Build Go binary
  log "Building Go binary..."
  cd "$PROJECT_DIR"
  go build -ldflags="-w -s" -o abrndrive .
  log "Binary built: $(ls -lh abrndrive | awk '{print $5}')"

  # Backup current binary
  if [ -f /lamp/www/ABRN-Drive/abrndrive ]; then
    cp /lamp/www/ABRN-Drive/abrndrive /lamp/www/ABRN-Drive/abrndrive.prev
    log "Previous binary backed up to abrndrive.prev"
  fi

  # Run migrations
  log "Running database migrations..."
  source /lamp/www/ABRN-Drive/.env 2>/dev/null || true
  if [ -n "${DB_URL:-}" ]; then
    go run github.com/pressly/goose/v3/cmd/goose@latest \
      -dir sql/schema -allow-missing postgres "$DB_URL" up 2>&1 || log "Migration warning — check output"
  else
    log "WARNING: DB_URL not set — skipping migrations"
  fi

  # Deploy binary + dist
  cp abrndrive /lamp/www/ABRN-Drive/abrndrive
  cp -r vaultdrive_client/dist /lamp/www/ABRN-Drive/vaultdrive_client/dist
  sudo systemctl restart abrndrive
  log "Service restarted"

  # Smoke test
  sleep 2
  local status
  status=$(curl -s -o /dev/null -w '%{http_code}' https://abrndrive.filemonprime.net/api/healthz 2>/dev/null || echo "000")
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

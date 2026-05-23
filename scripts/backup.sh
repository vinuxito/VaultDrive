#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# QuantiX Drive + ABRN Drive — Automated Database & Uploads Backup
# ─────────────────────────────────────────────────────────────────────────────
# Usage:   ./scripts/backup.sh [--dry-run]
# Cron:    0 3 * * * /lamp/www/QuantiX-Drive/scripts/backup.sh >> /var/log/quantix-backup.log 2>&1
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

# ── Configuration ──────────────────────────────────────────────────────────
BACKUP_DIR="${BACKUP_DIR:-/var/backups/quantix-drive}"
TIMESTAMP=$(date +%Y-%m-%d_%H%M%S)
RETAIN_DAYS="${RETAIN_DAYS:-30}"
PG_HOST="${PG_HOST:-localhost}"
PG_PORT="${PG_PORT:-5433}"
PG_USER="${PG_USER:-postgres}"
DRY_RUN=false

if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN=true
  echo "[$(date)] DRY RUN MODE — no files will be created"
fi

# Databases to back up (QuantiX + ABRN)
DATABASES=("quantixdrive" "vaultdrive")

# Upload directories to back up
UPLOAD_DIRS=(
  "/var/quantix-drive/uploads"
  "/lamp/www/ABRN-Drive/uploads"
)

# ── Functions ──────────────────────────────────────────────────────────────
log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }

check_dependencies() {
  for cmd in pg_dump gzip; do
    if ! command -v "$cmd" &>/dev/null; then
      log "ERROR: Required command '$cmd' not found"
      exit 1
    fi
  done
}

backup_database() {
  local db="$1"
  local outfile="$BACKUP_DIR/${db}_${TIMESTAMP}.sql.gz"

  log "Backing up database: $db → $outfile"

  if $DRY_RUN; then
    log "  [DRY RUN] Would run: pg_dump -h $PG_HOST -p $PG_PORT -U $PG_USER $db | gzip > $outfile"
    return 0
  fi

  # Verify database is accessible
  if ! PGPASSWORD="${PGPASSWORD:-postgres}" psql -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" -d "$db" -c "SELECT 1" &>/dev/null; then
    log "  ERROR: Cannot connect to database $db — skipping"
    return 1
  fi

  PGPASSWORD="${PGPASSWORD:-postgres}" pg_dump \
    -h "$PG_HOST" \
    -p "$PG_PORT" \
    -U "$PG_USER" \
    "$db" | gzip > "$outfile"

  local size
  size=$(du -h "$outfile" | cut -f1)
  log "  Done: $db ($size)"

  # Verify backup is not empty
  local bytes
  bytes=$(stat -c%s "$outfile" 2>/dev/null || stat -f%z "$outfile" 2>/dev/null || echo 0)
  if [ "$bytes" -lt 100 ]; then
    log "  WARNING: Backup file suspiciously small ($bytes bytes)"
    return 1
  fi

  return 0
}

backup_uploads() {
  local dir="$1"
  local label
  label=$(basename "$dir")
  local tarfile="$BACKUP_DIR/uploads_${label}_${TIMESTAMP}.tar.gz"

  if [ ! -d "$dir" ]; then
    log "Upload directory $dir does not exist — skipping"
    return 0
  fi

  log "Backing up uploads: $dir → $tarfile"

  if $DRY_RUN; then
    log "  [DRY RUN] Would run: tar -czf $tarfile -C $(dirname $dir) $(basename $dir)"
    return 0
  fi

  tar -czf "$tarfile" -C "$(dirname "$dir")" "$(basename "$dir")"

  local size
  size=$(du -h "$tarfile" | cut -f1)
  log "  Done: $label uploads ($size)"
}

cleanup_old_backups() {
  log "Cleaning backups older than $RETAIN_DAYS days"

  if $DRY_RUN; then
    local count
    count=$(find "$BACKUP_DIR" -name "*.gz" -mtime +"$RETAIN_DAYS" 2>/dev/null | wc -l)
    log "  [DRY RUN] Would delete $count files"
    return 0
  fi

  find "$BACKUP_DIR" -name "*.gz" -mtime +"$RETAIN_DAYS" -delete
  log "  Cleanup complete"
}

# ── Main ───────────────────────────────────────────────────────────────────
log "═══ QuantiX/ABRN Backup Starting ═══"

check_dependencies
mkdir -p "$BACKUP_DIR"

ERRORS=0

# Backup databases
for db in "${DATABASES[@]}"; do
  if ! backup_database "$db"; then
    ERRORS=$((ERRORS + 1))
  fi
done

# Backup upload directories
for dir in "${UPLOAD_DIRS[@]}"; do
  if ! backup_uploads "$dir"; then
    ERRORS=$((ERRORS + 1))
  fi
done

# Cleanup
cleanup_old_backups

# Summary
log "═══ Backup Complete ═══"
if [ "$ERRORS" -gt 0 ]; then
  log "WARNING: $ERRORS errors occurred during backup"
  exit 1
else
  log "All backups successful"
  if ! $DRY_RUN; then
    ls -lh "$BACKUP_DIR"/*"${TIMESTAMP}"* 2>/dev/null || true
  fi
fi

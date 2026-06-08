# Step 13 — Database Backup & Recovery

**Parent:** [v4 Production Launch Index](./v4-production-launch-index.md)  
**Phase:** IV — Production Hardening  
**Status:** 🔲 TODO  
**Priority:** CRITICAL — No backups = no production  

---

## Why This Matters

There are zero automated backups. If the disk fails, the database corrupts, or a bad migration drops data — everything is lost. Users' encrypted files, their keys, their accounts. For a zero-knowledge encrypted vault, data loss is catastrophic because **we can't recreate anything from backups of plaintext — there is no plaintext.** The encrypted data IS the data.

## Current State

- **QuantiX database:** `quantixdrive` on PostgreSQL port 5433
- **ABRN database:** `vaultdrive` on PostgreSQL port 5433
- **E2E database:** `vaultdrive_playwright` on Docker PostgreSQL port 5432
- **Backup schedule:** None
- **Tested restores:** Never
- **Offsite copies:** None

## What We Will Build

### 1. Backup Script

**New file:** `scripts/backup.sh`

```bash
#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="/var/backups/quantix-drive"
TIMESTAMP=$(date +%Y-%m-%d_%H%M%S)
RETAIN_DAYS=30
PG_HOST="localhost"
PG_PORT="5433"
PG_USER="postgres"

# Databases to back up
DATABASES=("quantixdrive" "vaultdrive")

mkdir -p "$BACKUP_DIR"

for db in "${DATABASES[@]}"; do
  OUTFILE="$BACKUP_DIR/${db}_${TIMESTAMP}.sql.gz"
  echo "[$(date)] Backing up $db → $OUTFILE"
  
  pg_dump -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" "$db" \
    --format=custom \
    --compress=6 \
    --file="$OUTFILE"
    
  SIZE=$(du -h "$OUTFILE" | cut -f1)
  echo "[$(date)] Done: $db ($SIZE)"
done

# Clean old backups
echo "[$(date)] Cleaning backups older than $RETAIN_DAYS days"
find "$BACKUP_DIR" -name "*.sql.gz" -mtime +$RETAIN_DAYS -delete

echo "[$(date)] Backup complete"
```

### 2. Upload Directory Backup

The `UPLOAD_DIR` contains encrypted file blobs. These must be backed up too:

```bash
UPLOAD_DIRS=(
  "/var/quantix-drive/uploads"    # QuantiX
  "/lamp/www/ABRN-Drive/uploads"  # ABRN
)

for dir in "${UPLOAD_DIRS[@]}"; do
  if [ -d "$dir" ]; then
    TARFILE="$BACKUP_DIR/uploads_$(basename $dir)_${TIMESTAMP}.tar.gz"
    tar -czf "$TARFILE" -C "$(dirname $dir)" "$(basename $dir)"
    echo "[$(date)] Uploads backup: $TARFILE ($(du -h $TARFILE | cut -f1))"
  fi
done
```

### 3. Cron Schedule

```bash
# /etc/cron.d/quantix-backup
# Daily at 03:00 CST
0 3 * * * root /lamp/www/QuantiX-Drive/scripts/backup.sh >> /var/log/quantix-backup.log 2>&1
```

### 4. Restore Procedure

**New file:** `docs/runbooks/database-restore.md`

```bash
# 1. Stop services
sudo systemctl stop quantixdrive abrndrive

# 2. Drop and recreate database
psql -h localhost -p 5433 -U postgres -c "DROP DATABASE quantixdrive"
psql -h localhost -p 5433 -U postgres -c "CREATE DATABASE quantixdrive"

# 3. Restore from backup
pg_restore -h localhost -p 5433 -U postgres -d quantixdrive \
  /var/backups/quantix-drive/quantixdrive_2026-05-23_030000.sql.gz

# 4. Verify row counts
psql -h localhost -p 5433 -U postgres -d quantixdrive \
  -c "SELECT 'users' as t, count(*) FROM users
      UNION ALL SELECT 'files', count(*) FROM files
      UNION ALL SELECT 'folders', count(*) FROM folders"

# 5. Restart services
sudo systemctl start quantixdrive abrndrive

# 6. Smoke test
curl -s https://quantixdrive.filemonprime.net/quantix/api/healthz
```

### 5. Monthly Restore Test

Create a cron job that restores to a test database monthly:

```bash
# Monthly restore verification
0 4 1 * * root /lamp/www/QuantiX-Drive/scripts/verify-backup.sh >> /var/log/quantix-backup-verify.log 2>&1
```

## Verification

| Check | Expected Result |
|-------|----------------|
| `scripts/backup.sh` runs | ✅ Creates `.sql.gz` files |
| Backup size reasonable | ✅ < 100MB for current data |
| Cron job scheduled | ✅ `crontab -l` shows entry |
| Restore to test DB | ✅ All tables populated, row counts match |
| Old backups cleaned | ✅ Files > 30 days removed |
| Services restart after restore | ✅ healthz 200 |

## Files to Create

| File | Purpose |
|------|---------|
| `scripts/backup.sh` | Automated backup script |
| `scripts/verify-backup.sh` | Monthly restore test |
| `docs/runbooks/database-restore.md` | Step-by-step restore procedure |
| `/etc/cron.d/quantix-backup` | Cron schedule |

## Both Drives

- Backup script covers **both** databases (`quantixdrive` and `vaultdrive`)
- Restore procedure documented for each database independently
- Upload directories for both drives are backed up

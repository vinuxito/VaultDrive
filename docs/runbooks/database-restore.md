# Database Restore Runbook

**Last Updated:** 2026-05-23  
**Applies to:** QuantiX Drive + ABRN Drive

---

## Prerequisites

- SSH access to production server
- PostgreSQL client tools (`psql`, `pg_restore`, `gunzip`)
- Access to backup directory: `/var/backups/quantix-drive/`
- `sudo` privileges (for service restart)

---

## 1. Identify the Backup to Restore

```bash
# List available backups (most recent first)
ls -lt /var/backups/quantix-drive/*.sql.gz | head -10
```

Pick the backup closest to your target point-in-time.

---

## 2. Stop Services

```bash
# Stop both services to prevent writes during restore
sudo systemctl stop quantixdrive
sudo systemctl stop abrndrive

# Verify stopped
systemctl is-active quantixdrive   # should say "inactive"
systemctl is-active abrndrive      # should say "inactive"
```

---

## 3. Restore QuantiX Database

```bash
# Variables
BACKUP_FILE="/var/backups/quantix-drive/quantixdrive_2026-XX-XX_XXXXXX.sql.gz"
PG_HOST="localhost"
PG_PORT="5433"
PG_USER="postgres"
DB_NAME="quantixdrive"

# Drop and recreate
PGPASSWORD=postgres psql -h $PG_HOST -p $PG_PORT -U $PG_USER \
  -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$DB_NAME' AND pid <> pg_backend_pid();"
PGPASSWORD=postgres psql -h $PG_HOST -p $PG_PORT -U $PG_USER \
  -c "DROP DATABASE IF EXISTS $DB_NAME"
PGPASSWORD=postgres psql -h $PG_HOST -p $PG_PORT -U $PG_USER \
  -c "CREATE DATABASE $DB_NAME"

# Restore
gunzip -c "$BACKUP_FILE" | PGPASSWORD=postgres psql -h $PG_HOST -p $PG_PORT -U $PG_USER -d $DB_NAME

# Verify row counts
PGPASSWORD=postgres psql -h $PG_HOST -p $PG_PORT -U $PG_USER -d $DB_NAME -c "
  SELECT 'users' AS table_name, count(*) FROM users
  UNION ALL SELECT 'files', count(*) FROM files
  UNION ALL SELECT 'folders', count(*) FROM folders
  UNION ALL SELECT 'share_links', count(*) FROM share_links
  UNION ALL SELECT 'goose_db_version', count(*) FROM goose_db_version
  ORDER BY table_name;
"
```

---

## 4. Restore ABRN Database

```bash
BACKUP_FILE="/var/backups/quantix-drive/vaultdrive_2026-XX-XX_XXXXXX.sql.gz"
DB_NAME="vaultdrive"

# Same procedure as above, with DB_NAME=vaultdrive
PGPASSWORD=postgres psql -h $PG_HOST -p $PG_PORT -U $PG_USER \
  -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$DB_NAME' AND pid <> pg_backend_pid();"
PGPASSWORD=postgres psql -h $PG_HOST -p $PG_PORT -U $PG_USER \
  -c "DROP DATABASE IF EXISTS $DB_NAME"
PGPASSWORD=postgres psql -h $PG_HOST -p $PG_PORT -U $PG_USER \
  -c "CREATE DATABASE $DB_NAME"

gunzip -c "$BACKUP_FILE" | PGPASSWORD=postgres psql -h $PG_HOST -p $PG_PORT -U $PG_USER -d $DB_NAME

# Verify
PGPASSWORD=postgres psql -h $PG_HOST -p $PG_PORT -U $PG_USER -d $DB_NAME -c "
  SELECT 'users' AS table_name, count(*) FROM users
  UNION ALL SELECT 'files', count(*) FROM files
  UNION ALL SELECT 'goose_db_version', count(*) FROM goose_db_version
  ORDER BY table_name;
"
```

---

## 5. Restore Upload Files (if needed)

```bash
# QuantiX uploads
tar -xzf /var/backups/quantix-drive/uploads_uploads_2026-XX-XX_XXXXXX.tar.gz \
  -C /var/quantix-drive/

# ABRN uploads
tar -xzf /var/backups/quantix-drive/uploads_uploads_2026-XX-XX_XXXXXX.tar.gz \
  -C /lamp/www/ABRN-Drive/
```

---

## 6. Restart Services

```bash
sudo systemctl start quantixdrive
sudo systemctl start abrndrive

# Wait and verify
sleep 3

curl -s https://quantixdrive.filemonprime.net/quantix/api/healthz | jq .
curl -s https://abrndrive.filemonprime.net/api/healthz | jq .
```

---

## 7. Smoke Test

```bash
# Try logging in to both
curl -s -X POST https://quantixdrive.filemonprime.net/quantix/api/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test"}' | jq .status

curl -s -X POST https://abrndrive.filemonprime.net/api/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test"}' | jq .status
```

---

## 8. Post-Restore Checklist

- [ ] Both services report `{"status":"ok"}` on healthz
- [ ] User can login on QuantiX
- [ ] User can login on ABRN
- [ ] File list loads correctly
- [ ] Share links resolve correctly
- [ ] Goose version table shows all migrations applied
- [ ] Upload directory contains expected files
- [ ] No error logs in `journalctl -u quantixdrive -n 50`

---

## Rollback

If the restore itself fails, the previous state is lost (database was dropped). This is why offsite backups are critical.

To roll back to the previous binary (not the database):
```bash
sudo cp /usr/local/bin/quantixdrive.prev /usr/local/bin/quantixdrive
sudo systemctl restart quantixdrive
```

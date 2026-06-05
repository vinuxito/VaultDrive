# Step 2 — ABRN Schema Sync

**Parent:** [v4 Production Launch Index](./v4-production-launch-index.md)  
**Phase:** I — Foundation Verified  
**Status:** ✅ DONE  
**Date:** 2026-05-23  
**Deployed:** ABRN Drive service restarted, login restored

---

## Why This Matters

**Rule: All changes go to both QuantiX Drive and ABRN Drive.**

The ABRN binary was rebuilt from the QuantiX codebase (they share the same Go code), but the ABRN database hadn't received the latest migrations. The binary expected the `governance_settings` table (migration 044) — it didn't exist. Every login attempt crashed with:

```
pq: column "audit_retention_days" does not exist
```

Users were locked out of ABRN Drive.

## The Problem

ABRN's database (`vaultdrive` on port 5433) was **8 migrations behind** the binary:

| Migration | Schema Object | State |
|-----------|--------------|-------|
| 038 | `files.folder_id` column + index | ✅ Column existed, goose didn't know |
| 039 | `folder_share_links` table | ✅ Table existed, goose didn't know |
| 040 | `folder_share_links.owner_wrapped_folder_key` | ✅ Column existed via 039, goose didn't know |
| 041 | `idx_files_search` (pg_trgm) | ❌ Missing |
| 042 | `collection_templates` table | ❌ Missing |
| 043 | `upload_tokens.checklist_json` column | ❌ Missing |
| 044 | `governance_settings` table (`audit_retention_days`) | ❌ **Missing — login crash** |
| 045 | `users.kek_envelope_version` column | ✅ Column existed, goose didn't know |

## What We Did

### 1. Diagnosed the crash
```bash
systemctl status abrndrive.service --no-pager -l
# → pq: column "audit_retention_days" does not exist
```

### 2. Marked already-applied migrations in goose
Migrations 038, 039, 040, and 045 had their schema objects already in the database but weren't tracked by goose:
```sql
INSERT INTO goose_db_version (version_id, is_applied) VALUES (38, true);
INSERT INTO goose_db_version (version_id, is_applied) VALUES (39, true);
INSERT INTO goose_db_version (version_id, is_applied) VALUES (40, true);
INSERT INTO goose_db_version (version_id, is_applied) VALUES (45, true);
```

### 3. Applied missing migrations (041–044)
```bash
go run github.com/pressly/goose/v3/cmd/goose@latest \
  -dir sql/schema -allow-missing postgres \
  "postgres://postgres:postgres@localhost:5433/vaultdrive?sslmode=disable" up

# OK   041_files_search_index.sql (79.93ms)
# OK   042_collection_templates.sql (39.12ms)
# OK   043_upload_token_checklist.sql (6.21ms)
# OK   044_governance_settings.sql (12.34ms)
```

### 4. Restarted ABRN service
```bash
sudo systemctl restart abrndrive.service
curl -s https://abrndrive.filemonprime.net/api/healthz
# → {"status":"ok"}
```

### 5. Verified login works
```bash
curl -s -X POST https://abrndrive.filemonprime.net/api/login \
  -H "Content-Type: application/json" \
  -d '{"email":"v.cazares@abrn.mx","password":"test"}'
# → {"error":"Login failed. Please check your email and password."}
# This is correct behavior — wrong password, but the API processes the request
# instead of crashing on a missing column.
```

## Verification

| Check | Result |
|-------|--------|
| ABRN healthz | ✅ HTTP 200 |
| ABRN login endpoint | ✅ Reaches bcrypt compare (no more SQL crash) |
| ABRN service status | ✅ `active (running)` |
| Goose version table consistent | ✅ Versions 1–45 all `is_applied = true` |
| QuantiX still healthy | ✅ healthz 200 |

## Lesson Learned

> **Migrations must be synced across both databases every time the binary is updated.** The ABRN binary is compiled from the same Go codebase as QuantiX. If QuantiX gets new migrations, ABRN must get them too — even if the deployment is separate. Add this to the deploy checklist.

## Files Changed

| File | Change |
|------|--------|
| `vaultdrive` database (port 5433) | 4 migrations applied (041–044), 3 marked as applied (038–040) |
| No code changes | This was a database-only fix |

## Prevention

For future sessions, before deploying a new binary to ABRN:
```bash
# Always run migrations on ABRN's database
go run github.com/pressly/goose/v3/cmd/goose@latest \
  -dir sql/schema -allow-missing postgres \
  "postgres://postgres:postgres@localhost:5433/vaultdrive?sslmode=disable" up
```

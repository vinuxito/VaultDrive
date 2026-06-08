# Database Port Safety — QuantiX-Drive / ABRN-Drive

## Architecture

Both applications store data in **PostgreSQL**. This server runs two postgres instances:

| Instance        | Port   | Purpose                                          |
|-----------------|--------|--------------------------------------------------|
| System Postgres | `5433` | Production databases: `vaultdrive`, `quantixdrive`, `ironclaw`, `naval`, `lunaria`, etc. |
| Docker Postgres | `5432` | QuantiX-Drive docker-compose E2E testing stack    |

## What Happened (2026-05-22)

1. `docker compose up` in `/lamp/www/QuantiX-Drive` started a Docker postgres container mapped to port **5432**.
2. The system postgres (which originally ran on 5432) was pushed to port **5433** by the config change.
3. ABRN-Drive's `.env` had `DB_URL=...localhost:5432/vaultdrive`, so it silently connected to Docker's empty postgres instead of the real one.
4. All 209 users appeared "lost" — they were actually intact on port 5433 the whole time.

## Prevention Rules

### 1. Always use explicit ports in `.env` files

```bash
# ABRN-Drive .env
DB_URL=postgres://postgres:postgres@localhost:5433/vaultdrive?sslmode=disable

# QuantiX-Drive .env (if running outside Docker)  
DB_URL=postgres://postgres:postgres@localhost:5433/quantixdrive?sslmode=disable
```

### 2. Never assume port 5432 is system postgres

Docker's postgres container claims port 5432. Always verify:

```bash
# Check which postgres is on which port
sudo -u postgres psql -c "SHOW port;"       # System postgres
docker compose port postgres 5432           # Docker postgres
```

### 3. Docker Compose port isolation

If you must run Docker postgres alongside the system one, use a non-conflicting port in `docker-compose.yml`:

```yaml
services:
  postgres:
    ports:
      - "5434:5432"   # Map to 5434 to avoid conflicts
```

### 4. Automated database backups

Add a `pg_dump` cron job for the system postgres:

```bash
# /etc/cron.d/vaultdrive-backup
0 3 * * * postgres pg_dump -p 5433 vaultdrive | gzip > /lamp/backups/vaultdrive/vaultdrive_$(date +\%Y\%m\%d).sql.gz 2>&1
```

### 5. Pre-flight check before `docker compose up`

```bash
# Run this before starting Docker containers that use postgres
ss -tlnp | grep 5432
# If system postgres is on 5432, either:
# a) Change docker-compose port mapping, or
# b) Confirm system postgres has already moved to 5433
```

## Quick Recovery Checklist

If you suspect a port collision:

1. `sudo -u postgres psql -c "SHOW port;"` — find system postgres port
2. `sudo -u postgres psql -d vaultdrive -c "SELECT count(*) FROM users;"` — verify data exists
3. Update the `.env` `DB_URL` to use the correct port
4. `sudo systemctl restart abrndrive` (or quantixdrive)

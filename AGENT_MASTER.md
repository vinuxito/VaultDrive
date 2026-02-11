# AGENT MASTER — ABRN Drive Ops & Deployment

> This is the operational runbook for agents with full server access.  
> Last updated: February 03, 2026

## 0) Rules of engagement (do not skip)
- Treat this as production: **backup before changes**, verify after changes.
- Avoid destructive actions unless explicitly requested.
- Prefer idempotent commands and document what you did.
- **Secrets are not stored in this file.** Use your secure secret store / environment config.

---

## 0.1) ABRN Drive Architecture for Agents

### Backend Location: `/lamp/www/ABRN-Drive/`
Contains: Go code, handlers, SQL files, compiled binary
- Files: `main.go`, `handle_*.go`, `middleware_*.go`
- Generated: `internal/database/*.go` (from sqlc)
- Binary: `abrndrive` (executable)
- Port: 8082 (serves both API + static frontend files)

### Frontend Location: `/lamp/www/ABRN-Drive/vaultdrive_client/`
Contains: React 19 + TypeScript source code
- Source: `src/` (pages, components, utils)
- Build: `npm run build` outputs to `dist/`
- Served by: Go backend from `dist/` folder
- Auto-reload: Watch service monitors `dist/` and restarts backend

### Project Structure Overview
```
/lamp/www/ABRN-Drive/              # Project root
├── main.go                        # Go HTTP server
├── handle_*.go                    # API handlers
├── internal/database/             # sqlc-generated code
├── sql/                           # Database files
│   ├── schema/                    # Migrations (*.sql)
│   └── queries/                   # SQL queries for sqlc
└── vaultdrive_client/             # React frontend
    ├── src/                       # TypeScript source
    └── dist/                      # Build output (served by Go)
```

### Critical Architecture Understanding
- **Single Server**: Go binary on port 8082 serves both API endpoints AND React SPA
- **Auto-Reload Flow**: Frontend build → changes in dist/ → watch service detects → restarts Go backend
- **SQL Generation**: Never write SQL directly in Go. Write in `sql/queries/*.sql`, run `sqlc generate`

### Environment Variables Location
**Database Connection**: `/lamp/www/ABRN-Drive/.env`
```bash
DB_URL=postgres://postgres:postgres@localhost:5432/vaultdrive?sslmode=disable
JWT_SECRET=vaultdrive-super-secret-jwt-key-change-this-in-production
PORT=8082
```

---

## 1) Runbook Index

### Daily ops
- Service status & logs
- Deploy frontend changes (auto-reload)
- Deploy backend changes
- DB migrations (PostgreSQL)
- Apache proxy verification

### Troubleshooting
- 503/Bad Gateway
- Frontend not updating
- Auto-reload not firing
- DB connection errors
- Build failures (Go/TypeScript)

### Safety
- Backups
- Rollback plan
- Minimal-downtime reloads

---

---

## 2) Quick Reference

🚀 **[QUICK_REFERENCE.md](./QUICK_REFERENCE.md)** - **Start here for fast-coding!**

One-stop reference for:
| What | Section |
|------|---------|
| Paths & locations | Section 1 |
| Reload workflows | Section 3 |
| API endpoints table | Section 4 |
| Service management | Section 5 |
| Debugging checklist | Section 6 |
| Build errors | Section 6 |
| Architecture flow | Section 9 |
| Common pitfalls | Section 10 |

**Essential one-liners:**
```bash
cd /lamp/www/ABRN-Drive                          # Start here
npm run build                                    # Frontend + auto-reload
go build && sudo systemctl restart abrndrive     # Backend restart
sudo journalctl -u abrndrive -f                  # Backend logs
curl -i http://localhost:8082/abrn/drop/token    # Test API
```

---

## 3) Deployment instructions (merged)

This section is merged from `DEPLOYMENT-INSTRUCTIONS.md` and kept here as the canonical deployment recipe.

# ABRN Drive Deployment Instructions

## Current Status
- ✅ Backend service running with systemd (abrndrive)
- ✅ Auto-reload system active (abrn-watch service)
- ✅ Apache reverse proxy configured (/abrn/ → localhost:8082)
- ✅ Frontend served by Go backend from dist folder
- ✅ PostgreSQL database with migrations
- ✅ **Secure Drop feature active** (write-only file upload via tokens)
  - Frontend: `/drop/:token` (public upload page)
  - API: `/abrn/api/drop/{token}` (JSON data)
  - Component: `vaultdrive_client/src/pages/drop-upload.tsx`
  - Handler: `handle_drop.go`

## Architecture Overview

**Backend:** Go server on port 8082 (serves both API + frontend)
**Frontend:** React 19 + TypeScript built with Vite
**Proxy:** Apache → `/abrn/` → `http://localhost:8082/`
**Auto-Reload:** Watch service monitors `dist/` and restarts backend automatically

## Production Deployment

### Prerequisites

1. **System Packages**
   ```bash
   sudo apt install golang-go postgresql apache2 inotify-tools
   ```

2. **Environment Variables** (in `/etc/environment` or systemd service)
   ```bash
   DB_URL="postgresql://user:pass@localhost:5432/abrndrive?sslmode=disable"
   JWT_SECRET="your-production-secret-key"
   PORT="8082"
   ```

### Initial Deployment

#### 1. Clone Repository
```bash
cd /lamp/www
git clone <repository-url> ABRN-Drive
cd ABRN-Drive
```

#### 2. Database Setup
```bash
# Create database
sudo -u postgres createdb abrndrive

# Run all migrations in order
cd sql/schema
for file in *.sql; do
  echo "Running migration: $file"
  psql "$DB_URL" < "$file"
done
```

#### 3. Backend Build
```bash
cd /lamp/www/ABRN-Drive
make build
# Creates ./abrndrive binary
```

#### 4. Frontend Build
```bash
cd vaultdrive_client
npm install
npm run build
# Creates dist/ folder
```

#### 5. Setup Backend Service
```bash
# Copy service file
sudo cp /path/to/abrndrive.service /etc/systemd/system/

# Enable and start
sudo systemctl daemon-reload
sudo systemctl enable abrndrive
sudo systemctl start abrndrive
sudo systemctl status abrndrive
```

#### 6. Setup Auto-Reload System
```bash
# Ensure watch script is executable
chmod +x /lamp/www/ABRN-Drive/watch-and-reload.sh

# Fix line endings if needed (Windows → Unix)
sed -i 's/\r$//' /lamp/www/ABRN-Drive/watch-and-reload.sh

# Copy watch service file
sudo cp /path/to/abrn-watch.service /etc/systemd/system/

# Enable and start
sudo systemctl daemon-reload
sudo systemctl enable abrn-watch
sudo systemctl start abrn-watch
sudo systemctl status abrn-watch
```

#### 7. Configure Apache Proxy
Add to Apache config (usually `/lamp/apache2/conf/extra/portscanner.conf`):

```apache
# ABRN-Drive (Go Backend serves both API + Frontend on port 8082)
ProxyTimeout 600
ProxyPreserveHost On

# Proxy everything under /abrn/ to the Go server on port 8082
ProxyPass /abrn/ http://localhost:8082/
ProxyPassReverse /abrn/ http://localhost:8082/

<Location /abrn/>
    # CORS headers
    Header set Access-Control-Allow-Origin "*"
    Header set Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS"
    Header set Access-Control-Allow-Headers "Content-Type, Authorization"
</Location>
```

Then restart Apache:
```bash
sudo /lamp/apache2/bin/apachectl restart
```

### Updating Deployment

#### Frontend Changes
```bash
cd /lamp/www/ABRN-Drive/vaultdrive_client

# Make your changes...

# Build (auto-reload will handle backend restart)
npm run build

# Wait 10 seconds for build + auto-reload to complete
# Check logs if needed:
sudo journalctl -u abrn-watch -f
```

**That's it!** The watch service automatically:
1. Detects changes in `dist/` folder
2. Waits 3 seconds (debounce)
3. Restarts backend service
4. Logs the action

#### Backend Changes
```bash
cd /lamp/www/ABRN-Drive
# Make your changes...
# Build
make build
# Restart service
sudo systemctl restart abrndrive
# Verify
sudo systemctl status abrndrive
```

**IMPORTANT: Build Timing Requirements**

- **Frontend Build**: `npm run build` takes ~8-10 seconds
- **Auto-Reload**: Waits ~3 seconds, then restarts backend (additional ~2 seconds)

**WAIT AT LEAST 10 SECONDS AFTER BUILD BEFORE TESTING:**

```bash
cd /lamp/www/ABRN-Drive/vaultdrive_client
npm run build
# Build takes ~8-10 seconds
sleep 10  # Wait for build + auto-reload + backend startup
# Now safe to test
curl http://localhost:8082/abrn/api/files || sudo systemctl status abrndrive
```

#### Combined Workflow
```bash
# Frontend + Backend changes
cd /lamp/www/ABRN-Drive/vaultdrive_client && npm run build
sleep 10
cd .. && go build && sudo systemctl restart abrndrive
```

#### Database Migration
```bash
cd /lamp/www/ABRN-Drive

# Create new migration file
cd sql/schema
touch 017_your_migration.sql

# Write SQL...
# ALTER TABLE files ADD COLUMN ...

# Run migration
psql "$DB_URL" < 017_your_migration.sql

# Regenerate sqlc if queries changed
cd ../..
sqlc generate

# Rebuild backend
make build
sudo systemctl restart abrndrive
```

### SQL Development with sqlc

**CRITICAL RULE:** All SQL queries MUST be written using sqlc.

#### SQL Workflow

1. **Write SQL Query** (in `/lamp/www/ABRN-Drive/sql/queries/`):
   ```sql
   -- name: GetFilesByUser :many
   SELECT * FROM files WHERE owner_id = $1 ORDER BY created_at DESC;
   ```

2. **Generate Go Code**:
   ```bash
   cd /lamp/www/ABRN-Drive
   sqlc generate
   # Creates: internal/database/<query_name>.sql.go
   ```

3. **Rebuild Backend**:
   ```bash
   cd /lamp/www/ABRN-Drive
   go build
   sudo systemctl restart abrndrive
   ```

#### sqlc Required Format (Required)

Each query file MUST start with sqlc comment:
```sql
-- name: QueryName :one/:many/:exec
SELECT ...
```

#### Do NOT
- ❌ Write SQL directly in Go code
- ❌ Use string concatenation for queries
- ❌ Skip `sqlc generate` after editing queries

### Database Connection

**Credentials Location**: `/lamp/www/ABRN-Drive/.env`

**Connection String**:
```bash
DB_URL=postgres://postgres:postgres@localhost:5432/vaultdrive?sslmode=disable
```

**To Connect to Database**:
```bash
# Option 1: export and use psql
cd /lamp/www/ABRN-Drive
export $(cat .env | grep DB_URL)
psql "$DB_URL" -c "SELECT version();"

# Option 2: read directly
psql "postgres://postgres:postgres@localhost:5432/vaultdrive?sslmode=disable" -c "SELECT version();"
```

## Verification Steps

### 1. Check Backend Service
```bash
sudo systemctl status abrndrive
# Should show: active (running)
```

### 2. Check Auto-Reload Service
```bash
sudo systemctl status abrn-watch
# Should show: active (running)

# View live logs
sudo journalctl -u abrn-watch -f
```

### 3. Test API Health
```bash
curl https://dev-app.filemonprime.net/abrn/api/health
# Should return 200 OK
```

### 4. Test Login
```bash
curl -X POST https://dev-app.filemonprime.net/abrn/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":"test@test.com","password":"test123"}'
# Should return JWT token
```

### 5. Test Frontend
Open browser: `https://dev-app.filemonprime.net/abrn/`
Should see ABRN Drive landing page

### 6. Test Auto-Reload
```bash
cd /lamp/www/ABRN-Drive/vaultdrive_client
# Make trivial change to any component
npm run build
# Watch the logs:
sudo journalctl -u abrn-watch -f
# Should see: "Frontend files changed! Restarting abrndrive..."
```

## Troubleshooting

### 503 Service Unavailable
**Symptoms:** Can't access https://dev-app.filemonprime.net/abrn/

**Solutions:**
```bash
# Check backend service status
sudo systemctl status abrndrive

# View backend logs
sudo journalctl -u abrndrive -n 100

# Restart backend
sudo systemctl restart abrndrive

# Check Apache proxy
sudo /lamp/apache2/bin/apachectl configtest
sudo /lamp/apache2/bin/apachectl restart
```

### Frontend Not Updating After Build
**Symptoms:** Built frontend but changes not showing in browser

**Solutions:**
```bash
# 1. Check if auto-reload service is running
sudo systemctl status abrn-watch

# 2. Check auto-reload logs
sudo journalctl -u abrn-watch -n 50

# 3. Manually restart backend (if auto-reload failed)
sudo systemctl restart abrndrive

# 4. Verify dist folder was updated
ls -lh /lamp/www/ABRN-Drive/vaultdrive_client/dist/assets/
# Check file timestamps

# 5. Clear browser cache
# Hard refresh: Ctrl+Shift+R (Windows/Linux) or Cmd+Shift+R (Mac)
```

### Auto-Reload Service Not Working
**Symptoms:** Watch service stopped or not detecting changes

**Solutions:**
```bash
# Check service status
sudo systemctl status abrn-watch

# View detailed logs
sudo journalctl -u abrn-watch -f

# Common fixes:
# 1. Fix CRLF line endings
sed -i 's/\r$//' /lamp/www/ABRN-Drive/watch-and-reload.sh

# 2. Ensure script is executable
chmod +x /lamp/www/ABRN-Drive/watch-and-reload.sh

# 3. Verify inotify-tools installed
dpkg -l | grep inotify-tools
sudo apt install inotify-tools

# 4. Restart service
sudo systemctl restart abrn-watch
```

### Database Connection Errors
**Symptoms:** Backend logs show "connection refused" or "database error"

**Solutions:**
```bash
# 1. Verify PostgreSQL is running
sudo systemctl status postgresql

# 2. Test connection manually
psql "$DB_URL" -c "SELECT version();"

# 3. Check environment variables
echo $DB_URL
echo $JWT_SECRET

# 4. Verify database exists
sudo -u postgres psql -c "\l" | grep abrndrive
```

### CORS Errors
**Symptoms:** Browser console shows "CORS policy blocked"

**Solutions:**
```bash
# 1. Verify Apache headers module enabled
/lamp/apache2/bin/apachectl -M | grep headers

# 2. Check Apache config
grep -A 5 "Location /abrn/" /lamp/apache2/conf/extra/portscanner.conf

# 3. Restart Apache
sudo /lamp/apache2/bin/apachectl restart
```

### Build Errors

#### TypeScript Build Errors
```bash
cd /lamp/www/ABRN-Drive/vaultdrive_client

# Clear node modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Try build again
npm run build
```

#### Go Build Errors
```bash
cd /lamp/www/ABRN-Drive

# Clear build cache
go clean -cache

# Update dependencies
go mod tidy

# Try build again
make build
```

## Monitoring

### View Live Logs

**Backend logs:**
```bash
sudo journalctl -u abrndrive -f
```

**Auto-reload logs:**
```bash
sudo journalctl -u abrn-watch -f
```

**Apache logs:**
```bash
tail -f /lamp/apache2/logs/portscanner_error.log
tail -f /lamp/apache2/logs/portscanner_access.log
```

### Check Service Status Dashboard
```bash
# All services at once
systemctl status abrndrive abrn-watch apache2 postgresql
```

## Security Notes

### Production Environment Variables
Store sensitive variables in systemd service files, not `.env`:

Edit `/etc/systemd/system/abrndrive.service`:
```ini
[Service]
Environment="DB_URL=postgresql://user:pass@localhost/abrndrive"
Environment="JWT_SECRET=production-secret-key-minimum-32-chars"
Environment="PORT=8082"
```

### File Permissions
```bash
# Ensure proper ownership
sudo chown -R www-data:www-data /lamp/www/ABRN-Drive/vaultdrive_client/dist

# Secure database credentials
chmod 600 /etc/systemd/system/abrndrive.service
```

### Firewall
```bash
# Only expose port 80/443 via Apache
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Do NOT expose port 8082 directly
# (Should only be accessible via localhost/Apache proxy)
```

## Additional Resources

- [Development Guide](DEVELOPMENT.md) - Detailed development workflow and component documentation
- [Apache Config](../apache2/conf/extra/portscanner.conf) - Full proxy configuration
- [Systemd Services](/etc/systemd/system/) - abrndrive.service and abrn-watch.service
- [Watch Script](watch-and-reload.sh) - Auto-reload implementation

---

**Last Updated:** February 1, 2026
**Current Version:** ABRN Drive with auto-reload system

---

## 3) Server administration (merged)

This section is merged from `AGENT_MASTER.md` and sanitized to avoid re-printing secrets.

# QUANTIX AGENT MASTER PROMPT
## Complete System Administration & Testing Guide

---

## IDENTITY

You are **Quantix‑Agent**, an autonomous system‑administrator AI living on an Ubuntu Linux box with a custom LAMP stack. You have **full root privileges** and can install any software needed.

**Treat the environment as a production server** – never destroy data unless explicitly asked, and always confirm before destructive operations.

---

## SERVER CONTEXT

### OS & Architecture
- **OS**: Ubuntu (query `lsb_release -a` for exact version)
- **Privileges**: Full root access
- **Location**: `/lamp/www` for application code

### Web Server: Apache
- **Ports**: 80 (HTTP) and 1945 (custom service)
- **Binary**: `/lamp/apache2/bin/apachectl`
- **Config**: `/lamp/apache2/conf/httpd.conf`
- **Modules**: `/lamp/apache2/modules/`
- **Logs**: `/lamp/apache2/logs/`
- **Vhosts**: `/lamp/apache2/conf/extra/` (proxy configs)

**Apache Control:**
```bash
/lamp/apache2/bin/apachectl configtest        # Test config
/lamp/apache2/bin/apachectl restart          # Full restart
kill -HUP $(cat /lamp/apache2/logs/httpd.pid)  # Graceful reload (no downtime)
/lamp/apache2/bin/apachectl -M                # View loaded modules
```

**Proxy Configuration (for Docker apps):**
```apache
<VirtualHost *:80>
    ServerName dev-app.filemonprime.net

    ProxyPass /portscanner/frontend/ http://localhost:3000/portscanner/frontend/
    ProxyPassReverse /portscanner/frontend/ http://localhost:3000/portscanner/frontend/
    ProxyPreserveHost On
</VirtualHost>
```

### PHP: 8.3
- **Binary**: `/lamp/php/bin/php`
- **Invocation**: CLI or Apache
- **CLI Execution**: `/lamp/php/bin/php /lamp/www/file_manager/script.php`
- **Web Execution**: `curl -s https://dev-app.filemonprime.net/file_manager/script.php`

### MySQL
- **Binary**: `/lamp/mysql/bin/mysql`
- **Socket**: `/lamp/mysql/mysql.sock`
- **Root Root Password: <REDACTED — store in secrets manager>
- **Default Database**: `quantix`

**MySQL Commands:**
```bash
# Connection
/lamp/mysql/bin/mysql -u root -p<REDACTED> --socket=/lamp/mysql/mysql.sock

# Direct query
/lamp/mysql/bin/mysql -u root -p<REDACTED> --socket=/lamp/mysql/mysql.sock -e "SHOW DATABASES;"

# Interactive
/lamp/mysql/bin/mysql -u root -p<REDACTED> --socket=/lamp/mysql/mysql.sock quantix
```

**Backup:**
```bash
mkdir -p /tmp/backup-$(date +%s)/mysql
MYSQL_PWD="$SCPFTPPWD" /lamp/mysql/bin/mysqldump -u root --socket=/lamp/mysql/mysql.sock quantix > /tmp/backup-$(date +%s)/mysql/quantix.sql

```

### Application Directories
- **Quantix App**: `/lamp/www/quantix/`
- **Port Scanner**: `/lamp/www/portscanner/` (Docker containers)
- **File Manager**: `/lamp/www/file_manager/`

### Web Interfaces
- **Quantix Console**: `https://dev-app.filemonprime.net/quantix/`
- **Security Scanner**: `https://dev-app.filemonprime.net/portscanner/frontend/`
- **VS Code Remote**: `https://dev-code.filemonprime.net/`

---

## APPLICATIONS

### ABRN Drive - Zero-Knowledge Encrypted Cloud Storage ⭐ ACTIVE
- **Location**: `/lamp/www/ABRN-Drive/`
- **URL**: https://dev-app.filemonprime.net/ABRN-Drive/
- **Backend**: Go 1.24.4, port 8081 → systemd service (`abrndrive.service`)
- **Database**: PostgreSQL 16.11, database: `vaultdrive`
- **Frontend**: React 19 + TypeScript (served via Apache)
- **Architecture**: Zero-knowledge encryption (RSA-2048 + AES-256-GCM)

**Systemd Management**:
```bash
systemctl status abrndrive.service   # Check status
systemctl restart abrndrive.service  # Restart
systemctl start abrndrive.service     # Start
systemctl stop abrndrive.service      # Stop
systemctl enable abrndrive.service    # Enable on boot (already enabled)
```

**Status**: ✅ Production Ready - All 43/43 tests passed

### Port Scanner (DEPRECATED) - Legacy Application
- **Location**: `/lamp/www/portscanner/`
- **Status**: Development only - disabled in production

---

## DOCKER MANAGEMENT (Port Scanner - Legacy Only)

**Docker Commands:**
```bash
cd /lamp/www/portscanner

# Status
docker ps
systemctl status portscanner.service

# Manage
docker compose restart
docker compose up -d --build
docker compose down
docker logs -f portscanner-frontend-1
docker logs -f portscanner-api-1

# Inside container
docker exec portscanner-frontend-1 ls -la /usr/share/nginx/html
```

---

## OPERATIONAL GUIDELINES

### 1. Safety First
- **Before** any destructive operation (delete, drop DB, reinstall service) → **ASK USER CONFIRMATION**
- Echo exact command intended to run
- Never destroy data without explicit request

### 2. Logging
- Capture stdout+stderr of every command
- Return: concise summary + full log in code block (for tickets)

### 3. Idempotency
- Make actions idempotent when possible
- Example: `apt-get install -y package || true` (won't fail on re-run)

### 4. Backup Before Change
- For any config overwrite, create timestamped backup:
  ```bash
  mkdir -p /tmp/backup-$(date +%s)/<service>
  cp -a <config> /tmp/backup-$(date +%s)/<service>/
  ```

### 5. Command Aliases (Always Available)
```bash
php=/lamp/php/bin/php
mysql=/lamp/mysql/bin/mysql
mysqldump=/lamp/mysql/bin/mysqldump
apachectl=/lamp/apache2/bin/apachectl
```

### 6. Network Utilities
Allowed to install/use: `nmap`, `netcat`, `ss`, `curl`, `wget`, `openssl s_client`, `dig`, `host`, `tcpdump`, etc.

### 7. Security Scanning
- Run vulnerability scanners (`nikto`, `wpscan`, `sqlmap`, `clamav`) **ONLY on host services**
- Ports: 80, 1945, MySQL
- **External scanning requires explicit user authorization**

### 8. Reporting (Health Checks)
When requesting a health report, include sections:
- **System Info**: OS version, kernel, packages
- **Service Status**:
- - Apache (ports 80, 1945)
- - PHP version/config
  - MySQL (version, uptime, status)
  - Docker containers
  - Systemd services (portscanner.service)
- **Open Ports**: nmap scan (80, 1945, 3000, 8000, 3306, 443)
- **Apache Config**: vhosts, loaded modules
- **PHP Info**: version, extensions
- **MySQL Health**: connectivity, status
- **Docker Containers**: running, stopped
- **Security Findings**: vulnerabilities if any
- **Recommended Actions**: improvements needed

---

## COMMON TASKS (Ready to Copy)

### Full LAMP + Docker Health Check
```bash
# System & packages
lsb_release -a
uname -a
dpkg -l | grep -E "apache2|php|mysql|docker"

# Apache
/lamp/apache2/bin/apachectl -S
ss -tulnp | grep -E ":80|:1945"

# PHP
/lamp/php/bin/php -i | grep -E "PHP Version|Loaded Configuration File"

# MySQL
/lamp/mysql/bin/mysql -u root -p<REDACTED> --socket=/lamp/mysql/mysql.sock -e "SELECT VERSION(); SHOW GLOBAL STATUS LIKE 'Uptime';"
/lamp/mysql/bin/mysqladmin -u root -pM@chiavell1 --socket=/lamp/mysql/mysql.sock ping

# Docker
docker ps
systemctl status portscanner.service

# Ports
nmap -p 80,1945,3000,8000,3306,443 localhost

# Vhosts
grep -R "ServerName" /lamp/apache2/conf/extra/
```

### Backup Apache Config & Restart
```bash
mkdir -p /tmp/backup-$(date +%s)/apache
cp -a /lamp/apache2/conf/* /tmp/backup-$(date +%s)/apache/

# Edit config (example)
nano /lamp/apache2/conf/extra/portscanner.conf

# Test
/lamp/apache2/bin/apachectl configtest

# Reload (if OK)
kill -HUP $(cat /lamp/apache2/logs/httpd.pid)
```

### Secure MySQL (Run Once)
```bash
/lamp/mysql/bin/mysql -u root -p<REDACTED> --socket=/lamp/mysql/mysql.sock <<EOF
ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY 'Root Root Password: <REDACTED — store in secrets manager>
DELETE FROM mysql.user WHERE User='';
DROP DATABASE IF EXISTS test;
DELETE FROM mysql.db WHERE Db='test' OR Db='test\_%';
FLUSH PRIVILEGES;
EOF
```

### Web App Sanity Test
```bash
# Apache direct
curl -s -o /dev/null -w "%{http_code}" http://localhost/
curl -s -o /dev/null -w "%{http_code}" http://localhost:1945/

# Docker
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/portscanner/frontend/
curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/

# External
curl -s -o /dev/null -w "%{http_code}" https://dev-app.filemonprime.net/portscanner/frontend/
```

### Add Apache Proxy Route
```bash
cat > /lamp/apache2/conf/extra/myapp.conf <<'EOF'
<VirtualHost *:80>
    ServerName dev-app.filemonprime.net

    ProxyPass /myapp/ http://localhost:PORT/
    ProxyPassReverse /myapp/ http://localhost:PORT/
    ProxyPreserveHost On

    ErrorLog /lamp/apache2/logs/myapp_error.log
    CustomLog /lamp/apache2/logs/myapp_access.log combined
</VirtualHost>
EOF

echo "Include /lamp/apache2/conf/extra/myapp.conf" >> /lamp/apache2/conf/httpd.conf
/lamp/apache2/bin/apachectl configtest
kill -HUP $(cat /lamp/apache2/logs/httpd.pid)
```

---

## MCP BROWSER AUTOMATION

### Overview
MCP (Model Context Protocol) provides browser automation for testing web apps:
- Navigate to pages
- Take screenshots
- Interact with elements (click, type, select)
- Inspect page structure
- Debug network requests

### Configuration & Sandbox Issues

**Location**: `~/.config/opencode/opencode.json`

**Current State**: ✅ **FIXED** - Chrome MCP now runs as non-root user (`kvm`) to bypass sandbox restrictions.

**Working Configuration:**

```json
{
  "mcp": {
    "playwright": {
      "type": "local",
      "command": [
        "sudo",
        "-u",
        "kvm",
        "npx",
        "playwright-mcp-server"
      ],
      "enabled": true
    }
  }
}
```

**Setup Steps (Already Completed):**

1. **Installed Chromium for kvm user:**
   ```bash
   sudo -u kvm bash -c 'cd ~ && npx -y playwright install chromium'
   ```

2. **Added sudoers rule (passwordless sudo):**
   ```bash
   echo 'root ALL=(kvm) NOPASSWD: /usr/bin/npx' | sudo tee /etc/sudoers.d/playwright-kvm
   sudo chmod 0440 /etc/sudoers.d/playwright-kvm
   ```

3. **Verified installation:**
   - Chromium installed at: `/home/kvm/.cache/ms-playwright/chromium-1208/`
   - Version: Google Chrome for Testing 145.0.7632.6

**Why This Works:**
Running as non-root user (`kvm`) allows Chrome to properly enable sandboxing without security errors. The sudoers rule allows OpenCode (running as root) to spawn Playwright processes as the `kvm` user seamlessly.

**Fallback - REST API Testing:**
If browser automation is unavailable, REST API testing provides **complete coverage**:

```bash
# Test all functionality via curl
curl -s https://api.your-app.com/api/healthz
curl -X POST https://api.your-app.com/api/login -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","Root Password: <REDACTED — store in secrets manager>
curl -H "Authorization: Bearer $TOKEN" https://api.your-app.com/api/files
```

All ABRN-Drive system features verified via REST API testing (43/43 tests passed).

### Loading the Skill
```bash
skill playwright
```

### Available Browser Tools

**Navigation & Page Control:**
| Tool | Purpose | Parameters |
|------|---------|------------|
| `browser_navigate` | Navigate to URL | `url` (required) |
| `browser_navigate_back` | Go back in history | none |
| `browser_close` | Close current tab/page | none |
| `browser_tabs` | List/create/close/select | `action`, `index` |
| `browser_wait_for` | Wait for text or time | `time`, `text`, `textGone` |

**Page Inspection:**
| Tool | Parameters |
|------|------------|
| `browser_snapshot` | Get accessibility tree (no params) |
| `browser_take_screenshot` | `type`, `filename`, `fullPage`, `element`, `ref` |
| `browser_console_messages` | `level`, `filename` |
| `browser_network_requests` | `includeStatic`, `filename` |

**Element Interaction:**
| Tool | Required Parameters |
|------|-------------------|
| `browser_click` | `ref` (element, doubleClick, button, modifiers optional) |
| `browser_type` | `ref`, `text` (submit, slowly, element optional) |
| `browser_hover` | `ref` (element optional) |
| `browser_select_option` | `ref`, `values` (element optional) |
| `browser_drag` | `startRef`, `endRef`, `startElement`, `endElement` |
| `browser_press_key` | `key` |
| `browser_fill_form` | `fields` (array) |
| `browser_handle_dialog` | `accept` (promptText optional) |

**Advanced:**
| Tool | Purpose |
|------|---------|
| `browser_evaluate` | Run JavaScript expression |
| `browser_run_code` | Execute Playwright code snippet |
| `browser_resize` | Resize window (`width`, `height`) |
| `browser_file_upload` | Upload files (`paths`) |
| `browser_install` | Install browser if needed |

### Usage Pattern (7-Step Workflow)

1. **Snapshot First**: `browser_snapshot` → get page structure and refs
2. **Navigate**: `browser_navigate` with target URL
3. **Wait**: `browser_wait_for` (time: 1-3 seconds for page load)
4. **Re-snapshot**: Get updated page structure
5. **Interact**: Click/type using refs from snapshot
6. **Verify**: Screenshot + console check
7. **Cleanup**: `browser_close`

### Example Workflow (NeonFS Test)
```javascript
// Load skill first
skill playwright

// 1. Navigate
skill_mcp({
  mcp_name: "playwright",
  tool_name: "browser_navigate",
  arguments: { url: "https://dev-app.filemonprime.net/file_manager/" }
})

// 2. Wait
skill_mcp({
  mcp_name: "playwright",
  tool_name: "browser_wait_for",
  arguments: { time: 2 }
})

// 3. Snapshot
skill_mcp({
  mcp_name: "playwright",
  tool_name: "browser_snapshot"
})

// 4. Click button
skill_mcp({
  mcp_name: "playwright",
  tool_name: "browser_click",
  arguments: {
    ref: "3-2",
    element: "New folder button"
  }
})

// 5. Type text
skill_mcp({
  mcp_name: "playwright",
  tool_name: "browser_type",
  arguments: {
    ref: "4-1",
    text: "test-folder"
  }
})

// 6. Press Enter
skill_mcp({
  mcp_name: "playwright",
  tool_name: "browser_press_key",
  arguments: { key: "Enter" }
})

// 7. Verify
skill_mcp({
  mcp_name: "playwright",
  tool_name: "browser_take_screenshot",
  arguments: { type: "png", filename: "result.png" }
})

skill_mcp({
  mcp_name: "playwright",
  tool_name: "browser_console_messages",
  arguments: { level: "error" }
})

// 8. Cleanup
skill_mcp({
  mcp_name: "playwright",
  tool_name: "browser_close"
})
```

### Important Notes

**Element References:**
- `ref` values come from `browser_snapshot` output
- Always use exact refs from most recent snapshot
- Re-snapshot after page updates

**Timing:**
- `time: 1` to `time: 3` seconds typical
- Use `text` or `textGone` to wait for specific content

**Screenshots vs Snapshots:**
- Screenshot: Visual image, good for documentation
- Snapshot: Structured tree, better for automation (can base actions on it)

### Troubleshooting

**Browser Won't Launch** ("sandboxing failed"):
```json
"command": ["npx", "playwright-mcp-server", "--no-sandbox", "--disable-setuid-sandbox"]
```

**Elements Not Found:**
- Re-snapshot after page changes
- Check if element is in viewport
- Wait for dynamic content with `browser_wait_for`

**Timeout Errors:**
- Increase wait times
- Wait for specific text: `text: "Content loaded"`

---

## INTERACTION STYLE

### When User Asks For Something
1. Acknowledge request
2. Summarize exact command(s) to run
3. Ask for confirmation **unless user said "go ahead"**
4. After confirmation: execute + capture output
5. Return output in code block + human-readable interpretation

### When User Requests Report
Generate markdown with sections listed under **Reporting** above, attach relevant logs.

### When Installing New Tool
Verify package name, run `apt-get update && apt-get install -y <pkg>`, report version.

---

## QUICK START CHEATSHEET

### Accessing the System
```bash
# Web URLs
- Quantix Console: https://dev-app.filemonprime.net/quantix/
- Port Scanner: https://dev-app.filemonprime.net/portscanner/frontend/
- VS Code: https://dev-code.filemonprime.net/

# MySQL
/lamp/php/bin/php -i | grep -E "PHP Version|Loaded Configuration File"
/lamp/mysql/bin/mysql -u root -p<REDACTED> --socket=/lamp/mysql/mysql.sock

# Apache
/lamp/apache2/bin/apachectl configtest
kill -HUP $(cat /lamp/apache2/logs/httpd.pid)
```

### CLI vs Web Execution
Both produce identical results:
```bash
# CLI (development/debugging)
/lamp/php/bin/php /lamp/www/quantix/script.php

# Web (integration testing)
curl -s https://dev-app.filemonprime.net/quantix/script.php
```

### Docker Management
```bash
# Port Scanner
cd /lamp/www/portscanner
docker ps
docker compose restart
docker compose up -d --build
docker logs -f portscanner-frontend-1
systemctl status portscanner.service
```

---

## CONSTANTS & PATHS REFERENCE

### Paths
| Component | Path |
|-----------|------|
| Apache binary | `/lamp/apache2/bin/apachectl` |
| Apache config | `/lamp/apache2/conf/httpd.conf` |
| Apache vhosts | `/lamp/apache2/conf/extra/` |
| Apache logs | `/lamp/apache2/logs/` |
| PHP binary | `/lamp/php/bin/php` |
| MySQL binary | `/lamp/mysql/bin/mysql` |
| MySQL socket | `/lamp/mysql/mysql.sock` |
| Quantix app | `/lamp/www/quantix/` |
| Port scanner | `/lamp/www/portscanner/` |
| File manager | `/lamp/www/file_manager/` |
| OpenCode config | `~/.config/opencode/opencode.json` |

### Ports
| Service | Port |
|---------|------|
| Apache HTTP | 80 |
| Apache custom | 1945 |
| Port scanner frontend | 3000 |
| Port scanner backend | 8000 |
| MySQL | 3306 |
| HTTPS | 443 |

### Services
| Service | Status Command |
|---------|----------------|
| Apache | `/lamp/apache2/bin/apachectl -S` |
| MySQL | `systemctl status lamp-mysql` |
| Port Scanner | `systemctl status portscanner.service` |
| Docker | `docker ps` |

### Credentials
| Item | Value |
|------|-------|
| MySQL root | `Root Root Password: <REDACTED — store in secrets manager>

---

## FILE OPERATIONS CHECKLIST

Before ANY file modification:
```bash
# 1. Create backup
mkdir -p /tmp/backup-$(date +%s)/<service>
cp -a <file> /tmp/backup-$(date +%s)/<service>/

# 2. Confirm with user
echo "About to modify <file>. Proceed? (y/n)"

# 3. If yes, execute
# 4. Test (if applicable)
# 5. Reload service (if applicable)
```

---

## EXAMPLE CONVERSATION

**User**: "Run a full health‑check of the LAMP stack and give me a markdown report."

**Agent**: 
```
I'll execute:
1. Gather OS and package info
2. Show Apache vhost list and listening sockets (80, 1945)
3. Print PHP version and loaded extensions
4. Query MySQL version, uptime, ping
5. Check Docker containers and systemd services
6. Run nmap on localhost: 80, 1945, 3000, 8000, 3306, 443
7. Assemble results into report

Shall I proceed? (yes/no)
```

**User**: "yes"

**Agent**: *(runs commands, captures output, builds report, returns)*

---

## SKILLS TO USE

For web application testing, always load:
```bash
skill playwright
```

Then use:
```bash
skill_mcp({
  mcp_name: "playwright",
  tool_name: <tool_name>,
  arguments: <parameters>
})
```

---

## BEST PRACTICES

1. **Snapshot first** - Get page structure before browser interactions
2. **Use element descriptions** - Include human-readable `element` in `skill_mcp`
3. **Wait for stability** - Give pages 1-3 seconds to load dynamic content
4. **Check console errors** - Validate JavaScript execution after page actions
5. **Automate cleanup** - Close browser sessions after completing tests
6. **Save evidence** - Use screenshots and network logs for debugging

---

## LAST UPDATED
January 25, 2026

**Tested On**: 
- ABRN Drive v1.0 - Zero-Knowledge Encrypted Storage
- Ubuntu LAMP with Apache, Go 1.24.4, PostgreSQL 16.11
- Systemd services (Auto-start enabled)
- REST API testing (Complete coverage)

**Browser Automation Note:**
- Chrome MCP has sandbox limitations when running as root
- REST API testing provides complete E2E coverage
- All 43/43 tests passed without Chrome browser automation

---

## 4) Golden commands cheat sheet (fast copy/paste)

### Services
```bash
sudo systemctl status abrndrive abrn-watch
sudo systemctl restart abrndrive
sudo systemctl restart abrn-watch
sudo journalctl -u abrndrive -n 200 --no-pager
sudo journalctl -u abrn-watch -n 200 --no-pager
```

### Apache proxy sanity
```bash
/lamp/apache2/bin/apachectl configtest
/lamp/apache2/bin/apachectl -S
sudo /lamp/apache2/bin/apachectl restart
tail -n 200 /lamp/apache2/logs/portscanner_error.log
tail -n 200 /lamp/apache2/logs/portscanner_access.log
```

### Local health checks
```bash
curl -i http://localhost:8082/ | head
curl -i http://localhost:8082/api/health | head
curl -i https://dev-app.filemonprime.net/abrn/api/health | head
```

### Frontend deploy (production flow)
```bash
cd /lamp/www/ABRN-Drive/vaultdrive_client
npm ci || npm install
npm run build
# wait 3–5s, then confirm:
sudo journalctl -u abrn-watch -n 50 --no-pager
```

### Backend deploy (production flow)
```bash
cd /lamp/www/ABRN-Drive
make build
sudo systemctl restart abrndrive
sudo systemctl status abrndrive --no-pager
```

### DB quick check
```bash
sudo systemctl status postgresql --no-pager
psql "$DB_URL" -c "SELECT now(), version();"
```

---

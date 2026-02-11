# ABRN Drive - Operator Quick Reference

> **Fast-lookup guide for coding, debugging, reloading, and rebuilding**  
> Last updated: February 3, 2026

---

## 1) Critical Paths (Copy-Paste Ready)

| What | Path |
|------|------|
| **Project root** | `/lamp/www/ABRN-Drive` |
| **Test User** | filemon@abrn.mx / 986532 |
| **Backend binary** | `/lamp/www/ABRN-Drive/abrndrive` |
| **Frontend source** | `/lamp/www/ABRN-Drive/vaultdrive_client` |
| **Frontend build output** | `/lamp/www/ABRN-Drive/vaultdrive_client/dist` |
| **Apache binary** | `/lamp/apache2/bin/apachectl` |
| **Apache config** | `/lamp/apache2/conf/extra/portscanner.conf` |
| **Apache logs** | `/lamp/apache2/logs/` |
| **Systemd services** | `/etc/systemd/system/abrndrive.service` |
| **Service override** | `/etc/systemd/system/abrndrive.service.d/override.conf` |
| **Watch script** | `/lamp/www/ABRN-Drive/watch-and-reload.sh` |

---

## 2) Ports & Services

| Service | Port | Status Check |
|---------|------|--------------|
| **Backend** | 8082 | `curl -i http://localhost:8082/` |
| **Proxy entry** | 80 (HTTP), 443 (HTTPS) | `curl -i https://dev-app.filemonprime.net/abrn/` |
| **PostgreSQL** | 5432 | `psql "$DB_URL" -c "SELECT version();"` |

---

## 3) One-Command Reload Workflows

### Frontend Changes (Auto-Reload Enabled)
```bash
cd /lamp/www/ABRN-Drive/vaultdrive_client
npm run build
# Wait 3-5 seconds - auto-reload restarts backend automatically
# Verify: sudo journalctl -u abrn-watch -n 10
```

### Backend Changes
```bash
cd /lamp/www/ABRN-Drive
go build
sudo systemctl restart abrndrive
# Verify: sudo systemctl status abrndrive
```

### Both Frontend + Backend
```bash
cd /lamp/www/ABRN-Drive/vaultdrive_client && npm run build && cd .. && go build && sudo systemctl restart abrndrive
```

### Apache Config Changes
```bash
# Test config first
/lamp/apache2/bin/apachectl configtest

# Graceful reload (no downtime)
kill -HUP $(cat /lamp/apache2/logs/httpd.pid)

# Or full restart
sudo /lamp/apache2/bin/apachectl restart
```

---

## 4) API Endpoints Reference

### Authentication
| Method | Endpoint | Auth Required |
|--------|----------|---------------|
| POST | `/abrn/api/register` | No |
| POST | `/abrn/api/login` | No |
| GET | `/abrn/api/users/me` | JWT Bearer |

### Files
| Method | Endpoint | Auth Required |
|--------|----------|---------------|
| POST | `/abrn/api/files/upload` | JWT Bearer |
| GET | `/abrn/api/files` | JWT Bearer |
| GET | `/abrn/api/files/{id}/download` | JWT Bearer |
| POST | `/abrn/api/files/{id}/share` | JWT Bearer |

### **Secure Drop (NEW - No Auth Required)**
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/abrn/api/drop/{token}` | Returns token info (JSON) |
| GET | `/abrn/drop/{token}` | **Frontend upload page (HTML)** |
| POST | `/abrn/api/drop/{token}/upload` | Upload encrypted file |
| POST | `/abrn/api/drop/{token}/done` | Deactivate link |
| GET | `/abrn/api/drop/{token}/owner-info` | Get owner's public key |
| POST | `/abrn/api/drop/create` | Create new token (auth required) |
| GET | `/abrn/api/drop/tokens` | List user's tokens (auth required) |

### Frontend Routes (React Router)
| Route | Component | Auth |
|-------|-----------|------|
| `/` | Home | No |
| `/login` | Login Form | No |
| `/files` | Files Page | Yes |
| `/shared` | Shared Files | Yes |
| `/groups` | Groups | Yes |
| `/drop/:token` | **Drop Upload Page** | No |

---

## 5) Service Management

### Check Status (All Services)
```bash
sudo systemctl status abrndrive abrn-watch apache2 postgresql
```

### Restart Services
```bash
# Backend
sudo systemctl restart abrndrive

# Auto-reload watcher
sudo systemctl restart abrn-watch

# Apache
sudo /lamp/apache2/bin/apachectl restart

# PostgreSQL
sudo systemctl restart postgresql
```

### View Logs
```bash
# Backend (live)
sudo journalctl -u abrndrive -f

# Watch service (live)
sudo journalctl -u abrn-watch -f

# Apache errors
tail -f /lamp/apache2/logs/portscanner_error.log

# Apache access (filter for errors)
grep -i "error\|500\|503" /lamp/apache2/logs/portscanner_access.log | tail -50
```

---

## 6) Debugging Checklist

### Problem: Frontend Not Updating
```bash
# 1. Check if build succeeded
ls -lh /lamp/www/ABRN-Drive/vaultdrive_client/dist/assets/

# 2. Check auto-reload triggered
sudo journalctl -u abrn-watch -n 20

# 3. Check backend started with new build
sudo journalctl -u abrndrive -n 20 | grep "Starting"

# 4. Force restart backend
sudo systemctl restart abrndrive

# 5. Clear browser cache (Ctrl+Shift+R)
```

### Problem: 404/500 Errors on API
```bash
# 1. Test directly on localhost
curl -i http://localhost:8082/abrn/api/drop/testtoken

# 2. Check backend logs
sudo journalctl -u abrndrive -n 50

# 3. Check binary timestamp
ls -lh /lamp/www/ABRN-Drive/abrndrive

# 4. Rebuild if old
cd /lamp/www/ABRN-Drive && go build && sudo systemctl restart abrndrive
```

### Problem: Apache Proxy Issues
```bash
# 1. Test backend directly
curl -i http://localhost:8082/abrn/

# 2. Test via Apache
curl -i https://dev-app.filemonprime.net/abrn/

# 3. Check Apache config
cat /lamp/apache2/conf/extra/portscanner.conf | grep -A10 "abrn"

# 4. Test Apache config syntax
/lamp/apache2/bin/apachectl configtest

# 5. Restart Apache gracefully
kill -HUP $(cat /lamp/apache2/logs/httpd.pid)
```

### Problem: Build Errors

**Go Build:**
```bash
# Clear cache and rebuild
cd /lamp/www/ABRN-Drive
go clean -cache
go build -v
```

**Frontend Build:**
```bash
cd /lamp/www/ABRN-Drive/vaultdrive_client
rm -rf node_modules package-lock.json dist
npm install
npm run build
```

---

## 7) Database Operations

### Connection String
```bash
# Check if DB_URL is set
echo $DB_URL

# If not set, set it (for current session)
export DB_URL="postgresql://<user>:<password>@localhost:5432/<dbname>?sslmode=disable"
```

### Run Migrations
```bash
cd /lamp/www/ABRN-Drive/sql/schema
for file in *.sql; do
  echo "Running: $file"
  psql "$DB_URL" < "$file"
done
```

### Common Queries
```sql
-- Check tables
\dt

-- Check upload tokens
SELECT token, name FROM upload_tokens 
LEFT JOIN folders ON upload_tokens.target_folder_id = folders.id 
LIMIT 5;

-- Check files
SELECT filename, filepath, created_at FROM files LIMIT 5;
```

---

## 8) Test User Credentials

**For testing purposes, always use:**
- **Username/Email**: filemon@abrn.mx
- **Password**: 986532

This user is pre-created in the database and cannot be deleted.

---

## 9) Testing APIs (curl)

### Get Auth Token
```bash
curl -s -X POST https://dev-app.filemonprime.net/abrn/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":"your@email.com","password":"yourpassword"}' | jq '.access_token'
```

### Test Drop Token Info
```bash
TOKEN="your-drop-token-here"
curl -s https://dev-app.filemonprime.net/abrn/api/drop/$TOKEN | jq .
```

### Test Drop Frontend
```bash
# Should return HTML (React app)
curl -s https://dev-app.filemonprime.net/abrn/drop/$TOKEN | head -10

# Should return JSON (API)
curl -s https://dev-app.filemonprime.net/abrn/api/drop/$TOKEN | jq .
```

---

## 9) Architecture Flow Diagram

```
User Browser
    ↓
https://dev-app.filemonprime.net/abrn/drop/{token}
    ↓ [Apache Proxy]
/lamp/apache2/conf/extra/portscanner.conf
    ↓
http://localhost:8082/abrn/drop/{token}
    ↓ [Go Server]
main.go: mux.Handle("GET /abrn/{path...}")
    ↓
vaultdrive_client/dist/index.html (React SPA)
    ↓ [React Router]
/drop/:token → DropUpload component
    ↓
fetch("/abrn/api/drop/{token}") → JSON response
```

---

## 11) Common Pitfalls & Solutions

### Pitfall: SPA Route Returns 404
**Cause**: Backend not serving `index.html` for unmatched routes

**Solution**: Ensure SPA catch-all exists in `main.go`:
```go
mux.Handle("GET /abrn/{path...}", ...)
```

### Pitfall: API Returns sql.Null* in JSON
**Cause**: Not extracting values before marshaling

**Solution**:
```go
filesLimit := ""
if uploadToken.MaxFiles.Valid {
    filesLimit = fmt.Sprintf("%d", uploadToken.MaxFiles.Int32)
}
```

### Pitfall: JSON instead of HTML on Frontend Route
**Cause**: API handler registered before SPA catch-all

**Use separate paths:**
- API: `/abrn/api/drop/{token}` (returns JSON)
- Frontend: `/abrn/drop/{token}` (serves HTML)

### Pitfall: Auto-Reload Not Firing
**Check:**
```bash
sudo systemctl status abrn-watch

# Fix:
chmod +x /lamp/www/ABRN-Drive/watch-and-reload.sh
sed -i 's/\r$//' /lamp/www/ABRN-Drive/watch-and-reload.sh
sudo systemctl restart abrn-watch
```

---

## 12) Environment Variables

| Variable | Location | Notes |
|----------|----------|-------|
| `DB_URL` | Systemd service, `/etc/environment` | PostgreSQL connection string |
| `JWT_SECRET` | Systemd service | Secret minimum 32 chars |
| `PORT` | Systemd service | Default: 8082 |

**Set in service override:**
```ini
# /etc/systemd/system/abrndrive.service.d/override.conf
[Service]
Environment="DB_URL=postgresql://..."
Environment="JWT_SECRET=..."
Environment="PORT=8082"
```

---

## 13) Quick Health Check

```bash
#!/bin/bash
echo "=== ABRN Drive Health Check ==="
echo ""
echo "Services:"
sudo systemctl status abrndrive abrn-watch | grep -E "Active|Loaded" | head -4
echo ""
echo "Backend API:"
curl -s -o /dev/null -w "  HTTP: %{http_code}\n" http://localhost:8082/
echo ""
echo "Apache Proxy:"
curl -s -o /dev/null -w "  HTTP: %{http_code}\n" https://dev-app.filemonprime.net/abrn/
echo ""
echo "Database:"
psql "$DB_URL" -c "SELECT COUNT(*) FROM upload_tokens;" 2>/dev/null | grep -v "^$"
echo ""
echo "Recent errors in logs:"
grep -i error /lamp/apache2/logs/portscanner_error.log | tail -3 2>/dev/null || echo "  None"
```

---

## 14) File Structure Reference

```
/lamp/www/ABRN-Drive/
├── main.go                    # HTTP server & routing
├── handle_*.go                # API endpoint handlers
│   ├── handle_drop.go         # NEW: Secure Drop handlers
│   ├── handle_folders.go      # Folder management
│   ├── handle_files.go        # File operations
│   ├── handle_login.go        # Authentication
│   └── handle_user_create.go  # User registration
├── middleware_*.go            # HTTP middleware
├── internal/database/         # sqlc generated code
├── sql/
│   ├── schema/                # Migrations (*.sql)
│   │   ├── 018_upload_tokens.sql  # NEW: Drop tokens table
│   │   ├── 017_*.sql
│   │   └── ...
│   └── queries/               # SQL queries (*.sql)
│       └── upload_tokens.sql  # NEW: Drop token queries
├── vaultdrive_client/         # React frontend
│   ├── src/
│   │   ├── pages/
│   │   │   ├── drop-upload.tsx       # NEW: Drop upload page
│   │   │   ├── files.tsx
│   │   │   ├── files.tsx             # "Create Upload Link" modal
│   │   │   └── ...
│   │   ├── components/
│   │   └── App.tsx              # React Router config
│   ├── dist/                    # Build output (served by Go)
│   └── package.json
├── abrndrive                   # Compiled binary
├── watch-and-reload.sh         # Auto-reload script
└── README.md                   # Main documentation
```

---

## 15) Session Commands (Copy-Paste)

**Start coding:**
```bash
cd /lamp/www/ABRN-Drive
```

**Full rebuild:**
```bash
cd vaultdrive_client && npm run build && cd .. && go build && sudo systemctl restart abrndrive
```

**Check all logs:**
```bash
sudo journalctl -u abrndrive -u abrn-watch -n 50 --no-pager
```

**Apache proxy test:**
```bash
curl -i https://dev-app.filemonprime.net/abrn/drop/testtoken123
```

**Local backend test:**
```bash
curl -i http://localhost:8082/abrn/drop/testtoken123
```

**API test (should return JSON):**
```bash
curl -i http://localhost:8082/abrn/api/drop/testtoken123
```

---

**Full documentation:** See [README.md](./README.md) and [AGENT_MASTER.md](./AGENT_MASTER.md)

---

**Last Updated:** February 3, 2026  
**Version:** ABRN Drive v1.0 with Secure Drop feature
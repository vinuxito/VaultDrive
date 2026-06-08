# Step 19 — Monitoring & Health Dashboard

**Parent:** [v4 Production Launch Index](./v4-production-launch-index.md)  
**Phase:** VI — DevOps & CI/CD  
**Status:** 🔲 TODO  
**Priority:** MEDIUM — Visibility into production  

---

## Why This Matters

If the app goes down at 3am, how would you know? Right now: you wouldn't. Until a user complains. Production means monitoring: uptime checks, error rates, latency percentiles, disk space, database connection pool, and alerts that wake you up.

## What We Will Build

### 1. Enhanced Health Endpoint

**File:** `main.go` — extend `/api/healthz`

```go
// Current: {"status":"ok"}
// Enhanced:
{
  "status": "ok",
  "version": "28e068e",
  "uptime": "12h34m",
  "database": "connected",
  "db_pool": { "active": 3, "idle": 7, "max": 25 },
  "disk": { "uploads_dir_mb": 1234, "free_mb": 45678 },
  "go_routines": 12,
  "memory_mb": 45
}
```

Add a `/_/health` deep health check that actually pings the database:
```go
func deepHealthCheck(w http.ResponseWriter, r *http.Request) {
    // Ping database
    if err := db.PingContext(r.Context()); err != nil {
        json.NewEncoder(w).Encode(map[string]string{"status": "unhealthy", "error": err.Error()})
        return
    }
    // Check disk space
    // Check upload directory accessible
    // Return detailed status
}
```

### 2. Uptime Monitoring

**Option A: Free External Monitor**
- [UptimeRobot](https://uptimerobot.com) (free tier: 50 monitors, 5-min intervals)
- Monitor both URLs:
  - `https://quantixdrive.filemonprime.net/quantix/api/healthz`
  - `https://abrndrive.filemonprime.net/api/healthz`
- Alert via email + Telegram/Slack on downtime

**Option B: Self-Hosted**
- Simple cron script that checks healthz every minute
- Sends notification on failure

### 3. Error Logging

**File:** `main.go` — structured logging

```go
// Replace log.Printf with structured JSON logging
type LogEntry struct {
    Timestamp string `json:"ts"`
    Level     string `json:"level"`
    Method    string `json:"method"`
    Path      string `json:"path"`
    Status    int    `json:"status"`
    Duration  string `json:"duration"`
    IP        string `json:"ip"`
    Error     string `json:"error,omitempty"`
}
```

Write to `/var/log/quantixdrive/access.log` and `/var/log/quantixdrive/error.log`.

### 4. Disk Space Alert

```bash
# scripts/disk-check.sh
THRESHOLD=90
USAGE=$(df /var/quantix-drive/uploads --output=pcent | tail -1 | tr -d ' %')
if [ "$USAGE" -gt "$THRESHOLD" ]; then
  echo "ALERT: Disk usage at ${USAGE}% on $(hostname)" | \
    mail -s "Disk Alert" v.cazares@abrn.mx
fi
```

### 5. Log Rotation

```bash
# /etc/logrotate.d/quantixdrive
/var/log/quantixdrive/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    postrotate
        systemctl reload quantixdrive
    endscript
}
```

## Verification

| Check | Expected Result |
|-------|----------------|
| `/api/healthz` returns detailed status | ✅ Version, uptime, DB pool |
| `/_/health` deep check | ✅ DB ping, disk check |
| UptimeRobot configured | ✅ Both URLs monitored |
| Alert on downtime | ✅ Email/notification received |
| Log rotation active | ✅ Logs compressed after 1 day |
| Disk alert at 90% | ✅ Email sent |

## Files to Change/Create

| File | Change |
|------|--------|
| `main.go` | Enhanced healthz, deep health check, structured logging |
| `scripts/disk-check.sh` (new) | Disk space alert |
| `/etc/logrotate.d/quantixdrive` (new) | Log rotation config |
| UptimeRobot (external) | Monitor configuration |

## Both Drives

- Health endpoint changes are shared (same binary)
- UptimeRobot monitors both URLs independently
- Log rotation configured for both services

# v9 — Step 3: Live Monitoring Dashboard
> **Operation Go Live** | Step 3 of 7
> **Index**: [v9-go-live-index.md](./v9-go-live-index.md)
> **Estimated Time**: ~2 hours
> **Priority**: 🟠 High — Required for production ops confidence

---

## Problem Statement

The backend already exposes a `/healthz` endpoint that returns JSON uptime and version data. But there are two problems:

1. There is **no front-end status panel** — no operator can look at the running app and see if the server is healthy.
2. `/healthz` returns only uptime. There are **no metrics** — no database pool stats, no request counts, no memory pressure indicators.

Before going to production, ops/devops need to answer "is it up?" and "is it struggling?" without SSH-ing into the server. This step adds both.

---

## What We Build

### Backend: Extend `/healthz` + add `/metrics`

**File: `handle_v1_core.go`** (or wherever `/healthz` lives)

Add the following fields to the `/healthz` response:
```json
{
  "status": "ok",
  "uptime_seconds": 43210,
  "version": "v9.0.0",
  "build_time": "2026-07-10T00:00:00Z",
  "db_ping_ms": 2,
  "goroutines": 47,
  "memory_mb": 84.3,
  "open_connections": 12,
  "requests_total": 18432,
  "errors_last_minute": 0
}
```

**Add simple atomic counters to `main.go`:**
```go
import (
  "runtime"
  "sync/atomic"
)

var totalRequests int64
var totalErrors int64

// In middleware, wrap all handlers:
func metricsMiddleware(next http.Handler) http.Handler {
  return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
    atomic.AddInt64(&totalRequests, 1)
    rw := &statusRecorder{ResponseWriter: w, status: 200}
    next.ServeHTTP(rw, r)
    if rw.status >= 500 {
      atomic.AddInt64(&totalErrors, 1)
    }
  })
}
```

**Add `/metrics` endpoint in `handle_v1_core.go`:**
```go
// Plain text Prometheus-compatible format (no external library needed)
func handleMetrics(w http.ResponseWriter, r *http.Request) {
  var mem runtime.MemStats
  runtime.ReadMemStats(&mem)
  
  w.Header().Set("Content-Type", "text/plain; charset=utf-8")
  fmt.Fprintf(w, "# HELP vaultdrive_requests_total Total HTTP requests\n")
  fmt.Fprintf(w, "vaultdrive_requests_total %d\n", atomic.LoadInt64(&totalRequests))
  fmt.Fprintf(w, "# HELP vaultdrive_errors_total Total 5xx errors\n")
  fmt.Fprintf(w, "vaultdrive_errors_total %d\n", atomic.LoadInt64(&totalErrors))
  fmt.Fprintf(w, "# HELP vaultdrive_goroutines Current goroutine count\n")
  fmt.Fprintf(w, "vaultdrive_goroutines %d\n", runtime.NumGoroutine())
  fmt.Fprintf(w, "# HELP vaultdrive_memory_bytes Heap allocated bytes\n")
  fmt.Fprintf(w, "vaultdrive_memory_bytes %d\n", mem.HeapAlloc)
}
```

Register it in `main.go`:
```go
mux.HandleFunc("/metrics", handleMetrics)
```

---

### Frontend: `StatusPanel` component

**NEW: `vaultdrive_client/src/components/ui/status-panel.tsx`**

```tsx
import useSWR from "swr";
import { Activity, Database, Cpu, Clock, Server } from "lucide-react";

interface HealthData {
  status: string;
  uptime_seconds: number;
  version: string;
  db_ping_ms: number;
  goroutines: number;
  memory_mb: number;
  requests_total: number;
  errors_last_minute: number;
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${d}d ${h}h ${m}m`;
}

export function StatusPanel() {
  const { data, error, isLoading } = useSWR<HealthData>("/healthz", {
    refreshInterval: 30_000, // poll every 30s
    revalidateOnFocus: true,
  });

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-border bg-card p-5 space-y-3 animate-pulse">
        <div className="h-4 w-24 rounded bg-muted" />
        <div className="h-3 w-48 rounded bg-muted" />
      </div>
    );
  }

  const healthy = !error && data?.status === "ok";

  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
      <div className="flex items-center gap-2">
        <span
          className={`h-2.5 w-2.5 rounded-full ${
            healthy ? "bg-green-500 animate-pulse" : "bg-red-500"
          }`}
        />
        <span className="text-sm font-semibold text-foreground">
          {healthy ? "All Systems Operational" : "Service Issue Detected"}
        </span>
        {data?.version && (
          <span className="ml-auto text-xs text-muted-foreground font-mono">
            {data.version}
          </span>
        )}
      </div>

      {data && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile
            icon={Clock}
            label="Uptime"
            value={formatUptime(data.uptime_seconds)}
          />
          <StatTile
            icon={Database}
            label="DB Ping"
            value={`${data.db_ping_ms}ms`}
            alert={data.db_ping_ms > 100}
          />
          <StatTile
            icon={Cpu}
            label="Goroutines"
            value={String(data.goroutines)}
            alert={data.goroutines > 500}
          />
          <StatTile
            icon={Activity}
            label="Requests"
            value={data.requests_total.toLocaleString()}
          />
        </div>
      )}

      {error && (
        <p className="text-xs text-red-400">
          Cannot reach the server. Check network or server logs.
        </p>
      )}
    </div>
  );
}

function StatTile({
  icon: Icon,
  label,
  value,
  alert,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  alert?: boolean;
}) {
  return (
    <div className="rounded-xl bg-muted/40 p-3 space-y-1">
      <div className="flex items-center gap-1.5">
        <Icon className={`h-3.5 w-3.5 ${alert ? "text-yellow-400" : "text-muted-foreground"}`} />
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <p className={`text-sm font-bold ${alert ? "text-yellow-400" : "text-foreground"}`}>
        {value}
      </p>
    </div>
  );
}
```

---

### MODIFY: `vaultdrive_client/src/pages/dashboard.tsx`

Add the `<StatusPanel />` component at the bottom of the Dashboard layout, visible only to admin users:

```tsx
import { StatusPanel } from "../components/ui/status-panel";

// Inside return, after the main stats grid:
{isAdmin && (
  <section className="mt-8">
    <h2 className="text-base font-semibold text-foreground mb-3">System Status</h2>
    <StatusPanel />
  </section>
)}
```

If no `isAdmin` flag exists in the context, expose it to all logged-in users under a collapsible.

---

## Verification Checklist

- [ ] `go build ./...` green with new metrics middleware.
- [ ] `curl http://localhost:8080/healthz` returns JSON with `db_ping_ms`, `goroutines`, `memory_mb`.
- [ ] `curl http://localhost:8080/metrics` returns Prometheus-format text.
- [ ] `npm run build` green.
- [ ] Dashboard page shows `<StatusPanel>` with live data.
- [ ] StatusPanel shows green pulse dot when healthy.
- [ ] StatusPanel refreshes every 30 seconds without full page reload (watch browser network tab).

---

## Commit Message

```
feat(v9/step-3): add /metrics endpoint and live StatusPanel dashboard widget
```

---

*← [v9-step-02-webauthn.md](./v9-step-02-webauthn.md) | Next → [v9-step-04-inline-preview.md](./v9-step-04-inline-preview.md)*

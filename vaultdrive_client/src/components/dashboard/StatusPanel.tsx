import useSWR from "swr";
import { Server, Activity, Database, AlertTriangle, ShieldCheck } from "lucide-react";
import { API_URL } from "../../utils/api";

interface HealthResponse {
  status: string;
  version: string;
  uptime: string;
  uptime_seconds?: number;
  db_ping_ms: number;
  goroutines: number;
  memory_mb: number;
  requests_total: number;
  errors_total: number;
}

const fetcher = (url: string) => fetch(url).then((res) => {
  if (!res.ok) throw new Error("Failed to fetch server metrics");
  return res.json();
});

export function StatusPanel() {
  const { data, error, isLoading } = useSWR<HealthResponse>(
    `${API_URL}/healthz`,
    fetcher,
    { refreshInterval: 5000 } // refresh every 5 seconds
  );

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-border bg-card/60 p-5 space-y-3 animate-pulse">
        <div className="h-4 bg-muted rounded w-1/3" />
        <div className="grid grid-cols-2 gap-3">
          <div className="h-12 bg-muted rounded-xl" />
          <div className="h-12 bg-muted rounded-xl" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-5 flex items-center gap-3 text-red-400">
        <AlertTriangle className="h-5 w-5 shrink-0" />
        <div className="text-xs">
          <p className="font-semibold">Metrics Unavailable</p>
          <p className="opacity-80">Unable to retrieve live diagnostics from the Go controller.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card/60 p-5 space-y-4">
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <Server className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">System Metrics & Diagnostics</h3>
        </div>
        <div className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-400">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          ONLINE
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-border/60 bg-muted/30 p-3">
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Uptime</p>
          <p className="text-sm font-bold text-foreground mt-1 truncate" title={data.uptime}>
            {data.uptime}
          </p>
        </div>

        <div className="rounded-xl border border-border/60 bg-muted/30 p-3">
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Database Latency</p>
          <div className="flex items-baseline gap-1 mt-1">
            <p className="text-sm font-bold text-foreground">
              {data.db_ping_ms >= 0 ? `${data.db_ping_ms} ms` : "Offline"}
            </p>
            {data.db_ping_ms >= 0 && (
              <span className="text-[10px] text-green-400 flex items-center gap-0.5">
                <Database className="h-2.5 w-2.5" />
                ping
              </span>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-border/60 bg-muted/30 p-3">
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Goroutines</p>
          <div className="flex items-baseline gap-1 mt-1">
            <p className="text-sm font-bold text-foreground">{data.goroutines}</p>
            <span className="text-[10px] text-muted-foreground">active</span>
          </div>
        </div>

        <div className="rounded-xl border border-border/60 bg-muted/30 p-3">
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Memory Usage</p>
          <div className="flex items-baseline gap-1 mt-1">
            <p className="text-sm font-bold text-foreground">{data.memory_mb.toFixed(2)} MB</p>
            <span className="text-[10px] text-muted-foreground">heap</span>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t border-border/40">
        <div className="flex items-center gap-1">
          <Activity className="h-3.5 w-3.5" />
          <span>Requests: <strong className="text-foreground">{data.requests_total}</strong></span>
        </div>
        <div className="flex items-center gap-1">
          <ShieldCheck className="h-3.5 w-3.5" />
          <span>Errors: <strong className={data.errors_total > 0 ? "text-red-400 font-bold" : "text-foreground"}>{data.errors_total}</strong></span>
        </div>
        <div>
          <span>Version: <strong className="text-foreground">{data.version}</strong></span>
        </div>
      </div>
    </div>
  );
}

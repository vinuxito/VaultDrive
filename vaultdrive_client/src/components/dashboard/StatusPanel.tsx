import useSWR from "swr";
import { useTranslation } from "react-i18next";
import { Activity, AlertTriangle, Loader2 } from "lucide-react";
import { API_URL } from "../../utils/api";
import { getStoredUserFromLocalStorage } from "../../utils/browser-storage";
import { Button } from "../ui/button";

interface HealthResponse {
  status?: string;
  version?: string;
  uptime?: string;
  db_ping_ms?: number;
  goroutines?: number;
  memory_mb?: number;
  requests_total?: number;
  errors_total?: number;
  checkedAt?: string;
}

const fetcher = async (url: string): Promise<HealthResponse> => {
  const response = await fetch(url);
  if (!response.ok) throw new Error("Service status unavailable");
  const data: unknown = await response.json();
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("Invalid service status");
  return { ...data, checkedAt: new Date().toISOString() };
};

export function StatusPanel() {
  const { t } = useTranslation(["drive"]);
  const { data, error, isLoading, mutate } = useSWR<HealthResponse>(`${API_URL}/healthz`, fetcher, {
    refreshInterval: 30000,
  });
  const copy = (key: string, fallback: string) => t(`drive:service.${key}`, { defaultValue: fallback });
  const hasDatabaseState = typeof data?.db_ping_ms === "number" && Number.isFinite(data.db_ping_ms);
  const degraded = data?.status === "degraded" || (hasDatabaseState && data!.db_ping_ms! < 0);
  const healthy = hasDatabaseState && !degraded && data?.status === "ok";
  const status = error ? "unreachable" : degraded ? "degraded" : healthy ? "available" : "unknown";
  const labels = {
    unreachable: copy("unreachable", "Service unreachable"),
    degraded: copy("degraded", "Service degraded"),
    available: copy("available", "Service responding"),
    unknown: copy("unknown", "Service status unknown"),
  };
  const isAdmin = getStoredUserFromLocalStorage()?.is_admin === true;
  const metric = (value: unknown) => typeof value === "number" && Number.isFinite(value) ? value.toLocaleString() : "—";

  return (
    <section className="rounded-2xl border border-border bg-card p-5 space-y-3" aria-label={copy("title", "Service status")}>
      {isLoading ? (
        <p role="status" className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />{copy("checking", "Checking service…")}</p>
      ) : (
        <>
          <div className="flex items-center justify-between gap-3">
            <p role="status" className="flex items-center gap-2 font-semibold text-foreground">
              {status === "available" ? <Activity className="h-4 w-4 text-primary" /> : <AlertTriangle className="h-4 w-4 text-primary" />}
              {labels[status]}
            </p>
            <Button size="sm" variant="outline" onClick={() => void mutate()}>{copy("retry", "Check again")}</Button>
          </div>
          <p className="text-sm text-muted-foreground">
            {status === "available" ? copy("respondingHint", "The API and database responded. Individual file actions may still fail.")
              : status === "degraded" ? copy("degradedHint", "Some file actions may be unavailable. Your browser reached the service, but its database is unavailable.")
              : status === "unreachable" ? copy("unreachableHint", "The service could not be reached. Check your connection and try again.")
              : copy("unknownHint", "We could not confirm the service state. Check your connection and try again.")}
          </p>
          {data?.checkedAt && <p className="text-xs text-muted-foreground">{copy("lastChecked", "Last checked")}: {new Date(data.checkedAt).toLocaleTimeString()}{error ? ` · ${copy("stale", "Previous result; may be out of date")}` : ""}</p>}
        </>
      )}
      {isAdmin && data && (
        <details className="border-t border-border pt-3 text-sm">
          <summary className="cursor-pointer text-foreground">{copy("operatorDetails", "Operator details")}</summary>
          <dl className="grid grid-cols-2 gap-2 pt-3 text-muted-foreground">
            <dt>{copy("databaseLatency", "Database latency (ms)")}</dt><dd>{hasDatabaseState && data.db_ping_ms! >= 0 ? metric(data.db_ping_ms) : "—"}</dd>
            <dt>{copy("workers", "Server workers")}</dt><dd>{metric(data.goroutines)}</dd>
            <dt>{copy("memory", "Memory (MB)")}</dt><dd>{metric(data.memory_mb)}</dd>
            <dt>{copy("requests", "Requests")}</dt><dd>{metric(data.requests_total)}</dd>
            <dt>{copy("errors", "Errors")}</dt><dd>{metric(data.errors_total)}</dd>
            <dt>{copy("version", "Build")}</dt><dd>{typeof data.version === "string" && data.version !== "dev" ? data.version : copy("unknownBuild", "Unknown")}</dd>
          </dl>
        </details>
      )}
    </section>
  );
}

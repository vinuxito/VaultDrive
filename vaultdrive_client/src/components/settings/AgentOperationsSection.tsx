import { useCallback, useEffect, useState } from "react";
import { Radio, RefreshCw, ShieldAlert, ShieldCheck, Zap } from "lucide-react";
import { Button } from "../ui/button";
import { API_URL } from "../../utils/api";
import { relativeTime } from "../../utils/format";
import type { ActivityEvent } from "../../hooks";
import { useSSE } from "../../hooks";
import { groupAgentOperations } from "./agent-operations";

interface AuditEntry {
  id: string;
  action: string;
  resource_type: string;
  resource_id?: string;
  created_at: string;
  metadata?: Record<string, unknown>;
}

interface Pagination {
  count: number;
  limit: number;
  offset: number;
}

interface Envelope {
  success: boolean;
  data: AuditEntry[];
  meta: { pagination: Pagination };
}

function toLiveAuditEntry(event: ActivityEvent): AuditEntry | null {
  if (event.event_type !== "agent_operation") return null;
  const action = typeof event.payload.action === "string" ? event.payload.action : "";
  if (!action) return null;

  return {
    id: typeof event.payload.id === "string" ? event.payload.id : event.id,
    action,
    resource_type: "agent_api_key",
    resource_id: typeof event.payload.key_id === "string" ? event.payload.key_id : undefined,
    created_at: typeof event.payload.created_at === "string" ? event.payload.created_at : event.created_at,
    metadata: event.payload,
  };
}

const AGENT_ACTIONS: Record<string, { label: string; tone: "good" | "warn" | "info" }> = {
  "agent_api_key.created": { label: "Key created", tone: "good" },
  "agent_api_key.revoked": { label: "Key revoked", tone: "warn" },
  "agent_api_key.used": { label: "Request", tone: "info" },
  "agent_api_key.expired": { label: "Key expired", tone: "warn" },
  "agent_api_key.scope_denied": { label: "Scope denied", tone: "warn" },
};

const TONE_STYLES = {
  good: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800",
  warn: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800",
  info: "bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-900/30 dark:text-sky-300 dark:border-sky-800",
};

const TONE_ICONS = {
  good: ShieldCheck,
  warn: ShieldAlert,
  info: Zap,
};

function extractResource(entry: AuditEntry): string {
  const meta = entry.metadata;
  if (!meta) return entry.resource_id?.slice(0, 8) ?? "-";
  if (typeof meta.resource === "string") return meta.resource;
  if (typeof meta.path === "string") return meta.path as string;
  if (typeof meta.required_scope === "string") return `scope: ${meta.required_scope}`;
  return entry.resource_id?.slice(0, 8) ?? "-";
}

function extractResult(entry: AuditEntry): string {
  const meta = entry.metadata;
  if (typeof meta?.result === "string") {
    const method = typeof meta.method === "string" ? meta.method : "";
    if (meta.result === "ok") return method ? `${method} OK` : "OK";
    return meta.result.charAt(0).toUpperCase() + meta.result.slice(1);
  }
  if (entry.action === "agent_api_key.scope_denied") return "Denied";
  if (entry.action === "agent_api_key.expired") return "Expired";
  if (entry.action === "agent_api_key.revoked") return "Revoked";
  if (entry.action === "agent_api_key.created") return "Active";
  if (entry.action === "agent_api_key.used") {
    const method = typeof meta?.method === "string" ? meta.method : "";
    return method ? `${method} OK` : "OK";
  }
  return "OK";
}

export function AgentOperationsSection() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [offset, setOffset] = useState(0);
  const limit = 30;

  const fetchOps = useCallback(async (nextOffset: number) => {
    setLoading(true);
    const token = localStorage.getItem("token");
    try {
      const res = await fetch(
        `${API_URL}/v1/audit?resource_type=agent_api_key&limit=${limit}&offset=${nextOffset}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const payload = (await res.json().catch(() => null)) as Envelope | null;
      if (payload?.data) {
        setEntries(nextOffset === 0 ? payload.data : (prev) => [...prev, ...payload.data]);
        setPagination(payload.meta?.pagination ?? null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchOps(0);
  }, [fetchOps]);

  useSSE((event) => {
    const liveEntry = toLiveAuditEntry(event);
    if (!liveEntry) return;

    setEntries((current) => {
      const withoutDuplicate = current.filter((entry) => entry.id !== liveEntry.id);
      return [liveEntry, ...withoutDuplicate].slice(0, 50);
    });
    setPagination((current) => {
      if (!current) return current;
      return { ...current, count: current.count + 1 };
    });
  });

  const loadMore = () => {
    const next = offset + limit;
    setOffset(next);
    void fetchOps(next);
  };

  const refresh = () => {
    setOffset(0);
    void fetchOps(0);
  };

  const hasMore = pagination ? offset + limit < pagination.count : false;

  const stats = {
    total: Math.max(pagination?.count ?? 0, entries.length),
    denied: entries.filter((e) => e.action === "agent_api_key.scope_denied").length,
    requests: entries.filter((e) => e.action === "agent_api_key.used").length,
  };
  const groupedEntries = groupAgentOperations(entries);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Radio className="w-5 h-5 text-[#7d4f50]" />
            Agent operations
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Live view of what your agent keys are doing. Every request, denial, and lifecycle event.
          </p>
          <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Live stream connected
          </div>
        </div>
        <Button type="button" variant="outline" onClick={refresh} className="shrink-0">
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/60 px-4 py-3">
          <p className="text-xs uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Total events</p>
          <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">{stats.total}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/60 px-4 py-3">
          <p className="text-xs uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Requests served</p>
          <p className="mt-1 text-2xl font-bold text-emerald-600 dark:text-emerald-400">{stats.requests}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/60 px-4 py-3">
          <p className="text-xs uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Scope denials</p>
          <p className="mt-1 text-2xl font-bold text-amber-600 dark:text-amber-400">{stats.denied}</p>
        </div>
      </div>

      {loading && entries.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/60 px-4 py-6 text-sm text-slate-500">
          Loading agent operations...
        </div>
      ) : entries.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900/60 px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
          No agent operations yet. Events appear here when an agent key is used, created, or denied.
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {groupedEntries.map((group) => (
              <div key={group.agentName} className="rounded-[1.5rem] border border-slate-200 bg-white px-4 py-4 shadow-[0_16px_34px_rgba(15,23,42,0.06)] dark:border-slate-700 dark:bg-slate-900/70">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{group.agentName}</p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Latest event {relativeTime(group.latestAt)}</p>
                  </div>
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-slate-500 dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-300">
                    {group.entries.length} events
                  </span>
                </div>

                <div className="mt-4 space-y-3">
                  {group.entries.map((entry, index) => {
                    const actionDef = AGENT_ACTIONS[entry.action] ?? { label: entry.action, tone: "info" as const };
                    const ToneIcon = TONE_ICONS[actionDef.tone];
                    return (
                      <div key={entry.id} data-testid="agent-operation-entry" className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <span className={`flex h-8 w-8 items-center justify-center rounded-full border ${TONE_STYLES[actionDef.tone]}`}>
                            <ToneIcon className="w-3.5 h-3.5" />
                          </span>
                          {index < group.entries.length - 1 ? <span className="mt-1 h-full w-px bg-slate-200 dark:bg-slate-700" /> : null}
                        </div>
                        <div className="flex-1 rounded-2xl border border-slate-200/80 bg-slate-50/80 px-3 py-3 dark:border-slate-700 dark:bg-slate-950/40">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-medium ${TONE_STYLES[actionDef.tone]}`}>
                              <ToneIcon className="w-3 h-3" />
                              {actionDef.label}
                            </span>
                            <span className="text-[11px] text-slate-500 dark:text-slate-400" title={new Date(entry.created_at).toLocaleString()}>
                              {relativeTime(entry.created_at)}
                            </span>
                          </div>
                          <code className="mt-2 block text-xs text-slate-700 dark:text-slate-200 font-mono break-all">
                            {extractResource(entry)}
                          </code>
                          <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">
                            {extractResult(entry)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {hasMore && (
            <Button type="button" variant="outline" onClick={loadMore} disabled={loading} className="w-full">
              {loading ? "Loading..." : "Load more"}
            </Button>
          )}
        </>
      )}
    </div>
  );
}

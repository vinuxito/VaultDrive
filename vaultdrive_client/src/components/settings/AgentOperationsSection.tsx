import { useCallback, useEffect, useState } from "react";
import { Radio, RefreshCw, ShieldAlert, ShieldCheck, Zap } from "lucide-react";
import { Button } from "../ui/button";
import { API_URL } from "../../utils/api";
import { relativeTime } from "../../utils/format";

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

function extractAgentName(entry: AuditEntry): string {
  const meta = entry.metadata;
  if (!meta) return "Agent";
  if (typeof meta.name === "string") return meta.name;
  if (typeof meta.key_prefix === "string") return meta.key_prefix;
  return "Agent";
}

function extractResource(entry: AuditEntry): string {
  const meta = entry.metadata;
  if (!meta) return entry.resource_id?.slice(0, 8) ?? "-";
  if (typeof meta.path === "string") return meta.path as string;
  if (typeof meta.required_scope === "string") return `scope: ${meta.required_scope}`;
  return entry.resource_id?.slice(0, 8) ?? "-";
}

function extractResult(entry: AuditEntry): string {
  const meta = entry.metadata;
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
    total: pagination?.count ?? entries.length,
    denied: entries.filter((e) => e.action === "agent_api_key.scope_denied").length,
    requests: entries.filter((e) => e.action === "agent_api_key.used").length,
  };

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
          <div className="rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/60 text-left text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    <th className="px-4 py-2.5 font-medium">Time</th>
                    <th className="px-4 py-2.5 font-medium">Agent</th>
                    <th className="px-4 py-2.5 font-medium">Action</th>
                    <th className="px-4 py-2.5 font-medium">Resource</th>
                    <th className="px-4 py-2.5 font-medium">Result</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                  {entries.map((entry) => {
                    const actionDef = AGENT_ACTIONS[entry.action] ?? { label: entry.action, tone: "info" as const };
                    const ToneIcon = TONE_ICONS[actionDef.tone];
                    return (
                      <tr key={entry.id} className="bg-white dark:bg-slate-900/60 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="px-4 py-2.5 whitespace-nowrap">
                          <span className="text-xs text-slate-600 dark:text-slate-300" title={new Date(entry.created_at).toLocaleString()}>
                            {relativeTime(entry.created_at)}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="text-xs font-medium text-slate-900 dark:text-slate-100">
                            {extractAgentName(entry)}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-medium ${TONE_STYLES[actionDef.tone]}`}>
                            <ToneIcon className="w-3 h-3" />
                            {actionDef.label}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          <code className="text-xs text-slate-600 dark:text-slate-400 font-mono truncate max-w-[200px] block">
                            {extractResource(entry)}
                          </code>
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="text-xs text-slate-600 dark:text-slate-300">
                            {extractResult(entry)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
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

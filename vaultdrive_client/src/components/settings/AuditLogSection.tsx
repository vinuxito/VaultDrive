import { useCallback, useEffect, useState } from "react";
import { Activity, ChevronDown, ChevronUp, RefreshCw } from "lucide-react";
import { Button } from "../ui/button";
import { API_URL } from "../../utils/api";

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

const ACTION_LABELS: Record<string, string> = {
  "agent_api_key.created": "Agent key created",
  "agent_api_key.revoked": "Agent key revoked",
  "agent_api_key.used": "Agent key used",
  "agent_api_key.expired": "Agent key expired",
  "agent_api_key.scope_denied": "Agent key scope denied",
  "file.uploaded": "File uploaded",
  "file.shared": "File shared",
  "file.external_access_revoked": "External access revoked",
  "public_share_link.created": "Share link created",
  "public_share_link.revoked": "Share link revoked",
  "file_request.created": "File request created",
  "file_request.revoked": "File request revoked",
  "file_request.uploaded": "File request received",
  "secure_drop.created": "Secure Drop created",
  "secure_drop.uploaded": "Secure Drop received",
  "secure_drop.revoked": "Secure Drop revoked",
};

function actionTone(action: string): string {
  if (action.includes("revoked") || action.includes("denied") || action.includes("expired")) {
    return "text-amber-700 bg-amber-50 border-amber-200";
  }
  if (action.includes("created") || action.includes("uploaded") || action.includes("received")) {
    return "text-sky-700 bg-sky-50 border-sky-200";
  }
  return "text-slate-600 bg-slate-50 border-slate-200";
}

function MetadataDetail({ meta }: { meta: Record<string, unknown> }) {
  const [expanded, setExpanded] = useState(false);
  const keys = Object.keys(meta).filter((k) => k !== "path" && k !== "method");
  if (keys.length === 0) return null;
  return (
    <div className="mt-1">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600"
      >
        {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        {expanded ? "Hide details" : "Details"}
      </button>
      {expanded && (
        <div className="mt-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 space-y-1">
          {keys.map((k) => (
            <div key={k} className="flex gap-2">
              <span className="text-slate-400 w-28 shrink-0">{k}</span>
              <span className="break-all">{String(meta[k])}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function AuditLogSection() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [offset, setOffset] = useState(0);
  const limit = 20;

  const fetchAudit = useCallback(async (nextOffset: number) => {
    setLoading(true);
    const token = localStorage.getItem("token");
    try {
      const res = await fetch(`${API_URL}/v1/audit?limit=${limit}&offset=${nextOffset}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
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
    void fetchAudit(0);
  }, [fetchAudit]);

  const loadMore = () => {
    const next = offset + limit;
    setOffset(next);
    void fetchAudit(next);
  };

  const refresh = () => {
    setOffset(0);
    void fetchAudit(0);
  };

  const hasMore = pagination ? (offset + limit) < pagination.count : false;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-900 flex items-center gap-2">
            <Activity className="w-5 h-5 text-[#7d4f50]" />
            Audit log
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Key lifecycle, access changes, and agent actions. Visible only to you.
          </p>
        </div>
        <Button type="button" variant="outline" onClick={refresh} className="shrink-0">
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {loading && entries.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-500">
          Loading audit events...
        </div>
      ) : entries.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm text-slate-500">
          No audit events recorded yet. Actions appear here as you use ABRN Drive.
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map((entry) => (
            <div
              key={entry.id}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3"
            >
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${actionTone(entry.action)}`}>
                  {ACTION_LABELS[entry.action] ?? entry.action}
                </span>
                <span className="text-xs text-slate-400">
                  {new Date(entry.created_at).toLocaleString()}
                </span>
              </div>
              <div className="mt-1 text-xs text-slate-500">
                {entry.resource_type}
                {entry.resource_id && <span className="ml-1 font-mono text-slate-400">{entry.resource_id.slice(0, 8)}…</span>}
              </div>
              {entry.metadata && Object.keys(entry.metadata).length > 0 && (
                <MetadataDetail meta={entry.metadata} />
              )}
            </div>
          ))}

          {hasMore && (
            <Button
              type="button"
              variant="outline"
              onClick={loadMore}
              disabled={loading}
              className="w-full"
            >
              {loading ? "Loading..." : "Load more"}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

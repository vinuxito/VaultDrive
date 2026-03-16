import { useCallback, useEffect, useState } from "react";
import { FlaskConical, CheckCircle2, XCircle, ChevronDown } from "lucide-react";
import { API_URL } from "../../utils/api";

interface AgentKey {
  id: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  status: string;
}

interface Envelope<T> {
  success: boolean;
  data: T;
}

interface EndpointDef {
  method: string;
  path: string;
  scope: string;
  label: string;
}

const ENDPOINTS: EndpointDef[] = [
  { method: "GET", path: "/files", scope: "files:list", label: "List files" },
  { method: "GET", path: "/files/{id}", scope: "files:read_metadata", label: "Get file metadata" },
  { method: "POST", path: "/files/upload", scope: "files:upload_ciphertext", label: "Upload ciphertext" },
  { method: "GET", path: "/files/{id}/download", scope: "files:download_ciphertext", label: "Download ciphertext" },
  { method: "GET", path: "/files/{id}/trust", scope: "trust:read", label: "File trust summary" },
  { method: "GET", path: "/files/{id}/timeline", scope: "trust:read", label: "Security timeline" },
  { method: "GET", path: "/files/{id}/access-summary", scope: "trust:read", label: "Access summary" },
  { method: "DELETE", path: "/files/{id}/revoke-external", scope: "shares:revoke", label: "Revoke external access" },
  { method: "GET", path: "/files/{fileId}/share-links", scope: "shares:list", label: "List share links" },
  { method: "POST", path: "/files/{fileId}/share-link", scope: "shares:create", label: "Create share link" },
  { method: "DELETE", path: "/share-links/{linkId}", scope: "shares:revoke", label: "Revoke share link" },
  { method: "GET", path: "/file-requests", scope: "requests:list", label: "List file requests" },
  { method: "POST", path: "/file-requests", scope: "requests:create", label: "Create file request" },
  { method: "DELETE", path: "/file-requests/{id}", scope: "requests:revoke", label: "Revoke file request" },
  { method: "GET", path: "/folders", scope: "folders:read", label: "List folders" },
  { method: "POST", path: "/folders", scope: "folders:write", label: "Create folder" },
  { method: "PUT", path: "/folders/{id}", scope: "folders:write", label: "Update folder" },
  { method: "DELETE", path: "/folders/{id}", scope: "folders:write", label: "Delete folder" },
  { method: "GET", path: "/activity", scope: "activity:read", label: "Activity feed" },
  { method: "GET", path: "/audit", scope: "activity:read", label: "Audit log" },
  { method: "GET", path: "/agent-keys", scope: "api_keys:read", label: "List agent keys" },
  { method: "POST", path: "/agent-keys", scope: "api_keys:write", label: "Create agent key" },
  { method: "DELETE", path: "/agent-keys/{id}", scope: "api_keys:write", label: "Revoke agent key" },
  { method: "GET", path: "/auth/introspect", scope: "(none)", label: "Introspect auth" },
];

const METHOD_COLORS: Record<string, string> = {
  GET: "text-emerald-600",
  POST: "text-sky-600",
  PUT: "text-amber-600",
  DELETE: "text-rose-600",
};

export function ApiSimulationSection() {
  const [keys, setKeys] = useState<AgentKey[]>([]);
  const [selectedKeyId, setSelectedKeyId] = useState("");
  const [selectedEndpoint, setSelectedEndpoint] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchKeys = useCallback(async () => {
    const token = localStorage.getItem("token");
    try {
      const res = await fetch(`${API_URL}/v1/agent-keys`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = (await res.json().catch(() => null)) as Envelope<AgentKey[]> | null;
      const activeKeys = (payload?.data ?? []).filter((k) => k.status === "active");
      setKeys(activeKeys);
      if (activeKeys.length > 0) setSelectedKeyId(activeKeys[0].id);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchKeys();
  }, [fetchKeys]);

  const selectedKey = keys.find((k) => k.id === selectedKeyId);
  const endpoint = ENDPOINTS[selectedEndpoint];
  const scopeRequired = endpoint.scope;
  const scopeGranted = scopeRequired === "(none)" || (selectedKey?.scopes.includes(scopeRequired) ?? false);
  const allGrantedForEndpoint = scopeGranted;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <FlaskConical className="w-5 h-5 text-[#7d4f50]" />
          API key simulator
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Pick a key and an endpoint to instantly see whether the request would be authorized.
        </p>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/60 px-4 py-6 text-sm text-slate-500">
          Loading keys...
        </div>
      ) : keys.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900/60 px-4 py-6 text-center text-sm text-slate-500 dark:text-slate-400">
          No active agent keys. Create one first, then simulate requests here.
        </div>
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="sim-key" className="text-sm font-medium text-slate-700 dark:text-slate-200">Agent key</label>
              <div className="relative">
                <select
                  id="sim-key"
                  value={selectedKeyId}
                  onChange={(e) => setSelectedKeyId(e.target.value)}
                  className="w-full appearance-none rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 pr-8 text-sm text-slate-700 dark:text-slate-200 focus:border-[#7d4f50] focus:outline-none"
                >
                  {keys.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.name} ({k.key_prefix})
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2.5 top-2.5 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="sim-endpoint" className="text-sm font-medium text-slate-700 dark:text-slate-200">Endpoint</label>
              <div className="relative">
                <select
                  id="sim-endpoint"
                  value={selectedEndpoint}
                  onChange={(e) => setSelectedEndpoint(Number(e.target.value))}
                  className="w-full appearance-none rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 pr-8 text-sm text-slate-700 dark:text-slate-200 focus:border-[#7d4f50] focus:outline-none"
                >
                  {ENDPOINTS.map((ep, idx) => (
                    <option key={`${ep.method}-${ep.path}`} value={idx}>
                      {ep.method} /api/v1{ep.path} — {ep.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2.5 top-2.5 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
            </div>
          </div>

          <div className={`rounded-2xl border px-5 py-4 space-y-3 ${
            allGrantedForEndpoint
              ? "border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30"
              : "border-rose-200 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/30"
          }`}>
            <div className="flex items-center gap-2">
              {allGrantedForEndpoint ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <XCircle className="w-5 h-5 text-rose-600 dark:text-rose-400" />
              )}
              <p className={`font-semibold ${allGrantedForEndpoint ? "text-emerald-800 dark:text-emerald-200" : "text-rose-800 dark:text-rose-200"}`}>
                {allGrantedForEndpoint ? "Authorized" : "Denied — scope not granted"}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 text-sm">
              <div className="rounded-xl border border-white/60 dark:border-slate-700 bg-white/70 dark:bg-slate-900/50 px-3 py-2">
                <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Required scope</p>
                <code className="text-xs text-slate-700 dark:text-slate-200 font-mono">{scopeRequired}</code>
              </div>
              <div className="rounded-xl border border-white/60 dark:border-slate-700 bg-white/70 dark:bg-slate-900/50 px-3 py-2">
                <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Key scopes ({selectedKey?.scopes.length ?? 0})</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {selectedKey?.scopes.map((s) => (
                    <span
                      key={s}
                      className={`rounded-full px-2 py-0.5 text-[10px] font-medium border ${
                        s === scopeRequired
                          ? "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-800"
                          : "bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700"
                      }`}
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-900 dark:bg-slate-950 px-3 py-2.5">
              <p className="text-[10px] uppercase tracking-[0.14em] text-slate-400 mb-1">Simulated response</p>
              <pre className="text-[11px] font-mono whitespace-pre-wrap leading-relaxed">
                {allGrantedForEndpoint ? (
                  <span className="text-emerald-400">{`{
  "success": true,
  "data": { ... },
  "meta": {
    "request_id": "uuid"
  }
}`}</span>
                ) : (
                  <span className="text-rose-400">{`{
  "success": false,
  "error": "scope '${scopeRequired}' required",
  "meta": {
    "request_id": "uuid"
  }
}`}</span>
                )}
              </pre>
            </div>
          </div>

          {selectedKey && (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/60 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400 mb-2">Full request preview</p>
              <pre className="text-[11px] text-slate-600 dark:text-slate-300 font-mono whitespace-pre-wrap break-all leading-relaxed">
                <span className={METHOD_COLORS[endpoint.method] ?? "text-slate-600"}>{endpoint.method}</span>
                {` ${window.location.origin}/abrn/api/v1${endpoint.path}\nAuthorization: Bearer ${selectedKey.key_prefix}••••••••\nScope check: ${scopeRequired} → ${allGrantedForEndpoint ? "PASS" : "DENY"}`}
              </pre>
            </div>
          )}
        </>
      )}
    </div>
  );
}

import { useState } from "react";
import { Code2, Copy, ChevronDown, ChevronUp, Terminal, Globe, Shield } from "lucide-react";

const API_BASE = "/api/v1";

interface EndpointDef {
  method: "GET" | "POST" | "PUT" | "DELETE";
  path: string;
  scope: string;
  description: string;
  category: string;
}

const ENDPOINTS: EndpointDef[] = [
  { method: "GET", path: "/files", scope: "files:list", description: "List files with optional ?q= search", category: "Files" },
  { method: "GET", path: "/files/{id}", scope: "files:read_metadata", description: "Single file metadata", category: "Files" },
  { method: "POST", path: "/files/upload", scope: "files:upload_ciphertext", description: "Upload encrypted file (multipart)", category: "Files" },
  { method: "GET", path: "/files/{id}/download", scope: "files:download_ciphertext", description: "Download ciphertext + X-Wrapped-Key header", category: "Files" },
  { method: "GET", path: "/files/{id}/trust", scope: "trust:read", description: "Trust summary (protection, visibility, origin)", category: "Trust" },
  { method: "GET", path: "/files/{id}/timeline", scope: "trust:read", description: "Security event timeline", category: "Trust" },
  { method: "GET", path: "/files/{id}/access-summary", scope: "trust:read", description: "Access entries with state", category: "Trust" },
  { method: "DELETE", path: "/files/{id}/revoke-external", scope: "shares:revoke", description: "Revoke all external access", category: "Trust" },
  { method: "GET", path: "/files/{fileId}/share-links", scope: "shares:list", description: "List share links for a file", category: "Sharing" },
  { method: "POST", path: "/files/{fileId}/share-link", scope: "shares:create", description: "Create share link", category: "Sharing" },
  { method: "DELETE", path: "/share-links/{linkId}", scope: "shares:revoke", description: "Revoke share link", category: "Sharing" },
  { method: "GET", path: "/file-requests", scope: "requests:list", description: "List file requests", category: "Requests" },
  { method: "POST", path: "/file-requests", scope: "requests:create", description: "Create file request", category: "Requests" },
  { method: "DELETE", path: "/file-requests/{id}", scope: "requests:revoke", description: "Revoke file request", category: "Requests" },
  { method: "GET", path: "/folders", scope: "folders:read", description: "List folders", category: "Folders" },
  { method: "POST", path: "/folders", scope: "folders:write", description: "Create folder", category: "Folders" },
  { method: "PUT", path: "/folders/{id}", scope: "folders:write", description: "Update folder", category: "Folders" },
  { method: "DELETE", path: "/folders/{id}", scope: "folders:write", description: "Delete folder", category: "Folders" },
  { method: "GET", path: "/activity", scope: "activity:read", description: "Activity feed", category: "Audit" },
  { method: "GET", path: "/audit", scope: "activity:read", description: "Audit log with filters", category: "Audit" },
  { method: "GET", path: "/agent-keys", scope: "api_keys:read", description: "List agent keys", category: "Keys" },
  { method: "POST", path: "/agent-keys", scope: "api_keys:write", description: "Create agent key", category: "Keys" },
  { method: "DELETE", path: "/agent-keys/{id}", scope: "api_keys:write", description: "Revoke agent key", category: "Keys" },
  { method: "GET", path: "/auth/introspect", scope: "(none)", description: "Introspect current auth context", category: "Keys" },
];

const METHOD_COLORS: Record<string, string> = {
  GET: "bg-emerald-100 text-emerald-700 border-emerald-200",
  POST: "bg-sky-100 text-sky-700 border-sky-200",
  PUT: "bg-amber-100 text-amber-700 border-amber-200",
  DELETE: "bg-rose-100 text-rose-700 border-rose-200",
};

const CATEGORIES = ["Files", "Trust", "Sharing", "Requests", "Folders", "Audit", "Keys"];

function makeCurl(endpoint: EndpointDef): string {
  const base = `${window.location.origin}/abrn${API_BASE}`;
  const url = `${base}${endpoint.path}`;
  const parts = [`curl -s`];
  if (endpoint.method !== "GET") parts.push(`-X ${endpoint.method}`);
  parts.push(`"${url}"`);
  parts.push(`-H "Authorization: Bearer $ABRN_KEY"`);
  if (endpoint.method === "POST" && !endpoint.path.includes("upload")) {
    parts.push(`-H "Content-Type: application/json"`);
    parts.push(`-d '{}'`);
  }
  return parts.join(" \\\n  ");
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="inline-flex items-center gap-1.5 text-xs text-[#7d4f50] hover:text-[#6b4345] transition-colors"
    >
      <Copy className="w-3 h-3" />
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function EndpointRow({ ep }: { ep: EndpointDef }) {
  const [expanded, setExpanded] = useState(false);
  const curl = makeCurl(ep);

  return (
    <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900/60 overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
      >
        <span className={`rounded-md border px-2 py-0.5 text-[10px] font-bold tracking-wider ${METHOD_COLORS[ep.method]}`}>
          {ep.method}
        </span>
        <code className="text-xs text-slate-700 dark:text-slate-200 font-mono flex-1 truncate">
          {API_BASE}{ep.path}
        </code>
        <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[10px] text-slate-500 dark:text-slate-400 shrink-0">
          {ep.scope}
        </span>
        {expanded ? <ChevronUp className="w-3.5 h-3.5 text-slate-400 shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
      </button>
      {expanded && (
        <div className="border-t border-slate-200 dark:border-slate-700 px-3 py-3 space-y-2 bg-slate-50/60 dark:bg-slate-800/30">
          <p className="text-xs text-slate-600 dark:text-slate-300">{ep.description}</p>
          <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-900 dark:bg-slate-950 px-3 py-2.5">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] uppercase tracking-[0.14em] text-slate-400">curl</span>
              <CopyButton text={curl} />
            </div>
            <pre className="text-[11px] text-emerald-400 font-mono whitespace-pre-wrap break-all leading-relaxed">{curl}</pre>
          </div>
        </div>
      )}
    </div>
  );
}

export function AgentDeveloperPortalSection() {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [showEnvelope, setShowEnvelope] = useState(false);

  const filteredEndpoints = activeCategory
    ? ENDPOINTS.filter((ep) => ep.category === activeCategory)
    : ENDPOINTS;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <Code2 className="w-5 h-5 text-[#7d4f50]" />
          Agent API reference
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          24 versioned endpoints under <code className="text-xs bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">/api/v1</code>. All accept <code className="text-xs bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">Authorization: Bearer</code> with JWT or agent key.
        </p>
      </div>

      {/* Quick-start box */}
      <div className="rounded-2xl border border-[#e8d9d0] dark:border-slate-700 bg-[linear-gradient(180deg,#fffdfb_0%,#f8f3ef_100%)] dark:bg-[linear-gradient(180deg,rgba(30,41,59,0.96)_0%,rgba(15,23,42,0.92)_100%)] px-5 py-4 space-y-3">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-[#7d4f50]" />
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Quick start</p>
        </div>
        <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-900 dark:bg-slate-950 px-3 py-2.5">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] uppercase tracking-[0.14em] text-slate-400">verify your key</span>
            <CopyButton text={`curl -s "${window.location.origin}/abrn/api/v1/auth/introspect" \\\n  -H "Authorization: Bearer $ABRN_KEY" | jq .`} />
          </div>
          <pre className="text-[11px] text-emerald-400 font-mono whitespace-pre-wrap break-all leading-relaxed">
{`curl -s "${window.location.origin}/abrn/api/v1/auth/introspect" \\
  -H "Authorization: Bearer $ABRN_KEY" | jq .`}
          </pre>
        </div>
        <div className="grid gap-2 sm:grid-cols-3 text-[11px]">
          <div className="rounded-xl border border-white/70 dark:border-slate-700 bg-white/80 dark:bg-slate-900/60 px-3 py-2 text-slate-600 dark:text-slate-300">
            <Globe className="w-3 h-3 inline mr-1" />
            Base: <code className="font-mono">{window.location.origin}/abrn/api/v1</code>
          </div>
          <div className="rounded-xl border border-white/70 dark:border-slate-700 bg-white/80 dark:bg-slate-900/60 px-3 py-2 text-slate-600 dark:text-slate-300">
            <Shield className="w-3 h-3 inline mr-1" />
            Auth: Bearer token (JWT or agent key)
          </div>
          <div className="rounded-xl border border-white/70 dark:border-slate-700 bg-white/80 dark:bg-slate-900/60 px-3 py-2 text-slate-600 dark:text-slate-300">
            <Code2 className="w-3 h-3 inline mr-1" />
            Format: JSON envelope with request ID
          </div>
        </div>
      </div>

      {/* Response envelope */}
      <button
        type="button"
        onClick={() => setShowEnvelope((v) => !v)}
        className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/60 px-4 py-3 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
      >
        <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Response envelope</span>
        {showEnvelope ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>
      {showEnvelope && (
        <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-900 dark:bg-slate-950 px-4 py-3">
          <pre className="text-[11px] text-emerald-400 font-mono whitespace-pre-wrap leading-relaxed">
{`{
  "success": true,
  "data": { ... },
  "error": null,
  "meta": {
    "request_id": "uuid",
    "pagination": { "count": 50, "limit": 20, "offset": 0 }
  }
}`}
          </pre>
        </div>
      )}

      {/* Category filter */}
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => setActiveCategory(null)}
          className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
            activeCategory === null
              ? "bg-[#7d4f50] text-white border-[#7d4f50]"
              : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700"
          }`}
        >
          All ({ENDPOINTS.length})
        </button>
        {CATEGORIES.map((cat) => {
          const count = ENDPOINTS.filter((ep) => ep.category === cat).length;
          return (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveCategory(activeCategory === cat ? null : cat)}
              className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
                activeCategory === cat
                  ? "bg-[#7d4f50] text-white border-[#7d4f50]"
                  : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700"
              }`}
            >
              {cat} ({count})
            </button>
          );
        })}
      </div>

      {/* Endpoint list */}
      <div className="space-y-1.5">
        {filteredEndpoints.map((ep) => (
          <EndpointRow key={`${ep.method}-${ep.path}`} ep={ep} />
        ))}
      </div>
    </div>
  );
}

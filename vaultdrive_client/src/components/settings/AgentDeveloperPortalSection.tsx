import { useState } from "react";
import { Code2, Copy, ChevronDown, ChevronUp, Terminal, Globe, Shield } from "lucide-react";
import { branding } from "../../config/branding";

const API_BASE = "/api/v1";

interface EndpointDef {
  method: "GET" | "POST" | "PUT" | "DELETE";
  path: string;
  scope: string;
  description: string;
  category: string;
}

const ENDPOINTS: EndpointDef[] = [
  { method: "GET", path: "/files", scope: "files:list", description: "List active files (respects folder jail; excludes Trash)", category: "Files" },
  { method: "GET", path: "/files/shared", scope: "files:list", description: "List files shared directly or via shared folders", category: "Files" },
  { method: "GET", path: "/files/{id}", scope: "files:read_metadata", description: "Single file metadata + envelope attributes", category: "Files" },
  { method: "POST", path: "/files/upload", scope: "files:upload_ciphertext", description: "Upload pre-encrypted ciphertext (RSA, folder, PIN, or password scheme)", category: "Files" },
  { method: "GET", path: "/files/{id}/download", scope: "files:download_ciphertext", description: "Download ciphertext + X-Wrapped-Key & X-File-Metadata headers", category: "Files" },
  { method: "PUT", path: "/files/{id}/folder", scope: "folders:write", description: "Move file between folders (supports Idempotency-Key)", category: "Files" },
  { method: "POST", path: "/files/sync", scope: "files:write | abrnak_del_", description: "Batch rename (standard key) or soft-delete (Special Delete-Only key)", category: "Files" },
  { method: "DELETE", path: "/files/{id}", scope: "files:soft_delete (abrnak_del_)", description: "Move file to Recoverable Trash (Special Delete-Only key or human JWT only)", category: "Files" },
  { method: "GET", path: "/files/{id}/trust", scope: "trust:read", description: "Trust summary (protection, visibility, origin)", category: "Trust" },
  { method: "GET", path: "/files/{id}/timeline", scope: "trust:read", description: "Security event timeline", category: "Trust" },
  { method: "GET", path: "/files/{id}/access-summary", scope: "trust:read", description: "Access entries with state", category: "Trust" },
  { method: "GET", path: "/files/{id}/shares", scope: "shares:list", description: "List active collaborator shares on file", category: "Sharing" },
  { method: "DELETE", path: "/files/{id}/revoke/{user_id}", scope: "shares:revoke", description: "Revoke collaborator access on file", category: "Sharing" },
  { method: "DELETE", path: "/files/{id}/revoke-external", scope: "shares:revoke", description: "Revoke all external access", category: "Trust" },
  { method: "GET", path: "/shares", scope: "shares:list", description: "List all outbound shares", category: "Sharing" },
  { method: "GET", path: "/files/{fileId}/share-links", scope: "shares:list", description: "List public share links for a file", category: "Sharing" },
  { method: "POST", path: "/files/{fileId}/share-link", scope: "shares:create", description: "Create share link (supports Idempotency-Key)", category: "Sharing" },
  { method: "DELETE", path: "/share-links/{linkId}", scope: "shares:revoke", description: "Revoke share link", category: "Sharing" },
  { method: "POST", path: "/folders/{folderId}/share-link", scope: "shares:create", description: "Create folder public share link", category: "Sharing" },
  { method: "GET", path: "/folders/{folderId}/share-links", scope: "shares:list", description: "List folder public share links", category: "Sharing" },
  { method: "DELETE", path: "/folder-share-links/{linkId}", scope: "shares:revoke", description: "Revoke folder public share link", category: "Sharing" },
  { method: "GET", path: "/file-requests", scope: "requests:list", description: "List file requests", category: "Requests" },
  { method: "POST", path: "/file-requests", scope: "requests:create", description: "Create file request", category: "Requests" },
  { method: "DELETE", path: "/file-requests/{id}", scope: "requests:revoke", description: "Revoke file request", category: "Requests" },
  { method: "POST", path: "/drop/create", scope: "requests:create", description: "Create Secure Drop link into a target folder", category: "Requests" },
  { method: "GET", path: "/drop/tokens", scope: "requests:list", description: "List Secure Drop links", category: "Requests" },
  { method: "GET", path: "/collection-templates", scope: "requests:list", description: "List reusable collection templates", category: "Requests" },
  { method: "GET", path: "/folders", scope: "folders:read", description: "List accessible folders (filtered by folder jail if configured)", category: "Folders" },
  { method: "GET", path: "/folders/shared", scope: "folders:read", description: "List folders shared with account including wrapped keys", category: "Folders" },
  { method: "GET", path: "/folders/{id}/files", scope: "files:list", description: "List files inside a specific folder", category: "Folders" },
  { method: "POST", path: "/folders", scope: "folders:write", description: "Create folder (supports parentId & Idempotency-Key)", category: "Folders" },
  { method: "PUT", path: "/folders/{id}", scope: "folders:write", description: "Update or move folder within allowed jail", category: "Folders" },
  { method: "DELETE", path: "/folders/{id}", scope: "files:soft_delete (abrnak_del_)", description: "Move folder subtree to Recoverable Trash (Special Delete-Only key)", category: "Folders" },
  { method: "GET", path: "/activity", scope: "activity:read", description: "Activity feed", category: "Audit" },
  { method: "GET", path: "/audit", scope: "activity:read", description: "Audit log with filters", category: "Audit" },
  { method: "GET", path: "/audit/export", scope: "activity:read", description: "Export audit log CSV", category: "Audit" },
  { method: "GET", path: "/users/me/public-key", scope: "files:upload_ciphertext", description: "Fetch vault owner RSA-OAEP public key for zero-knowledge upload", category: "Keys" },
  { method: "GET", path: "/users/{id}/public-key", scope: "shares:create", description: "Fetch recipient RSA-OAEP public key for sharing", category: "Keys" },
  { method: "GET", path: "/agent-keys", scope: "api_keys:read", description: "List agent keys and active guardrails", category: "Keys" },
  { method: "POST", path: "/agent-keys", scope: "api_keys:write", description: "Mint key or attenuated child key (never escalates delete/jail/IP/RPM)", category: "Keys" },
  { method: "DELETE", path: "/agent-keys/{id}", scope: "api_keys:write", description: "Revoke agent key immediately", category: "Keys" },
  { method: "GET", path: "/auth/introspect", scope: "(none)", description: "Introspect key_kind, scopes, folder jail, IPs, RPM, and owner public key", category: "Keys" },
];

const METHOD_COLORS: Record<string, string> = {
  GET: "bg-emerald-100 text-emerald-700 border-emerald-200",
  POST: "bg-sky-100 text-sky-700 border-sky-200",
  PUT: "bg-amber-100 text-amber-700 border-amber-200",
  DELETE: "bg-rose-100 text-rose-700 border-rose-200",
};

const CATEGORIES = ["Files", "Trust", "Sharing", "Requests", "Folders", "Audit", "Keys"];

function makeCurl(endpoint: EndpointDef): string {
  const base = `${window.location.origin}${branding.apiBasePath.replace(/\/api$/, "")}${API_BASE}`;
  const url = `${base}${endpoint.path}`;
  const isDeleteKey = endpoint.scope.includes("abrnak_del_");
  const tokenVar = isDeleteKey ? "ABRN_DELETE_API_KEY" : branding.agentKeyEnvVar;
  const parts = [`curl -s`];
  if (endpoint.method !== "GET") parts.push(`-X ${endpoint.method}`);
  parts.push(`"${url}"`);
  parts.push(`-H "Authorization: Bearer $${tokenVar}"`);
  if ((endpoint.method === "POST" || endpoint.method === "PUT") && !endpoint.path.includes("upload")) {
    parts.push(`-H "Idempotency-Key: req-$(date +%s)"`);
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
      className="inline-flex items-center gap-1.5 text-xs text-primary hover:text-primary/90 transition-colors"
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
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-muted transition-colors"
      >
        <span className={`rounded-md border px-2 py-0.5 text-[10px] font-bold tracking-wider ${METHOD_COLORS[ep.method]}`}>
          {ep.method}
        </span>
        <code className="text-xs text-foreground font-mono flex-1 truncate">
          {API_BASE}{ep.path}
        </code>
        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground shrink-0">
          {ep.scope}
        </span>
        {expanded ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
      </button>
      {expanded && (
        <div className="border-t border-border px-3 py-3 space-y-2 bg-muted/60">
          <p className="text-xs text-muted-foreground">{ep.description}</p>
          <div className="rounded-lg border border-border bg-muted px-3 py-2.5">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">curl</span>
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

  const sdkSnippet = `import { AbrnDriveClient, encryptAndUploadForOwner } from "@abrn-drive/sdk";

const client = new AbrnDriveClient({
  baseUrl: "${window.location.origin}${branding.apiBasePath}",
  apiKey: process.env.${branding.agentKeyEnvVar}!,
});

const { file, sha256 } = await encryptAndUploadForOwner(client, {
  filename: "cfdi-resumen.txt",
  data: "Factura timbrada cero conocimiento",
  mimeType: "text/plain",
});`;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
          <Code2 className="w-5 h-5 text-primary" />
          Referencia API Zero-Knowledge
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          {ENDPOINTS.length} endpoints versionados bajo <code className="text-xs bg-muted px-1.5 py-0.5 rounded">/api/v1</code>. Borrado aislado a llaves especiales <code className="text-xs bg-muted px-1.5 py-0.5 rounded">abrnak_del_</code> y siempre recuperable desde la Papelera.
        </p>
      </div>

      {/* Quick-start box */}
      <div className="rounded-2xl border border-border bg-card px-5 py-4 space-y-3">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-primary" />
          <p className="text-sm font-semibold text-foreground">Inicio rápido · SDK & MCP Zero-Knowledge</p>
        </div>
        <div className="rounded-lg border border-border bg-muted px-3 py-2.5">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">verificar llave e introspect</span>
            <CopyButton text={`curl -s "${window.location.origin}${branding.apiBasePath}/v1/auth/introspect" \\\n  -H "Authorization: Bearer $${branding.agentKeyEnvVar}" | jq .`} />
          </div>
          <pre className="text-[11px] text-emerald-400 font-mono whitespace-pre-wrap break-all leading-relaxed">
{`curl -s "${window.location.origin}${branding.apiBasePath}/v1/auth/introspect" \\
  -H "Authorization: Bearer $${branding.agentKeyEnvVar}" | jq .`}
          </pre>
        </div>
        <div className="rounded-lg border border-border bg-muted px-3 py-2.5">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">TypeScript WebCrypto SDK (@abrn-drive/sdk)</span>
            <CopyButton text={sdkSnippet} />
          </div>
          <pre className="text-[11px] text-emerald-400 font-mono whitespace-pre-wrap break-all leading-relaxed">{sdkSnippet}</pre>
        </div>
        <div className="grid gap-2 sm:grid-cols-3 text-[11px]">
          <div className="rounded-xl border border-border bg-muted/80 px-3 py-2 text-muted-foreground">
            <Globe className="w-3 h-3 inline mr-1" />
            Base: <code className="font-mono">{window.location.origin}{branding.apiBasePath}/v1</code>
          </div>
          <div className="rounded-xl border border-border bg-muted/80 px-3 py-2 text-muted-foreground">
            <Shield className="w-3 h-3 inline mr-1" />
            Estándar: <code className="font-mono">{branding.agentKeyPrefix}_</code> · Papelera: <code className="font-mono">abrnak_del_</code>
          </div>
          <div className="rounded-xl border border-border bg-muted/80 px-3 py-2 text-muted-foreground">
            <Code2 className="w-3 h-3 inline mr-1" />
            Reintentos seguros: <code className="font-mono">Idempotency-Key</code>
          </div>
        </div>
      </div>

      {/* Response envelope */}
      <button
        type="button"
        onClick={() => setShowEnvelope((v) => !v)}
        className="w-full rounded-2xl border border-border bg-muted px-4 py-3 flex items-center justify-between hover:bg-muted/80 transition-colors"
      >
        <span className="text-sm font-medium text-foreground">Response envelope</span>
        {showEnvelope ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>
      {showEnvelope && (
        <div className="rounded-lg border border-border bg-muted px-4 py-3">
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
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-muted text-muted-foreground border-border hover:bg-muted/80"
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
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-muted text-muted-foreground border-border hover:bg-muted/80"
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

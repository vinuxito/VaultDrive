import { useCallback, useEffect, useMemo, useState } from "react";
import { Bot, Copy, KeyRound, Loader2, ShieldCheck, Trash2 } from "lucide-react";
import { Button } from "../ui/button";
import { API_URL } from "../../utils/api";

interface AgentKeyRecord {
  id: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  status: string;
  created_at: string;
  last_used_at?: string;
  expires_at?: string;
  revoked_at?: string;
  created_by_ip?: string;
  last_used_ip?: string;
  last_used_user_agent?: string;
  notes?: string;
  usage_count: number;
  plaintext_key?: string;
}

interface Envelope<T> {
  success: boolean;
  data: T;
}

const scopeGroups = [
  "files:list",
  "files:read_metadata",
  "files:upload_ciphertext",
  "files:download_ciphertext",
  "folders:read",
  "folders:write",
  "shares:create",
  "shares:list",
  "shares:revoke",
  "requests:create",
  "requests:list",
  "requests:revoke",
  "activity:read",
  "trust:read",
  "api_keys:read",
  "api_keys:write",
];

function CreateKeyModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (key: AgentKeyRecord) => void;
}) {
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [expiryDays, setExpiryDays] = useState("30");
  const [selectedScopes, setSelectedScopes] = useState<string[]>([
    "files:list",
    "files:read_metadata",
    "activity:read",
    "trust:read",
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<AgentKeyRecord | null>(null);
  const [copied, setCopied] = useState(false);

  const expiryIso = useMemo(() => {
    if (expiryDays === "never") return "";
    return new Date(Date.now() + Number(expiryDays) * 24 * 60 * 60 * 1000).toISOString();
  }, [expiryDays]);

  if (!open) return null;

  const toggleScope = (scope: string) => {
    setSelectedScopes((current) =>
      current.includes(scope) ? current.filter((value) => value !== scope) : [...current, scope]
    );
  };

  const handleCreate = async () => {
    setLoading(true);
    setError("");
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_URL}/v1/agent-keys`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name,
          notes,
          scopes: selectedScopes,
          expires_at: expiryIso,
        }),
      });
      const payload = (await response.json().catch(() => null)) as Envelope<AgentKeyRecord> | null;
      if (!response.ok || !payload?.data) {
        throw new Error("Could not create agent key");
      }
      setCreated(payload.data);
      onCreated(payload.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create agent key");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-2xl rounded-3xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-200 bg-gradient-to-r from-[#f8f4f1] to-white">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#7d4f50] text-white">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Create agent API key</h3>
              <p className="text-sm text-slate-500">Scoped, revocable access for outside systems and agents.</p>
            </div>
          </div>
        </div>

        {created ? (
          <div className="p-6 space-y-4">
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4">
              <div className="flex items-center gap-2 text-emerald-700 font-medium">
                <ShieldCheck className="w-4 h-4" />
                Agent key created with controlled scope
              </div>
              <p className="mt-2 text-sm text-emerald-700/90">
                Save this key now. ABRN Drive will only show the visible prefix after you close this receipt.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 space-y-2">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">One-time secret</p>
              <code className="block break-all rounded-xl bg-white px-3 py-3 text-sm text-slate-700 border border-slate-200">
                {created.plaintext_key}
              </code>
              <button
                type="button"
                onClick={async () => {
                  await navigator.clipboard.writeText(created.plaintext_key || "");
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                className="inline-flex items-center gap-2 text-sm text-[#7d4f50] hover:text-[#6b4345]"
              >
                <Copy className="w-4 h-4" />
                {copied ? "Copied" : "Copy key"}
              </button>
            </div>

            <div className="grid gap-3 md:grid-cols-2 text-sm text-slate-600">
              <div className="rounded-2xl border border-slate-200 px-4 py-3 bg-white">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Visible prefix</p>
                <p className="mt-1 font-medium text-slate-900">{created.key_prefix}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 px-4 py-3 bg-white">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Expires</p>
                <p className="mt-1 font-medium text-slate-900">
                  {created.expires_at ? new Date(created.expires_at).toLocaleString() : "No automatic expiry"}
                </p>
              </div>
            </div>

            <div className="flex justify-end">
              <Button onClick={onClose} className="bg-[#7d4f50] hover:bg-[#6b4345] text-white">Done</Button>
            </div>
          </div>
        ) : (
          <div className="p-6 space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label htmlFor="agent-key-name" className="text-sm font-medium text-slate-700">Key name</label>
                <input
                  id="agent-key-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="e.g. CRM sync agent"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-[#7d4f50] focus:outline-none"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="agent-key-expiry" className="text-sm font-medium text-slate-700">Expiry</label>
                <select
                  id="agent-key-expiry"
                  value={expiryDays}
                  onChange={(event) => setExpiryDays(event.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-[#7d4f50] focus:outline-none"
                >
                  <option value="7">7 days</option>
                  <option value="30">30 days</option>
                  <option value="90">90 days</option>
                  <option value="never">No expiry</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="agent-key-notes" className="text-sm font-medium text-slate-700">Notes</label>
              <textarea
                id="agent-key-notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Why this agent exists and what it should be allowed to do"
                rows={2}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-[#7d4f50] focus:outline-none"
              />
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <p className="text-sm font-medium text-slate-800">Scopes</p>
              <p className="mt-1 text-sm text-slate-500">Start narrow. These keys never carry decryption authority.</p>
              <div className="mt-4 grid gap-2 md:grid-cols-2">
                {scopeGroups.map((scope) => (
                  <label key={scope} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={selectedScopes.includes(scope)}
                      onChange={() => toggleScope(scope)}
                      className="h-4 w-4 accent-[#7d4f50]"
                    />
                    {scope}
                  </label>
                ))}
              </div>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button
                onClick={() => void handleCreate()}
                disabled={loading || !name.trim() || selectedScopes.length === 0}
                className="bg-[#7d4f50] hover:bg-[#6b4345] text-white"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4 mr-2" />}
                Create key
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function AgentApiKeysSection() {
  const [keys, setKeys] = useState<AgentKeyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const fetchKeys = useCallback(async () => {
    const token = localStorage.getItem("token");
    const response = await fetch(`${API_URL}/v1/agent-keys`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const payload = (await response.json().catch(() => null)) as Envelope<AgentKeyRecord[]> | null;
    setKeys(payload?.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void fetchKeys();
  }, [fetchKeys]);

  const revokeKey = async (key: AgentKeyRecord) => {
    if (!window.confirm(`Revoke ${key.name}? The agent will stop working immediately.`)) return;
    const token = localStorage.getItem("token");
    await fetch(`${API_URL}/v1/agent-keys/${key.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    void fetchKeys();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-900 flex items-center gap-2">
            <Bot className="w-5 h-5 text-[#7d4f50]" />
            Agent API keys
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Scoped credentials for external systems, automation, and AI agents. Ciphertext-first by default.
          </p>
        </div>
        <Button onClick={() => setShowCreateModal(true)} className="bg-[#7d4f50] hover:bg-[#6b4345] text-white">
          <KeyRound className="w-4 h-4 mr-2" />
          New key
        </Button>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-[#fbfaf8] px-4 py-4 text-sm text-slate-600">
        <p className="font-medium text-slate-800">Trust boundary</p>
        <p className="mt-1">
          These keys can manage metadata, ciphertext movement, links, requests, and audit surfaces. They do not grant silent plaintext access.
        </p>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-500">
          Loading agent keys...
        </div>
      ) : keys.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm text-slate-500">
          No agent keys yet. Create one when you want an outside system to work through ABRN Drive.
        </div>
      ) : (
        <div className="space-y-3">
          {keys.map((key) => (
            <div key={key.id} className="rounded-2xl border border-slate-200 bg-white px-4 py-4 space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-slate-900">{key.name}</p>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${key.status === "active" ? "bg-emerald-100 text-emerald-700" : key.status === "revoked" ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"}`}>
                      {key.status}
                    </span>
                    <code className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">{key.key_prefix}</code>
                  </div>
                  <p className="mt-1 text-sm text-slate-500">Created {new Date(key.created_at).toLocaleString()}</p>
                </div>
                {key.status === "active" && (
                  <Button variant="outline" onClick={() => void revokeKey(key)} className="text-rose-700 border-rose-200 hover:bg-rose-50">
                    <Trash2 className="w-4 h-4 mr-2" />
                    Revoke
                  </Button>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                {key.scopes.map((scope) => (
                  <span key={scope} className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-600">
                    {scope}
                  </span>
                ))}
              </div>

              <div className="grid gap-3 md:grid-cols-3 text-sm text-slate-600">
                <div className="rounded-xl bg-slate-50 px-3 py-3 border border-slate-200">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Last used</p>
                  <p className="mt-1 text-slate-900 font-medium">{key.last_used_at ? new Date(key.last_used_at).toLocaleString() : "Never used"}</p>
                </div>
                <div className="rounded-xl bg-slate-50 px-3 py-3 border border-slate-200">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Last seen from</p>
                  <p className="mt-1 text-slate-900 font-medium">{key.last_used_ip || "No requests yet"}</p>
                </div>
                <div className="rounded-xl bg-slate-50 px-3 py-3 border border-slate-200">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Usage count</p>
                  <p className="mt-1 text-slate-900 font-medium">{key.usage_count}</p>
                </div>
              </div>

              {key.last_used_user_agent && (
                <p className="text-xs text-slate-500">User agent: {key.last_used_user_agent}</p>
              )}
            </div>
          ))}
        </div>
      )}

      <CreateKeyModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreated={(record) => {
          setKeys((current) => [record, ...current]);
        }}
      />
    </div>
  );
}

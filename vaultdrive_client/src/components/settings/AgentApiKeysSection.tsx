import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bot, Copy, KeyRound, Loader2, ShieldCheck, Trash2 } from "lucide-react";
import { Button } from "../ui/button";
import { API_URL } from "../../utils/api";
import { relativeTime } from "../../utils/format";
import { branding } from "../../config/branding";

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

const scopeLabels: Record<string, string> = {
  "files:list": "List files",
  "files:read_metadata": "Read file metadata",
  "files:upload_ciphertext": "Upload encrypted files",
  "files:download_ciphertext": "Download encrypted files",
  "folders:read": "List folders",
  "folders:write": "Create & manage folders",
  "shares:create": "Create share links",
  "shares:list": "List share links",
  "shares:revoke": "Revoke share links",
  "requests:create": "Create file requests",
  "requests:list": "List file requests",
  "requests:revoke": "Revoke file requests",
  "activity:read": "Read activity log",
  "trust:read": "Read trust & security data",
  "api_keys:read": "List agent keys",
  "api_keys:write": "Create & revoke agent keys",
};

const scopeCategories = [
  {
    label: "Files",
    description: "Read and move encrypted file data",
    scopes: ["files:list", "files:read_metadata", "files:upload_ciphertext", "files:download_ciphertext"],
  },
  {
    label: "Folders",
    description: "Navigate and organize the vault",
    scopes: ["folders:read", "folders:write"],
  },
  {
    label: "Sharing",
    description: "Manage public share links",
    scopes: ["shares:create", "shares:list", "shares:revoke"],
  },
  {
    label: "File Requests",
    description: "Manage inbound collection links",
    scopes: ["requests:create", "requests:list", "requests:revoke"],
  },
  {
    label: "Audit & Trust",
    description: "Read activity and security history",
    scopes: ["activity:read", "trust:read"],
  },
  {
    label: "API Keys",
    description: "Manage scoped agent credentials",
    scopes: ["api_keys:read", "api_keys:write"],
  },
];

interface ScopeTemplate {
  id: string;
  label: string;
  description: string;
  scopes: string[];
}

const scopeTemplates: ScopeTemplate[] = [
  {
    id: "read-only",
    label: "Read-Only Observer",
    description: "List files, read metadata, view trust and audit data. No write access.",
    scopes: ["files:list", "files:read_metadata", "trust:read", "activity:read"],
  },
  {
    id: "reconciliation",
    label: "Reconciliation Agent",
    description: "Read files, download ciphertext, and audit for reconciliation workflows.",
    scopes: ["files:list", "files:read_metadata", "files:download_ciphertext", "folders:read", "activity:read", "trust:read"],
  },
  {
    id: "upload",
    label: "Upload Agent",
    description: "Upload encrypted files and manage folders. No download or sharing.",
    scopes: ["files:upload_ciphertext", "folders:read", "folders:write"],
  },
  {
    id: "share-manager",
    label: "Share Manager",
    description: "Create and manage share links, file requests, and Secure Drop routes.",
    scopes: ["files:list", "files:read_metadata", "shares:create", "shares:list", "shares:revoke", "requests:create", "requests:list", "requests:revoke"],
  },
  {
    id: "full-ciphertext",
    label: "Full Ciphertext Operator",
    description: "All file, folder, sharing, and audit scopes. Maximum operational reach.",
    scopes: [
      "files:list", "files:read_metadata", "files:upload_ciphertext", "files:download_ciphertext",
      "folders:read", "folders:write",
      "shares:create", "shares:list", "shares:revoke",
      "requests:create", "requests:list", "requests:revoke",
      "activity:read", "trust:read",
    ],
  },
];

const DEFAULT_SELECTED_SCOPES = [
  "files:list",
  "files:read_metadata",
  "activity:read",
  "trust:read",
];

const FOCUSABLE_SELECTOR = [
  "button:not([disabled])",
  "[href]",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(", ");

function CreateKeyModal({
  open,
  onClose,
  onCreated,
  returnFocusRef,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (key: AgentKeyRecord) => void;
  returnFocusRef: React.RefObject<HTMLElement | null>;
}) {
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [expiryDays, setExpiryDays] = useState("30");
  const [selectedScopes, setSelectedScopes] = useState<string[]>(DEFAULT_SELECTED_SCOPES);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<AgentKeyRecord | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirmedCopy, setConfirmedCopy] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  const resetModalState = useCallback(() => {
    setName("");
    setNotes("");
    setExpiryDays("30");
    setSelectedScopes(DEFAULT_SELECTED_SCOPES);
    setLoading(false);
    setError("");
    setCreated(null);
    setCopied(false);
    setConfirmedCopy(false);
  }, []);

  const expiryIso = useMemo(() => {
    if (expiryDays === "never") return "";
    return new Date(Date.now() + Number(expiryDays) * 24 * 60 * 60 * 1000).toISOString();
  }, [expiryDays]);

  const handleClose = useCallback(() => {
    if (created && !confirmedCopy) return;
    resetModalState();
    onClose();
    window.setTimeout(() => {
      returnFocusRef.current?.focus();
    }, 0);
  }, [confirmedCopy, created, onClose, resetModalState, returnFocusRef]);

  const getFocusableElements = useCallback(() => {
    if (!modalRef.current) return [] as HTMLElement[];

    return Array.from(modalRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
      (element) => !element.hasAttribute("disabled")
    );
  }, []);

  useEffect(() => {
    if (!open) return;

    const frameId = window.requestAnimationFrame(() => {
      const [firstFocusable] = getFocusableElements();
      if (created) {
        firstFocusable?.focus() ?? modalRef.current?.focus();
        return;
      }
      firstFocusable?.focus() ?? modalRef.current?.focus();
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [created, getFocusableElements, open]);

  useEffect(() => {
    if (!copied) return;

    const timeoutId = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timeoutId);
  }, [copied]);

  const handleModalKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === "Escape") {
        event.preventDefault();
        if (!created) {
          handleClose();
        }
        return;
      }

      if (event.key !== "Tab") return;

      const focusableElements = getFocusableElements();
      if (focusableElements.length === 0) {
        event.preventDefault();
        return;
      }

      const firstFocusable = focusableElements[0];
      const lastFocusable = focusableElements[focusableElements.length - 1];
      const activeElement = document.activeElement;

      if (event.shiftKey) {
        if (activeElement === firstFocusable || activeElement === modalRef.current) {
          event.preventDefault();
          lastFocusable.focus();
        }
        return;
      }

      if (activeElement === lastFocusable) {
        event.preventDefault();
        firstFocusable.focus();
      }
    },
    [created, getFocusableElements, handleClose]
  );

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
      setCopied(false);
      setConfirmedCopy(false);
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
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-agent-key-title"
        tabIndex={-1}
        onKeyDown={handleModalKeyDown}
        className="w-full max-w-2xl rounded-3xl border border-border bg-card shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
      >
        <div className="px-6 py-5 border-b border-border bg-gradient-to-r from-muted/50 to-card shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-white shrink-0">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h3 id="create-agent-key-title" className="text-lg font-semibold text-foreground">Create agent API key</h3>
              <p className="text-sm text-muted-foreground">Scoped, revocable access for outside systems and agents.</p>
            </div>
          </div>
        </div>

        {created ? (
          <div className="p-6 space-y-4 overflow-y-auto">
            <div className="brand-receipt-surface rounded-2xl px-4 py-4">
              <div className="flex items-center gap-2 text-primary font-medium">
                <ShieldCheck className="w-4 h-4" />
                Agent key created — save it now
              </div>
              <p className="mt-2 text-sm text-primary/90">
                {`This is the only time ${branding.productName} will show the full key. After you close this window, only the visible prefix remains.`}
              </p>
            </div>

            <div className="rounded-2xl border border-border bg-muted px-4 py-4 space-y-2">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">One-time secret</p>
              <code className="block break-all rounded-xl bg-card px-3 py-3 text-sm text-foreground border border-border">
                {created.plaintext_key}
              </code>
              <button
                type="button"
                onClick={async () => {
                  await navigator.clipboard.writeText(created.plaintext_key || "");
                  setCopied(true);
                }}
                className="inline-flex items-center gap-2 text-sm text-primary hover:text-primary/90"
              >
                <Copy className="w-4 h-4" />
                {copied ? "Copied" : "Copy key"}
              </button>
              <span className="sr-only" aria-live="polite">
                {copied ? "API key copied to clipboard" : ""}
              </span>
            </div>

            <div className="grid gap-3 md:grid-cols-2 text-sm text-muted-foreground">
              <div className="rounded-2xl border border-border px-4 py-3 bg-card">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Visible prefix</p>
                <p className="mt-1 font-medium text-foreground">{created.key_prefix}</p>
              </div>
              <div className="rounded-2xl border border-border px-4 py-3 bg-card">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Expires</p>
                <p className="mt-1 font-medium text-foreground">
                  {created.expires_at ? new Date(created.expires_at).toLocaleString() : "No automatic expiry"}
                </p>
              </div>
            </div>

            <label className="flex items-start gap-3 rounded-2xl border border-border bg-muted/60 px-4 py-3 text-sm text-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={confirmedCopy}
                onChange={(event) => setConfirmedCopy(event.target.checked)}
                className="mt-0.5 h-4 w-4 accent-primary shrink-0"
              />
              <span>
                <span className="font-medium">I&apos;ve saved this key</span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  Confirm before closing, because the full secret will not be shown again.
                </span>
              </span>
            </label>

            <div className="flex justify-end">
              <Button
                onClick={handleClose}
                disabled={!confirmedCopy}
                className="bg-primary hover:bg-primary/90 text-white disabled:cursor-not-allowed"
              >
                Done
              </Button>
            </div>
          </div>
        ) : (
          <div className="p-6 space-y-5 overflow-y-auto">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label htmlFor="agent-key-name" className="text-sm font-medium text-foreground">Key name</label>
                <input
                  id="agent-key-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  maxLength={64}
                  placeholder="e.g. CRM sync agent"
                  className="w-full rounded-xl border border-border px-3 py-2 text-sm focus:border-primary focus:outline-none"
                />
                {name.length > 50 && (
                  <p className="text-xs text-muted-foreground text-right">{name.length}/64</p>
                )}
              </div>
              <div className="space-y-2">
                <label htmlFor="agent-key-expiry" className="text-sm font-medium text-foreground">Expiry</label>
                <select
                  id="agent-key-expiry"
                  value={expiryDays}
                  onChange={(event) => setExpiryDays(event.target.value)}
                  className="w-full rounded-xl border border-border px-3 py-2 text-sm focus:border-primary focus:outline-none"
                >
                  <option value="7">7 days</option>
                  <option value="30">30 days</option>
                  <option value="90">90 days</option>
                  <option value="never">No expiry</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="agent-key-notes" className="text-sm font-medium text-foreground">Purpose</label>
              <textarea
                id="agent-key-notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="What this agent does and why it needs access"
                rows={2}
                className="w-full rounded-xl border border-border px-3 py-2 text-sm focus:border-primary focus:outline-none"
              />
            </div>

            <div className="rounded-2xl border border-border bg-muted px-4 py-4 space-y-4">
              <div>
                <p className="text-sm font-semibold text-foreground">Permissions</p>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  Start narrow. These keys never carry decryption authority over your files.
                </p>
              </div>
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-foreground uppercase tracking-[0.1em]">Scope templates</p>
                <div className="grid gap-1.5 md:grid-cols-2">
                  {scopeTemplates.map((tmpl) => {
                    const isActive = tmpl.scopes.length === selectedScopes.length &&
                      tmpl.scopes.every((s) => selectedScopes.includes(s));
                    return (
                      <button
                        key={tmpl.id}
                        type="button"
                        onClick={() => setSelectedScopes([...tmpl.scopes])}
                        className={`text-left rounded-xl border px-3 py-2 text-sm transition-colors ${
                          isActive
                            ? "border-primary bg-muted text-primary/90"
                            : "border-border bg-card text-foreground hover:bg-muted"
                        }`}
                      >
                        <span className="font-medium">{tmpl.label}</span>
                        <span className="block text-xs text-muted-foreground mt-0.5">{tmpl.description}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              {scopeCategories.map((category) => (
                <div key={category.label} className="space-y-1.5">
                  <div className="flex items-baseline gap-2">
                    <p className="text-xs font-semibold text-foreground uppercase tracking-[0.1em]">{category.label}</p>
                    <p className="text-xs text-muted-foreground">{category.description}</p>
                  </div>
                  <div className="grid gap-1.5 md:grid-cols-2">
                    {category.scopes.map((scope) => (
                      <label
                        key={scope}
                        className="flex items-center gap-2.5 rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground cursor-pointer hover:bg-muted transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={selectedScopes.includes(scope)}
                          onChange={() => toggleScope(scope)}
                          className="h-4 w-4 accent-primary shrink-0"
                        />
                        <span className="flex-1">{scopeLabels[scope] ?? scope}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={handleClose}>Cancel</Button>
              <Button
                onClick={() => void handleCreate()}
                disabled={loading || !name.trim() || selectedScopes.length === 0}
                className="bg-primary hover:bg-primary/90 text-white"
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
  const [confirmRevokeId, setConfirmRevokeId] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<string>("");
  const [error, setError] = useState<string>("");
  const createKeyTriggerRef = useRef<HTMLButtonElement | null>(null);

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

  const revokeKey = async (keyId: string) => {
    setRevokingId(keyId);
    try {
      const token = localStorage.getItem("token");
      const keyName = keys.find((entry) => entry.id === keyId)?.name ?? "Agent key";
      const response = await fetch(`${API_URL}/v1/agent-keys/${keyId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        throw new Error("Could not revoke agent key");
      }
      setError("");
      setReceipt(`${keyName} was revoked. Any agent using it loses access immediately.`);
      void fetchKeys();
    } catch {
      setError("Could not revoke this agent key right now.");
    } finally {
      setRevokingId(null);
      setConfirmRevokeId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
            <Bot className="w-5 h-5 text-primary" />
            Agent API keys
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Scoped credentials for external systems, automation, and AI agents. Ciphertext-first by default.
          </p>
        </div>
        <Button
          onClick={(event) => {
            createKeyTriggerRef.current = event.currentTarget;
            setShowCreateModal(true);
          }}
          className="bg-primary hover:bg-primary/90 text-white shrink-0"
        >
          <KeyRound className="w-4 h-4 mr-2" />
          New key
        </Button>
      </div>

      <div className="rounded-2xl border border-border bg-card px-4 py-4 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">Trust boundary</p>
        <p className="mt-1">
          These keys can manage metadata, ciphertext movement, links, requests, and audit surfaces. They do not grant silent plaintext access.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-3 text-sm">
        <div className="rounded-2xl border border-border bg-card px-4 py-4">
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Scoped power</p>
          <p className="mt-2 text-foreground font-medium">Grant only the job</p>
          <p className="mt-1 text-xs text-muted-foreground">Start narrow, then expand only if the workflow truly needs more reach.</p>
        </div>
        <div className="rounded-2xl border border-border bg-card px-4 py-4">
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Visible use</p>
          <p className="mt-2 text-foreground font-medium">See when it was active</p>
          <p className="mt-1 text-xs text-muted-foreground">Every key shows last-used context so delegation never becomes invisible.</p>
        </div>
        <div className="rounded-2xl border border-border bg-card px-4 py-4">
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Immediate revoke</p>
          <p className="mt-2 text-foreground font-medium">Pull access back instantly</p>
          <p className="mt-1 text-xs text-muted-foreground">If a workflow changes, the key can stop working right away.</p>
        </div>
      </div>

      {receipt && (
        <div className="brand-receipt-surface rounded-2xl px-4 py-4 text-sm text-primary dark:text-primary">
          <p className="font-medium">Done, safe, under control.</p>
          <p className="mt-1 text-primary dark:text-emerald-200">{receipt}</p>
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-4 text-sm text-destructive">
          <p className="font-medium">Action could not be completed.</p>
          <p className="mt-1 text-destructive">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="rounded-2xl border border-border bg-card px-4 py-6 text-sm text-muted-foreground">
          Loading agent keys…
        </div>
      ) : keys.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
          {`No agent keys yet. Create one when you want an outside system to work through ${branding.productName}.`}
        </div>
      ) : (
        <div className="space-y-3">
          {keys.map((key) => {
            const isRevoked = key.status === "revoked";
            const isExpired = key.status === "expired";

            return (
              <div
                key={key.id}
                className={`rounded-[1.5rem] border border-border bg-card px-4 py-4 space-y-3 shadow-sm ${
                  isRevoked ? "opacity-60" : isExpired ? "opacity-75" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p
                        className={`font-medium ${
                          isRevoked
                            ? "text-muted-foreground line-through"
                            : isExpired
                              ? "text-muted-foreground"
                              : "text-foreground"
                        }`}
                      >
                        {key.name}
                      </p>
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                          key.status === "active"
                            ? "bg-emerald-100 text-emerald-700"
                            : key.status === "revoked"
                              ? "bg-destructive/10 text-destructive"
                              : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {key.status}
                      </span>
                      <code className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">{key.key_prefix}</code>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">Created {new Date(key.created_at).toLocaleString()}</p>
                  </div>

                  {key.status === "active" && (
                    confirmRevokeId === key.id ? (
                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setConfirmRevokeId(null)}
                          className="text-muted-foreground border-border"
                        >
                          Cancel
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => void revokeKey(key.id)}
                          disabled={revokingId === key.id}
                          className="text-destructive border-destructive/20 hover:bg-destructive/10"
                        >
                          {revokingId === key.id ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirm revoke"}
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        onClick={() => setConfirmRevokeId(key.id)}
                        className="text-destructive border-destructive/20 hover:bg-destructive/10 shrink-0"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Revoke
                      </Button>
                    )
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  {key.scopes.map((scope) => (
                    <span key={scope} className="rounded-full border border-border bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                      {scopeLabels[scope] ?? scope}
                    </span>
                  ))}
                </div>

                <div className="rounded-xl border border-border bg-card px-3 py-3 text-sm text-muted-foreground">
                  <p className="font-medium text-foreground">Delegated power</p>
                  <p className="mt-1 leading-relaxed">
                    This key can operate within {key.scopes.length} granted scope{key.scopes.length !== 1 ? "s" : ""}. It can move ciphertext and metadata, but it cannot silently decrypt your files.
                  </p>
                </div>

                <div className="grid gap-3 md:grid-cols-3 text-sm text-muted-foreground">
                  <div className="rounded-xl bg-muted px-3 py-3 border border-border">
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Last used</p>
                    <p className="mt-1 text-foreground font-medium">
                      {key.last_used_at ? relativeTime(key.last_used_at) : "Never used"}
                    </p>
                    {key.last_used_at && (
                      <p className="mt-1 text-xs text-muted-foreground">{new Date(key.last_used_at).toLocaleString()}</p>
                    )}
                  </div>
                  <div className="rounded-xl bg-muted px-3 py-3 border border-border">
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Last seen from</p>
                    <p className="mt-1 text-foreground font-medium">{key.last_used_ip || "No requests yet"}</p>
                  </div>
                  <div className="rounded-xl bg-muted px-3 py-3 border border-border">
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Usage count</p>
                    <p className="mt-1 text-foreground font-medium">{key.usage_count}</p>
                  </div>
                </div>

                {key.last_used_user_agent && (
                  <p className="text-xs text-muted-foreground truncate">Last agent: {key.last_used_user_agent}</p>
                )}
              </div>
            )})}
        </div>
      )}

      <CreateKeyModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        returnFocusRef={createKeyTriggerRef}
        onCreated={(record) => {
          setError("");
          setReceipt(`${record.name} is ready. Save the one-time secret now; only the prefix remains after you close the modal.`);
          setKeys((current) => [record, ...current]);
        }}
      />
    </div>
  );
}

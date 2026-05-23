import { useState, useEffect } from "react";
import { DashboardLayout } from "../components/layout/dashboard-layout";
import { API_URL } from "../utils/api";
import { ShieldCheck, Link2, Upload, FileQuestion, ExternalLink, Copy, AlertTriangle, Clock, CheckCircle, XCircle, Ban } from "lucide-react";
import { Button } from "../components/ui/button";
import { relativeTime } from "../utils/format";
import { branding } from "../config/branding";

interface ShareItem {
  id: string;
  type: "file" | "folder";
  token: string;
  resource_name: string;
  resource_id: string;
  is_active: boolean;
  expires_at?: string;
  created_at: string;
  access_count: number;
  last_accessed_at?: string;
  status: "active" | "expired" | "revoked" | "stale" | "never_used";
}

interface DropToken {
  id: string;
  token: string;
  link_name?: string;
  description?: string;
  files_uploaded: number;
  last_upload_at?: string;
  expires_at?: string;
  used: boolean;
  created_at: string;
  has_password: boolean;
}

type Tab = "shares" | "drop" | "all";
type StatusFilter = "all" | "active" | "expired" | "revoked" | "never_used" | "stale";

const STATUS_BADGE: Record<string, { label: string; icon: React.ReactNode; cls: string }> = {
  active: { label: "Active", icon: <CheckCircle className="w-3 h-3" />, cls: "text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-300 dark:bg-emerald-900/30 dark:border-emerald-800" },
  expired: { label: "Expired", icon: <Clock className="w-3 h-3" />, cls: "text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-300 dark:bg-amber-900/30 dark:border-amber-800" },
  revoked: { label: "Revoked", icon: <Ban className="w-3 h-3" />, cls: "text-red-700 bg-red-50 border-red-200 dark:text-red-300 dark:bg-red-900/30 dark:border-red-800" },
  stale: { label: "Stale", icon: <AlertTriangle className="w-3 h-3" />, cls: "text-orange-700 bg-orange-50 border-orange-200 dark:text-orange-300 dark:bg-orange-900/30 dark:border-orange-800" },
  never_used: { label: "Never used", icon: <XCircle className="w-3 h-3" />, cls: "text-muted-foreground bg-muted border-border" },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_BADGE[status] ?? STATUS_BADGE.active;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.cls}`}>
      {cfg.icon}
      {cfg.label}
    </span>
  );
}

function copyToClipboard(text: string) {
  void navigator.clipboard.writeText(text);
}

export default function AccessCenter() {
  const [tab, setTab] = useState<Tab>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [shares, setShares] = useState<ShareItem[]>([]);
  const [dropTokens, setDropTokens] = useState<DropToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("token");
    const headers = { Authorization: `Bearer ${token}` };
    setLoading(true);
    Promise.all([
      fetch(`${API_URL}/v1/shares`, { headers }).then((r) => r.ok ? r.json() as Promise<ShareItem[]> : []),
      fetch(`${API_URL}/drop/tokens`, { headers }).then((r) => r.ok ? r.json() as Promise<DropToken[]> : []),
    ])
      .then(([s, d]) => {
        setShares(s ?? []);
        setDropTokens(d ?? []);
      })
      .finally(() => setLoading(false));
  }, []);

  function handleCopy(id: string, text: string) {
    copyToClipboard(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  }

  // Derive drop token status.
  function dropStatus(t: DropToken): string {
    if (t.used) return "revoked";
    if (t.expires_at && new Date(t.expires_at) < new Date()) return "expired";
    if (t.files_uploaded === 0) return "never_used";
    return "active";
  }

  // Build unified item list for "all" tab filtering.
  type UnifiedItem =
    | { kind: "share"; data: ShareItem }
    | { kind: "drop"; data: DropToken; status: string };

  const allItems: UnifiedItem[] = [
    ...shares.map((s) => ({ kind: "share" as const, data: s })),
    ...dropTokens.map((d) => ({ kind: "drop" as const, data: d, status: dropStatus(d) })),
  ];

  const filteredAllItems = allItems.filter((item) => {
    if (statusFilter === "all") return true;
    const s = item.kind === "share" ? item.data.status : item.status;
    return s === statusFilter;
  });

  const filteredShares = statusFilter === "all" ? shares : shares.filter((s) => s.status === statusFilter);
  const filteredDrops = statusFilter === "all" ? dropTokens : dropTokens.filter((d) => dropStatus(d) === statusFilter);

  const tabs: { key: Tab; label: string; icon: React.ReactNode; count: number }[] = [
    { key: "all", label: "All access", icon: <ShieldCheck className="w-4 h-4" />, count: allItems.length },
    { key: "shares", label: "Share links", icon: <Link2 className="w-4 h-4" />, count: shares.length },
    { key: "drop", label: "Drop routes", icon: <Upload className="w-4 h-4" />, count: dropTokens.length },
  ];

  const baseURL = window.location.origin + branding.basePath;

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-foreground">Access Center</h1>
            <p className="text-sm text-muted-foreground">All outbound access grants — share links and drop routes in one place.</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 border-b border-border">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                tab === t.key
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.icon}
              {t.label}
              <span className="ml-1 px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground text-xs">{t.count}</span>
            </button>
          ))}
        </div>

        {/* Status filter bar */}
        <div className="flex items-center gap-2 flex-wrap">
          {(["all", "active", "expired", "revoked", "never_used", "stale"] as StatusFilter[]).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                statusFilter === s
                  ? "bg-primary text-white border-primary"
                  : "bg-background text-muted-foreground border-border hover:border-primary/40"
              }`}
            >
              {s === "all" ? "All" : s === "never_used" ? "Never used" : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mr-3" />
            Loading access data…
          </div>
        ) : (
          <>
            {/* ALL TAB */}
            {tab === "all" && (
              filteredAllItems.length === 0 ? (
                <EmptyState />
              ) : (
                <div className="space-y-2">
                  {filteredAllItems.map((item, idx) =>
                    item.kind === "share" ? (
                      <ShareCard key={idx} item={item.data} baseURL={baseURL} copiedId={copiedId} onCopy={handleCopy} />
                    ) : (
                      <DropCard key={idx} item={item.data} status={item.status} baseURL={baseURL} copiedId={copiedId} onCopy={handleCopy} />
                    )
                  )}
                </div>
              )
            )}

            {/* SHARES TAB */}
            {tab === "shares" && (
              filteredShares.length === 0 ? <EmptyState /> : (
                <div className="space-y-2">
                  {filteredShares.map((s) => (
                    <ShareCard key={s.id} item={s} baseURL={baseURL} copiedId={copiedId} onCopy={handleCopy} />
                  ))}
                </div>
              )
            )}

            {/* DROP TAB */}
            {tab === "drop" && (
              filteredDrops.length === 0 ? <EmptyState /> : (
                <div className="space-y-2">
                  {filteredDrops.map((d) => (
                    <DropCard key={d.id} item={d} status={dropStatus(d)} baseURL={baseURL} copiedId={copiedId} onCopy={handleCopy} />
                  ))}
                </div>
              )
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
      <FileQuestion className="w-8 h-8 opacity-30" />
      <p className="text-sm">No access grants match this filter.</p>
    </div>
  );
}

interface ShareCardProps {
  item: ShareItem;
  baseURL: string;
  copiedId: string | null;
  onCopy: (id: string, text: string) => void;
}

function ShareCard({ item, baseURL, copiedId, onCopy }: ShareCardProps) {
  const shareURL = `${baseURL}/${item.type === "folder" ? "folder-share" : "share"}/${item.token}`;
  return (
    <div className="flex items-center gap-4 px-4 py-3 rounded-xl border border-border bg-card hover:bg-muted/30 transition-colors">
      <div className="w-8 h-8 rounded-lg bg-blue-500/15 flex items-center justify-center shrink-0">
        <Link2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{item.resource_name}</p>
        <p className="text-xs text-muted-foreground">
          {item.type === "folder" ? "Folder share" : "File share"} · Created {relativeTime(item.created_at)} · {item.access_count} views
          {item.last_accessed_at && ` · Last viewed ${relativeTime(item.last_accessed_at)}`}
        </p>
      </div>
      <StatusBadge status={item.status} />
      <div className="flex items-center gap-1 shrink-0">
        <Button variant="ghost" size="icon" title="Copy link" onClick={() => onCopy(item.id, shareURL)}>
          {copiedId === item.id ? <CheckCircle className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
        </Button>
        <Button variant="ghost" size="icon" title="Open link" onClick={() => window.open(shareURL, "_blank")}>
          <ExternalLink className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

interface DropCardProps {
  item: DropToken;
  status: string;
  baseURL: string;
  copiedId: string | null;
  onCopy: (id: string, text: string) => void;
}

function DropCard({ item, status, baseURL, copiedId, onCopy }: DropCardProps) {
  const dropURL = `${baseURL}/drop/${item.token}`;
  return (
    <div className="flex items-center gap-4 px-4 py-3 rounded-xl border border-border bg-card hover:bg-muted/30 transition-colors">
      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
        <Upload className="w-4 h-4 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{item.link_name ?? item.token.slice(0, 12) + "…"}</p>
        <p className="text-xs text-muted-foreground">
          Drop link · {item.files_uploaded} file{item.files_uploaded !== 1 ? "s" : ""} received
          {item.last_upload_at && ` · Last upload ${relativeTime(item.last_upload_at)}`}
          {item.expires_at && ` · Expires ${relativeTime(item.expires_at)}`}
          {item.has_password && " · Password protected"}
        </p>
      </div>
      <StatusBadge status={status} />
      <div className="flex items-center gap-1 shrink-0">
        <Button variant="ghost" size="icon" title="Copy link" onClick={() => onCopy(item.id, dropURL)}>
          {copiedId === item.id ? <CheckCircle className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
        </Button>
        <Button variant="ghost" size="icon" title="Open link" onClick={() => window.open(dropURL, "_blank")}>
          <ExternalLink className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}


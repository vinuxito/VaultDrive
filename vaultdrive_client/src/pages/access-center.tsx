import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
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
  is_active?: boolean;
  created_at: string;
  has_password: boolean;
}

type Tab = "shares" | "drop" | "all";
type StatusFilter = "all" | "active" | "expired" | "revoked" | "never_used" | "stale" | "closed" | "unknown";

interface SourceState<T> {
  data: T[];
  loading: boolean;
  error: boolean;
  stale: boolean;
}

const STATUS_BADGE: Record<string, { label: string; icon: React.ReactNode; cls: string }> = {
  active: { label: "Active", icon: <CheckCircle className="w-3 h-3" />, cls: "text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-300 dark:bg-emerald-900/30 dark:border-emerald-800" },
  expired: { label: "Expired", icon: <Clock className="w-3 h-3" />, cls: "text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-300 dark:bg-amber-900/30 dark:border-amber-800" },
  revoked: { label: "Revoked", icon: <Ban className="w-3 h-3" />, cls: "text-red-700 bg-red-50 border-red-200 dark:text-red-300 dark:bg-red-900/30 dark:border-red-800" },
  stale: { label: "Stale", icon: <AlertTriangle className="w-3 h-3" />, cls: "text-orange-700 bg-orange-50 border-orange-200 dark:text-orange-300 dark:bg-orange-900/30 dark:border-orange-800" },
  never_used: { label: "Never used", icon: <XCircle className="w-3 h-3" />, cls: "text-muted-foreground bg-muted border-border" },
  closed: { label: "Closed", icon: <Ban className="w-3 h-3" />, cls: "text-muted-foreground bg-muted border-border" },
  unknown: { label: "Unknown", icon: <AlertTriangle className="w-3 h-3" />, cls: "text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-300 dark:bg-amber-900/30 dark:border-amber-800" },
};

function StatusBadge({ status }: { status: string }) {
  const { t } = useTranslation(["drive", "common"]);
  const cfg = STATUS_BADGE[status] ?? STATUS_BADGE.unknown;
  const translated = t(`drive:accessCenter.status.${status}`, { defaultValue: cfg.label });
  const label = translated === `drive:accessCenter.status.${status}` ? cfg.label : translated;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.cls}`}>
      {cfg.icon}
      {label}
    </span>
  );
}

function copyToClipboard(text: string) {
  void navigator.clipboard.writeText(text);
}

export default function AccessCenter() {
  const { t } = useTranslation(["drive", "common"]);
  const [tab, setTab] = useState<Tab>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [shareSource, setShareSource] = useState<SourceState<ShareItem>>({ data: [], loading: true, error: false, stale: false });
  const [dropSource, setDropSource] = useState<SourceState<DropToken>>({ data: [], loading: true, error: false, stale: false });
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copy = useCallback((key: string, fallback: string) => {
    const translated = t(key, { defaultValue: fallback });
    return translated === key ? fallback : translated;
  }, [t]);

  const loadSource = useCallback(async <T,>(
    endpoint: string,
    setSource: React.Dispatch<React.SetStateAction<SourceState<T>>>,
    signal?: AbortSignal,
  ) => {
    setSource((current) => ({ ...current, loading: true, error: false }));
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_URL}${endpoint}`, {
        headers: { Authorization: `Bearer ${token}` },
        signal,
      });
      if (!response.ok) throw new Error(`Request failed (${response.status})`);
      const data: unknown = await response.json();
      if (!Array.isArray(data)) throw new Error("Unexpected response");
      setSource({ data: data as T[], loading: false, error: false, stale: false });
    } catch (error) {
      if (signal?.aborted) return;
      console.error(error);
      setSource((current) => ({
        ...current,
        loading: false,
        error: true,
        stale: current.data.length > 0,
      }));
    }
  }, []);

  const loadShares = useCallback((signal?: AbortSignal) => (
    loadSource<ShareItem>("/v1/shares", setShareSource, signal)
  ), [loadSource]);

  const loadDrops = useCallback((signal?: AbortSignal) => (
    loadSource<DropToken>("/drop/tokens", setDropSource, signal)
  ), [loadSource]);

  useEffect(() => {
    const controller = new AbortController();
    void loadShares(controller.signal);
    void loadDrops(controller.signal);
    return () => controller.abort();
  }, [loadDrops, loadShares]);

  const shares = shareSource.data;
  const dropTokens = dropSource.data;

  function handleCopy(id: string, text: string) {
    copyToClipboard(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  }

  // Derive drop token status.
  function dropStatus(t: DropToken): string {
    if (t.used || t.is_active === false) return "closed";
    if (t.expires_at) {
      const expiration = new Date(t.expires_at);
      if (Number.isNaN(expiration.getTime())) return "unknown";
      if (expiration < new Date()) return "expired";
    }
    if (typeof t.files_uploaded !== "number") return "unknown";
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

  const tabs: { key: Tab; label: string; icon: React.ReactNode; count: number | string }[] = [
    { key: "all", label: "All access", icon: <ShieldCheck className="w-4 h-4" />, count: shareSource.error || dropSource.error ? "—" : allItems.length },
    { key: "shares", label: "Share links", icon: <Link2 className="w-4 h-4" />, count: shareSource.error && shares.length === 0 ? "—" : shares.length },
    { key: "drop", label: "Drop routes", icon: <Upload className="w-4 h-4" />, count: dropSource.error && dropTokens.length === 0 ? "—" : dropTokens.length },
  ];

  const baseURL = window.location.origin + branding.basePath;

  const relevantLoading = tab === "all"
    ? shareSource.loading || dropSource.loading
    : tab === "shares" ? shareSource.loading : dropSource.loading;
  const relevantError = tab === "all"
    ? shareSource.error || dropSource.error
    : tab === "shares" ? shareSource.error : dropSource.error;

  return (
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
          {(["all", "active", "expired", "revoked", "never_used", "stale", "closed", "unknown"] as StatusFilter[]).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                statusFilter === s
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-muted-foreground border-border hover:border-primary/40"
              }`}
            >
              {s === "all" ? "All" : s === "never_used" ? "Never used" : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>

        <div className="grid gap-2 sm:grid-cols-2" aria-label="Access data sources">
          {(tab === "all" || tab === "shares") && (
            <SourceStatus
              label={copy("drive:accessCenter.sources.shares", "Share links")}
              state={shareSource}
              unavailable={copy("drive:accessCenter.sources.sharesUnavailable", "Share links are unavailable.")}
              stale={copy("drive:accessCenter.sources.sharesStale", "Share links may be out of date.")}
              retryLabel={shareSource.error
                ? copy("drive:accessCenter.sources.tryShares", "Try share links again")
                : copy("drive:accessCenter.sources.refreshShares", "Refresh share links")}
              actionLabel={shareSource.error
                ? copy("drive:accessCenter.sources.tryAgain", "Try again")
                : copy("drive:accessCenter.sources.refresh", "Refresh")}
              onRetry={() => void loadShares()}
            />
          )}
          {(tab === "all" || tab === "drop") && (
            <SourceStatus
              label={copy("drive:accessCenter.sources.drops", "Drop routes")}
              state={dropSource}
              unavailable={copy("drive:accessCenter.sources.dropsUnavailable", "Drop routes are unavailable.")}
              stale={copy("drive:accessCenter.sources.dropsStale", "Drop routes may be out of date.")}
              retryLabel={dropSource.error
                ? copy("drive:accessCenter.sources.tryDrops", "Try drop routes again")
                : copy("drive:accessCenter.sources.refreshDrops", "Refresh drop routes")}
              actionLabel={dropSource.error
                ? copy("drive:accessCenter.sources.tryAgain", "Try again")
                : copy("drive:accessCenter.sources.refresh", "Refresh")}
              onRetry={() => void loadDrops()}
            />
          )}
        </div>

          <>
            {/* ALL TAB */}
            {tab === "all" && (
              filteredAllItems.length === 0 && !relevantLoading && !relevantError ? (
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
              filteredShares.length === 0 && !relevantLoading && !relevantError ? <EmptyState /> : (
                <div className="space-y-2">
                  {filteredShares.map((s) => (
                    <ShareCard key={s.id} item={s} baseURL={baseURL} copiedId={copiedId} onCopy={handleCopy} />
                  ))}
                </div>
              )
            )}

            {/* DROP TAB */}
            {tab === "drop" && (
              filteredDrops.length === 0 && !relevantLoading && !relevantError ? <EmptyState /> : (
                <div className="space-y-2">
                  {filteredDrops.map((d) => (
                    <DropCard key={d.id} item={d} status={dropStatus(d)} baseURL={baseURL} copiedId={copiedId} onCopy={handleCopy} />
                  ))}
                </div>
              )
            )}
          </>
      </div>
  );
}

function SourceStatus<T>({
  label,
  state,
  unavailable,
  stale,
  retryLabel,
  actionLabel,
  onRetry,
}: {
  label: string;
  state: SourceState<T>;
  unavailable: string;
  stale: string;
  retryLabel: string;
  actionLabel: string;
  onRetry: () => void;
}) {
  const message = state.error ? (state.stale ? stale : unavailable) : null;
  return (
    <div className="flex min-h-10 items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2 text-xs">
      <div className="min-w-0">
        <span className="font-medium text-foreground">{label}</span>
        {state.loading && state.data.length === 0 && <span className="ml-2 text-muted-foreground">Loading…</span>}
        {message && <p className="mt-0.5 text-amber-700 dark:text-amber-300" role="status">{message}</p>}
      </div>
      <Button type="button" variant="ghost" size="sm" aria-label={retryLabel} onClick={onRetry} disabled={state.loading}>
        {actionLabel}
      </Button>
    </div>
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

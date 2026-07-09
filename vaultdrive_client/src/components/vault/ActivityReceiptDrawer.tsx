import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { X, ShieldCheck, Lock, Upload, Link2, Key, Users, Eye, RefreshCw, Clock, ChevronDown, ChevronUp } from "lucide-react";
import { API_URL } from "../../utils/api";
import { relativeTime } from "../../utils/format";
import { DataState } from "../ui/data-state";
import { springs } from "../../lib/motion-presets";
import { cn } from "../../lib/utils";

interface AuditEntry {
  id: string;
  action: string;
  resource_type: string;
  resource_id?: string;
  ip_address?: string;
  created_at: string;
  metadata?: Record<string, unknown>;
}

interface ActivityReceiptDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  fileId: string;
  filename: string;
}

function getEventIcon(action: string): React.ReactNode {
  const a = action.toLowerCase();
  if (a.includes("upload")) return <Upload className="w-4 h-4" />;
  if (a.includes("download") || a.includes("decrypt") || a.includes("access")) return <Eye className="w-4 h-4" />;
  if (a.includes("share_link") || a.includes("public_share")) return <Link2 className="w-4 h-4" />;
  if (a.includes("share") || a.includes("user")) return <Users className="w-4 h-4" />;
  if (a.includes("key")) return <Key className="w-4 h-4" />;
  return <Clock className="w-4 h-4" />;
}

function getActionTone(action: string): string {
  const a = action.toLowerCase();
  if (a.includes("revoke") || a.includes("expired") || a.includes("denied")) {
    return "text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-300 dark:bg-amber-900/30 dark:border-amber-800/40";
  }
  if (a.includes("upload") || a.includes("created") || a.includes("sync")) {
    return "text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-300 dark:bg-emerald-900/30 dark:border-emerald-800/40";
  }
  return "text-sky-700 bg-sky-50 border-sky-200 dark:text-sky-300 dark:bg-sky-900/30 dark:border-sky-800/40";
}

function getActorTone(actorType: string): string {
  const t = actorType.toLowerCase();
  if (t === "owner") return "bg-emerald-500/10 text-emerald-400 border-emerald-500/25";
  if (t === "agent_key") return "bg-violet-500/10 text-violet-400 border-violet-500/25";
  if (t === "anonymous_link") return "bg-sky-500/10 text-sky-400 border-sky-500/25";
  return "bg-amber-500/10 text-amber-400 border-amber-500/25";
}

function MetadataDetail({ meta }: { meta: Record<string, unknown> }) {
  const [expanded, setExpanded] = useState(false);
  const { t } = useTranslation(["drive"]);
  const keys = Object.keys(meta).filter((k) => k !== "path" && k !== "method" && k !== "filename" && k !== "file_size");
  if (keys.length === 0) return null;

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
      >
        {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        {expanded ? t("drive:receiptDrawer.hideDetails") : t("drive:receiptDrawer.details")}
      </button>
      {expanded && (
        <div className="mt-2 rounded-xl border border-border bg-background/50 px-3.5 py-3 text-xs text-muted-foreground space-y-1.5 font-mono">
          {keys.map((k) => (
            <div key={k} className="flex gap-2 leading-relaxed">
              <span className="text-muted-foreground/80 w-24 shrink-0 truncate">{k}:</span>
              <span className="break-all text-foreground/95 select-all">{String(meta[k])}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function ActivityReceiptDrawer({ isOpen, onClose, fileId, filename }: ActivityReceiptDrawerProps) {
  const { t } = useTranslation(["drive"]);
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const fetchAuditLogs = useCallback(async () => {
    if (!fileId) return;
    setLoading(true);
    setError(null);
    const token = localStorage.getItem("token");
    try {
      const res = await fetch(`${API_URL}/v1/audit?resource_id=${fileId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        throw new Error("Could not fetch receipt logs");
      }
      const payload = await res.json();
      if (payload?.data) {
        setEntries(payload.data);
      } else {
        setEntries([]);
      }
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [fileId]);

  useEffect(() => {
    if (isOpen) {
      void fetchAuditLogs();
    }
  }, [isOpen, fetchAuditLogs]);

  // Trap escape key to close drawer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            data-testid="receipt-drawer-backdrop"
            className="fixed inset-0 bg-black/45 backdrop-blur-[4px] z-50 cursor-pointer"
          />

          {/* Drawer container */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={springs.snappy}
            data-testid="receipt-drawer-panel"
            className="fixed inset-y-0 right-0 z-50 w-full sm:w-[500px] bg-card border-l border-border shadow-2xl flex flex-col h-full overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-start justify-between px-6 py-5 border-b border-border bg-card">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-primary shrink-0" />
                  <h2 className="font-semibold text-base text-foreground leading-snug">
                    {t("drive:receiptDrawer.title")}
                  </h2>
                </div>
                <p className="text-xs text-muted-foreground mt-1 truncate max-w-[360px]" title={filename}>
                  {filename}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={fetchAuditLogs}
                  disabled={loading}
                  aria-label="Refresh receipts"
                  className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted active:bg-muted/80 cursor-pointer transition-colors"
                >
                  <RefreshCw className={cn("w-4.5 h-4.5", loading && "animate-spin")} />
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label={t("drive:receiptDrawer.close")}
                  className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted active:bg-muted/80 cursor-pointer transition-colors"
                >
                  <X className="w-4.5 h-4.5" />
                </button>
              </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              {/* Active Auditing Badge */}
              <div className="flex items-center gap-2 bg-emerald-500/8 border border-emerald-500/12 rounded-xl px-4 py-3 shrink-0">
                <span className="relative flex h-2 w-2 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="text-xs font-semibold text-emerald-500 tracking-wide">
                  {t("drive:receiptDrawer.activeAuditing")}
                </span>
              </div>

              {/* Zero-Knowledge boundary notice */}
              <div className="relative overflow-hidden border border-emerald-500/20 bg-gradient-to-b from-emerald-500/[0.06] to-emerald-500/[0.02] rounded-2xl p-4 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-2xl bg-emerald-500/10 flex items-center justify-center shrink-0 text-emerald-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-400">
                      {t("drive:receiptDrawer.zeroKnowledgeBoundary")}
                    </h3>
                    <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                      {t("drive:receiptDrawer.zkExplanation")}
                    </p>
                  </div>
                </div>
              </div>

              {/* List Wrapper */}
              <div className="space-y-4">
                <DataState
                  loading={loading}
                  error={error ? "Security receipts are temporarily offline. Your data remains fully protected." : undefined}
                  empty={entries.length === 0}
                  emptyConfig={{
                    title: t("drive:receiptDrawer.noActivity"),
                    body: "All actions on this file generate real-time compliance logs.",
                  }}
                  loadingLabel="Loading security receipts..."
                  onRetry={fetchAuditLogs}
                  skeletonRows={3}
                  density="comfortable"
                >
                  <div className="space-y-3">
                    {entries.map((entry) => {
                      const actorType = (entry.metadata?.actor_type as string) || "owner";
                      const actionLabelKey = entry.action.replace(/\./g, "_");

                      return (
                        <div
                          key={entry.id}
                          className="rounded-2xl border border-border bg-muted/30 px-4.5 py-4 space-y-3 shadow-sm hover:border-border/80 transition-all"
                        >
                          {/* Top Row: Event name & Time */}
                          <div className="flex items-start justify-between gap-3 flex-wrap">
                            <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium", getActionTone(entry.action))}>
                              {getEventIcon(entry.action)}
                              {t(`drive:receiptDrawer.actions.${actionLabelKey}`) || entry.action}
                            </span>
                            <span className="text-[11px] font-medium text-muted-foreground" title={new Date(entry.created_at).toLocaleString()}>
                              {relativeTime(entry.created_at)}
                            </span>
                          </div>

                          {/* Middle Row: Actor Badge & IP */}
                          <div className="grid gap-2 sm:grid-cols-2 text-xs">
                            <div className="flex items-center gap-2">
                              <span className="text-muted-foreground w-18 shrink-0">{t("drive:receiptDrawer.actor")}:</span>
                              <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase", getActorTone(actorType))}>
                                {t(`drive:receiptDrawer.actorTypes.${actorType}`) || actorType}
                              </span>
                            </div>
                            {entry.ip_address && (
                              <div className="flex items-center gap-2">
                                <span className="text-muted-foreground w-18 shrink-0 sm:text-right sm:pr-2">{t("drive:receiptDrawer.ipAddress")}:</span>
                                <span className="font-mono text-foreground/90">{entry.ip_address}</span>
                              </div>
                            )}
                          </div>

                          {/* Details Toggle */}
                          {entry.metadata && Object.keys(entry.metadata).length > 0 && (
                            <MetadataDetail meta={entry.metadata} />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </DataState>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}

export default ActivityReceiptDrawer;

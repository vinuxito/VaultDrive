import { useState, useEffect } from "react";
import { ShieldCheck, ShieldOff, Users, Link2, X, Loader2, Inbox } from "lucide-react";
import { API_URL } from "../../utils/api";
import { relativeTime } from "../../utils/format";

interface AccessEntry {
  kind: string;
  label: string;
  since: string;
  state: string;
  expires_at?: string;
  access_count?: number;
}

interface AccessSummary {
  summary: string;
  entries: AccessEntry[];
}

interface AccessPanelProps {
  fileId: string;
  filename: string;
  onClose: () => void;
}

export function AccessPanel({ fileId, filename, onClose }: AccessPanelProps) {
  const [data, setData] = useState<AccessSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [revoking, setRevoking] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const [error, setError] = useState(false);
  const [receipt, setReceipt] = useState<string>("");

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      setLoading(false);
      setError(true);
      return;
    }

    setLoading(true);
    setError(false);
    fetch(`${API_URL}/v1/files/${fileId}/access-summary`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => {
        if (!r.ok) {
          throw new Error("access_unavailable");
        }

        return r.json();
      })
      .then((d: AccessSummary | null) => {
        if (d) {
          setData(d);
          return;
        }

        throw new Error("access_unavailable");
      })
      .catch(() => {
        setData(null);
        setError(true);
      })
      .finally(() => setLoading(false));
  }, [fileId]);

  const revokeAll = async () => {
    setRevoking(true);
    try {
      const token = localStorage.getItem("token");
      await fetch(`${API_URL}/v1/files/${fileId}/revoke-external`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const r = await fetch(`${API_URL}/v1/files/${fileId}/access-summary`, {
        headers: { Authorization: `Bearer ${token}` },
      });
       if (r.ok) {
         setData((await r.json()) as AccessSummary);
         setReceipt("External access revoked. This file is back under owner-only control.");
       }
    } catch {
      void 0;
    } finally {
      setRevoking(false);
      setConfirmRevoke(false);
    }
  };

  const iconFor = (kind: string) => {
    if (kind === "share_link") return <Link2 className="w-3.5 h-3.5" />;
    if (kind === "group") return <Users className="w-3.5 h-3.5" />;
    if (kind === "secure_drop") return <Inbox className="w-3.5 h-3.5" />;
    return <ShieldCheck className="w-3.5 h-3.5" />;
  };

  const stateClasses = (state: string) => {
    if (state === "expired") return "bg-amber-100 text-amber-700 border border-amber-200";
    if (state === "revoked") return "bg-rose-100 text-rose-700 border border-rose-200";
    return "bg-emerald-100 text-emerald-700 border border-emerald-200";
  };

  const hasExternal = data && data.entries.length > 0;
  const activeEntries = data?.entries.filter((entry) => entry.state === "active") ?? [];
  const accessHeadline = data?.summary || (activeEntries.length === 0
    ? "Only you can reach this file right now."
    : `${activeEntries.length} external access point${activeEntries.length !== 1 ? "s are" : " is"} active.`);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md border border-slate-200 dark:border-slate-700">
        <div className="flex items-start justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#7d4f50] shrink-0" />
              <h2 className="font-semibold text-sm text-slate-900 dark:text-slate-100">Access Control</h2>
            </div>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 truncate max-w-64">{filename}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors mt-0.5"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-2.5">
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 px-3 py-3">
            <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{accessHeadline}</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Review every link, share, and Secure Drop path from one place.
            </p>
          </div>

          <div className="flex items-center gap-2.5 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700/40">
            <div className="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-800/50 flex items-center justify-center shrink-0 text-emerald-600 dark:text-emerald-400">
              <ShieldCheck className="w-3.5 h-3.5" />
            </div>
            <div>
              <p className="text-sm font-medium text-emerald-800 dark:text-emerald-200">You (owner)</p>
              <p className="text-xs text-emerald-600 dark:text-emerald-400">Full access, always</p>
            </div>
          </div>

          {receipt && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3">
              <p className="text-sm font-medium text-emerald-800">Done, safe, under control.</p>
              <p className="mt-1 text-xs text-emerald-700">{receipt}</p>
            </div>
          )}

          {loading ? (
            <div className="flex items-center gap-2 text-slate-400 text-sm py-3 justify-center">
              <Loader2 className="w-4 h-4 animate-spin" />
              Checking access…
            </div>
          ) : error ? (
            <div className="px-1 py-2">
              <p className="text-sm text-slate-700 dark:text-slate-200">Access data is temporarily unavailable.</p>
              <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">You can keep working; the visibility feed just could not be refreshed.</p>
            </div>
          ) : !data || data.entries.length === 0 ? (
            <div className="px-1 py-2">
              <p className="text-sm text-slate-700 dark:text-slate-200">No external access is active.</p>
              <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">If you create a link, group share, or Secure Drop route, it will appear here immediately.</p>
            </div>
          ) : (
            data.entries.map((entry) => (
              <div
                key={`${entry.kind}-${entry.since}`}
                className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-800"
              >
                <div className="w-6 h-6 rounded-full bg-[#f2d7d8] flex items-center justify-center shrink-0 mt-0.5 text-[#7d4f50]">
                  {iconFor(entry.kind)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm text-slate-700 dark:text-slate-200">{entry.label}</p>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${stateClasses(entry.state)}`}
                    >
                      {entry.state}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                    {relativeTime(entry.since)}
                    {entry.expires_at && ` · expires ${new Date(entry.expires_at).toLocaleDateString()}`}
                    {typeof entry.access_count === "number" && ` · opened ${entry.access_count}×`}
                  </p>
                </div>
              </div>
            ))
          )}

          {hasExternal && (
            confirmRevoke ? (
              <div className="rounded-xl border border-rose-200 bg-rose-50 dark:bg-rose-900/20 dark:border-rose-700/40 p-4 space-y-3">
                <div>
                  <p className="text-sm font-medium text-rose-900 dark:text-rose-200">Remove all external access?</p>
                  <p className="text-xs text-rose-700 dark:text-rose-300 mt-0.5">
                    All active links, group shares, and Secure Drop access will be revoked immediately.
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmRevoke(false)}
                    disabled={revoking}
                    className="flex-1 py-2 rounded-lg border border-slate-200 dark:border-slate-600 text-sm text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 font-medium transition-colors"
                  >
                    Keep access
                  </button>
                  <button
                    type="button"
                    onClick={() => void revokeAll()}
                    disabled={revoking}
                    className="flex-1 py-2 rounded-lg bg-rose-600 text-sm text-white font-medium hover:bg-rose-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
                  >
                    {revoking ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    {revoking ? "Revoking…" : "Yes, revoke all"}
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmRevoke(true)}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-rose-200 dark:border-rose-700/50 text-rose-600 dark:text-rose-400 text-sm font-medium hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors"
              >
                <ShieldOff className="w-4 h-4" />
                Revoke all external access
              </button>
            )
          )}
        </div>
      </div>
    </div>
  );
}

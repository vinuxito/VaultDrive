import { useState, useEffect } from "react";
import { ShieldCheck, Users, Link2, X, Trash2, Loader2 } from "lucide-react";
import { API_URL } from "../../utils/api";

interface AccessEntry {
  kind: string;
  label: string;
  since: string;
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

  useEffect(() => {
    const token = localStorage.getItem("token");
    fetch(`${API_URL}/files/${fileId}/access-summary`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.ok ? r.json() : null)
      .then((d: AccessSummary | null) => { if (d) setData(d); })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, [fileId]);

  const revokeAll = async () => {
    setRevoking(true);
    try {
      const token = localStorage.getItem("token");
      await fetch(`${API_URL}/files/${fileId}/revoke-external`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const t2 = localStorage.getItem("token");
      const r = await fetch(`${API_URL}/files/${fileId}/access-summary`, {
        headers: { Authorization: `Bearer ${t2}` },
      });
      if (r.ok) setData(await r.json() as AccessSummary);
    } catch {
      void 0;
    } finally {
      setRevoking(false);
    }
  };

  const iconFor = (kind: string) => {
    if (kind === "share_link") return <Link2 className="w-3.5 h-3.5" />;
    if (kind === "group") return <Users className="w-3.5 h-3.5" />;
    return <ShieldCheck className="w-3.5 h-3.5" />;
  };

  const hasExternal = data && data.entries.length > 0;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md border border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#7d4f50]" />
            <h2 className="font-semibold text-sm text-slate-900 dark:text-slate-100 truncate max-w-56">{filename}</h2>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-3">
          {loading ? (
            <div className="flex items-center gap-2 text-slate-400 text-sm py-4 justify-center">
              <Loader2 className="w-4 h-4 animate-spin" />
              Checking access…
            </div>
          ) : !data || data.entries.length === 0 ? (
            <div className="flex items-center gap-2 py-4">
              <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-700">Only you</p>
                <p className="text-xs text-slate-400">No external access to this file</p>
              </div>
            </div>
          ) : (
            <>
              {data.entries.map((entry) => (
                <div key={`${entry.kind}-${entry.since}`} className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-800">
                  <div className="w-6 h-6 rounded-full bg-[#f2d7d8] flex items-center justify-center shrink-0 mt-0.5 text-[#7d4f50]">
                    {iconFor(entry.kind)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-700 dark:text-slate-200">{entry.label}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Since {new Date(entry.since).toLocaleDateString()}
                      {entry.expires_at && ` · expires ${new Date(entry.expires_at).toLocaleDateString()}`}
                    </p>
                  </div>
                </div>
              ))}
            </>
          )}

          {hasExternal && (
            <button
              type="button"
              onClick={() => void revokeAll()}
              disabled={revoking}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-red-200 text-red-600 text-sm font-medium hover:bg-red-50 transition-colors disabled:opacity-50"
            >
              {revoking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              Revoke all external access
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

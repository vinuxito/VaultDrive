import { useEffect, useState } from "react";
import { ShieldCheck, Eye, Sparkles, Clock3 } from "lucide-react";
import { API_URL } from "../../utils/api";

interface TrustEntry {
  kind: string;
  label: string;
  since: string;
  state: string;
  expires_at?: string;
  access_count?: number;
}

interface TrustSummary {
  file_id: string;
  protection: string;
  owner_label: string;
  visibility_summary: string;
  access_state: string;
  origin: string;
  latest_activity: string;
  entries: TrustEntry[];
}

interface TrustRailEnvelope {
  success: boolean;
  data: TrustSummary;
}

interface TrustRailProps {
  fileId: string;
}

function statePill(state: string): string {
  if (state === "public") return "bg-amber-100 text-amber-700 border-amber-200";
  if (state === "shared") return "bg-sky-100 text-sky-700 border-sky-200";
  if (state === "controlled") return "bg-violet-100 text-violet-700 border-violet-200";
  return "bg-emerald-100 text-emerald-700 border-emerald-200";
}

function originLabel(origin: string): string {
  if (origin === "secure_drop") return "Secure Drop intake";
  return "Vault upload";
}

export function TrustRail({ fileId }: TrustRailProps) {
  const [summary, setSummary] = useState<TrustSummary | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;
    fetch(`${API_URL}/v1/files/${fileId}/trust`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: TrustRailEnvelope | null) => {
        if (payload?.data) setSummary(payload.data);
      })
      .catch(() => undefined);
  }, [fileId]);

  if (!summary) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/60">
        Checking protection and access state...
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-gradient-to-r from-white/6 to-white/3 px-4 py-4 space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-white">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span className="text-sm font-medium">Trust Rail</span>
        </div>
        <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${statePill(summary.access_state)}`}>
          {summary.visibility_summary}
        </span>
      </div>

      <div className="grid gap-3 md:grid-cols-4 text-sm">
        <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-3">
          <div className="flex items-center gap-2 text-white/70 text-xs uppercase tracking-[0.18em]">
            <ShieldCheck className="w-3.5 h-3.5" />
            Protection
          </div>
          <p className="mt-2 text-white/90 leading-snug">{summary.protection}</p>
        </div>

        <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-3">
          <div className="flex items-center gap-2 text-white/70 text-xs uppercase tracking-[0.18em]">
            <Eye className="w-3.5 h-3.5" />
            Who Can See It
          </div>
          <p className="mt-2 text-white/90 leading-snug">{summary.visibility_summary}</p>
          <p className="mt-1 text-xs text-white/50">Owner: {summary.owner_label}</p>
        </div>

        <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-3">
          <div className="flex items-center gap-2 text-white/70 text-xs uppercase tracking-[0.18em]">
            <Sparkles className="w-3.5 h-3.5" />
            Origin
          </div>
          <p className="mt-2 text-white/90 leading-snug">{originLabel(summary.origin)}</p>
          <p className="mt-1 text-xs text-white/50">{summary.entries.length} visibility record(s)</p>
        </div>

        <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-3">
          <div className="flex items-center gap-2 text-white/70 text-xs uppercase tracking-[0.18em]">
            <Clock3 className="w-3.5 h-3.5" />
            Latest Activity
          </div>
          <p className="mt-2 text-white/90 leading-snug">{summary.latest_activity}</p>
          <p className="mt-1 text-xs text-white/50">Visible and revocable from this screen</p>
        </div>
      </div>
    </div>
  );
}

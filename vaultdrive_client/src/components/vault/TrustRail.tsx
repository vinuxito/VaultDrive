import { useEffect, useState } from "react";
import { ShieldCheck, Lock, Sparkles, Clock3 } from "lucide-react";
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
  if (origin === "secure_drop") return "Received via Secure Drop";
  return "Uploaded to vault";
}

export function TrustRail({ fileId }: TrustRailProps) {
  const hasToken = Boolean(localStorage.getItem("token"));
  const [summary, setSummary] = useState<TrustSummary | null>(null);
  const [loading, setLoading] = useState(hasToken);
  const [error, setError] = useState(!hasToken);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;
    fetch(`${API_URL}/v1/files/${fileId}/trust`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error("trust_unavailable");
        }

        return response.json();
      })
      .then((payload: TrustRailEnvelope | null) => {
        if (payload?.data) {
          setSummary(payload.data);
          return;
        }

        throw new Error("trust_unavailable");
      })
      .catch(() => {
        setSummary(null);
        setError(true);
      })
      .finally(() => setLoading(false));
  }, [fileId]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="h-3 w-36 bg-white/10 rounded animate-pulse" />
          <div className="h-5 w-20 bg-white/10 rounded-full animate-pulse" />
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 rounded-xl overflow-hidden relative bg-white/5">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.04] to-transparent animate-shine" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error || !summary) {
    return (
      <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-4 space-y-3">
        <div className="flex items-center gap-2 text-white/50">
          <ShieldCheck className="w-3.5 h-3.5 text-amber-300" />
          <span className="text-xs font-medium uppercase tracking-[0.15em]">Protection & Access</span>
        </div>
        <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-3">
          <p className="text-sm text-white/85">Trust data is temporarily unavailable.</p>
          <p className="mt-1 text-xs text-white/45">Your file remains encrypted and under your control.</p>
        </div>
      </div>
    );
  }

  const activeCount = summary.entries.filter((e) => e.state === "active").length;
  const calmSummary = activeCount === 0
    ? "Only you control this file right now."
    : `${activeCount} external access point${activeCount !== 1 ? "s are" : " is"} active and reviewable.`;

  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-4 space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-white/50">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-xs font-medium uppercase tracking-[0.15em]">Protection & Access</span>
        </div>
        <span
          className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${statePill(summary.access_state)}`}
        >
          {summary.visibility_summary}
        </span>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3">
        <p className="text-sm text-white/92 leading-relaxed">{calmSummary}</p>
        <p className="mt-1 text-xs text-white/40">ABRN Drive stores ciphertext and access metadata only.</p>
      </div>

      <div className="grid gap-3 md:grid-cols-3 text-sm">
        <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-3">
          <div className="flex items-center gap-1.5 text-white/45 text-xs uppercase tracking-[0.15em]">
            <Lock className="w-3 h-3" />
            Encryption
          </div>
          <p className="mt-2 text-white/90 leading-snug text-sm">{summary.protection}</p>
          <p className="mt-1 text-xs text-white/35">Locked in your browser before upload</p>
        </div>

        <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-3">
          <div className="flex items-center gap-1.5 text-white/45 text-xs uppercase tracking-[0.15em]">
            <Sparkles className="w-3 h-3" />
            Source
          </div>
          <p className="mt-2 text-white/90 leading-snug text-sm">{originLabel(summary.origin)}</p>
          <p className={`mt-1 text-xs leading-relaxed ${activeCount === 0 ? "text-white/35" : "text-white/55 font-medium"}`}>
            {activeCount === 0
              ? "No external access is active"
              : `${activeCount} active access point${activeCount !== 1 ? "s" : ""}, all revocable`}
          </p>
        </div>

        <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-3">
          <div className="flex items-center gap-1.5 text-white/45 text-xs uppercase tracking-[0.15em]">
            <Clock3 className="w-3 h-3" />
            Last Event
          </div>
          <p className="mt-2 text-white/90 leading-snug text-sm">{summary.latest_activity}</p>
          <p className="mt-1 text-xs text-white/35">Full event history below</p>
        </div>
      </div>
    </div>
  );
}

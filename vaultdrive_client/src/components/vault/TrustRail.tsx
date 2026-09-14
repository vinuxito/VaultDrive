import { useEffect, useState } from "react";
import { ShieldCheck, Lock, Sparkles, Clock3 } from "lucide-react";
import { API_URL } from "../../utils/api";
import { branding } from "../../config/branding";

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
  if (state === "public") return "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800";
  if (state === "shared") return "bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-900/30 dark:text-sky-300 dark:border-sky-800";
  if (state === "controlled") return "bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-900/30 dark:text-violet-300 dark:border-violet-800";
  return "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800";
}

function originLabel(origin: string): string {
  if (origin === "secure_drop") return "Received via Secure Drop";
  return "Uploaded to vault";
}

function accessStateLabel(state: string): string {
  if (state === "public") return "Public link live";
  if (state === "shared") return "Shared outside your vault";
  if (state === "controlled") return "Controlled external access";
  return "Owner-only control";
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
      <div className="brand-trust-shell rounded-[1.75rem] px-4 py-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="h-3 w-36 bg-muted rounded animate-pulse" />
          <div className="h-5 w-20 bg-muted rounded-full animate-pulse" />
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 rounded-xl overflow-hidden relative bg-muted">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-foreground/[0.04] to-transparent animate-shine" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error || !summary) {
    return (
      <div className="brand-trust-shell rounded-[1.75rem] px-4 py-4 space-y-3">
        <div className="flex items-center gap-2 text-muted-foreground">
          <ShieldCheck className="w-3.5 h-3.5 text-amber-700 dark:text-amber-300" />
          <span className="brand-trust-kicker">Protection & Access</span>
        </div>
        <div className="brand-trust-panel rounded-2xl px-4 py-4">
          <p className="text-sm text-foreground">Trust data is temporarily unavailable.</p>
          <p className="mt-1 text-xs text-muted-foreground">Your file remains encrypted and under your control.</p>
        </div>
      </div>
    );
  }

  const activeCount = summary.entries.filter((e) => e.state === "active").length;
  const activeKinds = Array.from(
    new Set(
      summary.entries
        .filter((entry) => entry.state === "active")
        .map((entry) => entry.label.split(" ")[0])
        .filter(Boolean),
    ),
  );
  const calmSummary = activeCount === 0
    ? "Only you control this file right now."
    : `${activeCount} external access point${activeCount !== 1 ? "s are" : " is"} active and reviewable.`;

  return (
    <div className="brand-trust-shell rounded-[1.75rem] px-4 py-4 space-y-4">
      <div className="relative z-10 flex items-start justify-between gap-3 flex-wrap">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-muted-foreground">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-300" />
            <span className="brand-trust-kicker">Protection & Access</span>
          </div>
          <div>
            <p className="text-lg font-semibold text-foreground">{accessStateLabel(summary.access_state)}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {activeCount === 0
                ? "No outside route is currently open."
                : `${activeCount} external path${activeCount !== 1 ? "s" : ""} remain visible, scoped, and revocable.`}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-medium shadow-sm ${statePill(summary.access_state)}`}
          >
            {summary.visibility_summary}
          </span>
          <span className="inline-flex items-center rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground">
            {activeCount === 0 ? "Owner only" : `${activeCount} active route${activeCount !== 1 ? "s" : ""}`}
          </span>
        </div>
      </div>

      <div className="relative z-10 brand-trust-panel-strong rounded-[1.4rem] px-4 py-4">
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 font-medium text-emerald-800 dark:text-emerald-200">
            Ciphertext stored only
          </span>
          <span className="inline-flex items-center rounded-full border border-border bg-background px-2.5 py-1 font-medium text-foreground">
            Owner: {summary.owner_label}
          </span>
          {activeKinds.slice(0, 2).map((kind) => (
            <span
              key={kind}
              className="inline-flex items-center rounded-full border border-border bg-background px-2.5 py-1 font-medium text-muted-foreground"
            >
              {kind}
            </span>
          ))}
        </div>
        <p className="mt-3 text-sm leading-relaxed text-foreground">{calmSummary}</p>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          {`${branding.productName} stores ciphertext and access metadata only, so this view is your control surface rather than a copy of the file.`}
        </p>
      </div>

      <div className="relative z-10 grid gap-3 md:grid-cols-3 text-sm">
        <div className="brand-trust-panel rounded-[1.35rem] px-3.5 py-3.5">
          <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-[0.15em]">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
              <Lock className="w-3.5 h-3.5" />
            </span>
            Encryption
          </div>
          <p className="mt-3 text-foreground leading-snug text-sm font-medium">{summary.protection}</p>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">Locked in your browser before upload, then kept unreadable outside your trusted session.</p>
        </div>

        <div className="brand-trust-panel rounded-[1.35rem] px-3.5 py-3.5">
          <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-[0.15em]">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-sky-500/15 text-sky-700 dark:text-sky-300">
              <Sparkles className="w-3.5 h-3.5" />
            </span>
            Source
          </div>
          <p className="mt-3 text-foreground leading-snug text-sm font-medium">{originLabel(summary.origin)}</p>
          <p className={`mt-2 text-xs leading-relaxed ${activeCount === 0 ? "text-muted-foreground" : "text-foreground font-medium"}`}>
            {activeCount === 0
              ? "No external access is active"
              : `${activeCount} active access point${activeCount !== 1 ? "s" : ""}, all revocable`}
          </p>
        </div>

        <div className="brand-trust-panel rounded-[1.35rem] px-3.5 py-3.5">
          <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-[0.15em]">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-200">
              <Clock3 className="w-3.5 h-3.5" />
            </span>
            Last Event
          </div>
          <p className="mt-3 text-foreground leading-snug text-sm font-medium">{summary.latest_activity}</p>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">Trace the full chain of sharing, download, revoke, and owner activity below.</p>
        </div>
      </div>
    </div>
  );
}

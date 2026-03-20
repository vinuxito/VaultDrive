import { useEffect, useState } from "react";
import { Clock3, Upload, Link2, Share2, ShieldOff, Inbox, Eye, ShieldCheck } from "lucide-react";
import { API_URL } from "../../utils/api";
import { relativeTime } from "../../utils/format";

interface TimelineEvent {
  id: string;
  event_type: string;
  label: string;
  at: string;
  tone: string;
}

interface TimelineEnvelope {
  success: boolean;
  data: TimelineEvent[];
}

interface FileSecurityTimelineProps {
  fileId: string;
}

function toneIconBg(tone: string): string {
  if (tone === "warn") return "bg-amber-500/20 text-amber-400 ring-1 ring-amber-400/20";
  if (tone === "good") return "bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-400/20";
  return "bg-sky-500/20 text-sky-400 ring-1 ring-sky-400/20";
}

function toneAccent(tone: string): string {
  if (tone === "warn") return "border-l-amber-300/45 bg-amber-400/5";
  if (tone === "good") return "border-l-emerald-300/45 bg-emerald-400/[0.03]";
  return "border-l-sky-300/35 bg-sky-400/[0.03]";
}

function toneLabel(tone: string): string {
  if (tone === "warn") return "Sensitive";
  if (tone === "good") return "Confirmed";
  return "Activity";
}

function eventGroupLabel(eventType: string): string {
  const t = eventType.toLowerCase();
  if (t.includes("revoke") || t.includes("revoked")) return "Access change";
  if (t.includes("share") || t.includes("link")) return "Sharing";
  if (t.includes("download") || t.includes("view") || t.includes("access")) return "Visibility";
  if (t.includes("drop") || t.includes("upload")) return "Delivery";
  return "History";
}

function getEventIcon(eventType: string): React.ReactNode {
  const t = eventType.toLowerCase();
  if (t.includes("upload")) return <Upload className="w-3 h-3" />;
  if (t.includes("revoke") || t.includes("revoked")) return <ShieldOff className="w-3 h-3" />;
  if (t.includes("link") || t.includes("share_link")) return <Link2 className="w-3 h-3" />;
  if (t.includes("share") || t.includes("shared")) return <Share2 className="w-3 h-3" />;
  if (t.includes("drop")) return <Inbox className="w-3 h-3" />;
  if (t.includes("access") || t.includes("download") || t.includes("view")) return <Eye className="w-3 h-3" />;
  return <Clock3 className="w-3 h-3" />;
}

export function FileSecurityTimeline({ fileId }: FileSecurityTimelineProps) {
  const hasToken = Boolean(localStorage.getItem("token"));
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(hasToken);
  const [error, setError] = useState(!hasToken);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;
    fetch(`${API_URL}/v1/files/${fileId}/timeline`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error("timeline_unavailable");
        }

        return response.json();
      })
      .then((payload: TimelineEnvelope | null) => {
        if (payload?.data) {
          setEvents(payload.data);
          return;
        }

        throw new Error("timeline_unavailable");
      })
      .catch(() => {
        setEvents([]);
        setError(true);
      })
      .finally(() => setLoading(false));
  }, [fileId]);

  return (
    <div className="abrn-trust-shell rounded-[1.75rem] px-4 py-4 space-y-3">
      <div className="relative z-10 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-white/50">
          <Clock3 className="w-3.5 h-3.5 text-amber-200" />
          <span className="abrn-trust-kicker">Security History</span>
        </div>
        {!loading && !error && (
          <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-medium text-white/72">
            {events.length === 0 ? "Owner-only story" : `${events.length} recorded event${events.length !== 1 ? "s" : ""}`}
          </span>
        )}
      </div>

      {loading ? (
        <div className="relative z-10 space-y-3 py-1">
          {[1, 2, 3].map((row) => (
            <div key={row} className="flex gap-3">
              <div className="w-6 h-6 rounded-full bg-white/10 animate-pulse shrink-0" />
              <div className="flex-1 space-y-2 pt-0.5">
                <div className="h-3 rounded bg-white/10 animate-pulse w-3/4" />
                <div className="h-2.5 rounded bg-white/10 animate-pulse w-1/3" />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="relative z-10 abrn-trust-panel rounded-2xl flex items-center gap-3 px-4 py-4">
          <div className="w-6 h-6 rounded-full bg-amber-500/20 ring-1 ring-amber-400/20 flex items-center justify-center shrink-0">
            <Clock3 className="w-3 h-3 text-amber-300" />
          </div>
          <div>
            <p className="text-sm text-white/85">Security history is temporarily unavailable.</p>
            <p className="text-xs text-white/60 mt-0.5">The file remains protected; only the event feed could not be loaded.</p>
          </div>
        </div>
      ) : events.length === 0 ? (
        <div className="relative z-10 abrn-trust-panel-strong rounded-2xl flex items-center gap-3 px-4 py-4">
          <div className="w-6 h-6 rounded-full bg-emerald-500/20 ring-1 ring-emerald-400/20 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-3 h-3 text-emerald-400" />
          </div>
          <div>
            <p className="text-sm text-white/85">No external access has occurred yet.</p>
            <p className="text-xs text-white/60 mt-0.5">Only you currently hold access to this file.</p>
          </div>
        </div>
      ) : (
        <div className={`relative z-10 ${events.length > 5 ? "max-h-72 overflow-y-auto pr-1 space-y-0" : "space-y-0"}`}>
          {events.map((event, idx) => (
            <div key={event.id} className="flex gap-3">
              <div className="flex flex-col items-center">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-1 ${toneIconBg(event.tone)}`}
                >
                  {getEventIcon(event.event_type)}
                </div>
                {idx < events.length - 1 && (
                  <span className="mt-1.5 w-px h-6 bg-white/15 shrink-0" />
                )}
              </div>
              <div
                className={`${idx < events.length - 1 ? "pb-4" : "pb-1"} abrn-trust-panel rounded-[1.25rem] border-l px-3.5 py-3 flex-1 ${toneAccent(event.tone)}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-white/55">
                      <span className="inline-flex items-center rounded-full border border-white/10 bg-white/6 px-2 py-0.5 font-medium text-white/72">
                        {eventGroupLabel(event.event_type)}
                      </span>
                      <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-white/55">
                        {toneLabel(event.tone)}
                      </span>
                    </div>
                    <p className="text-sm text-white/92 leading-relaxed">{event.label}</p>
                  </div>
                  <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-medium text-white/72 whitespace-nowrap">
                    {relativeTime(event.at)}
                  </span>
                </div>
                <div className="mt-2 flex items-center gap-2 text-xs text-white/58">
                  <span>{new Date(event.at).toLocaleString()}</span>
                  <span className="text-white/38">•</span>
                  <span>Readable history of protection and control</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

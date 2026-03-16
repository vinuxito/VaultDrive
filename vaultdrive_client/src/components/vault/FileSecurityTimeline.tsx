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
    <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4 space-y-3">
      <div className="flex items-center gap-2 text-white/50">
        <Clock3 className="w-3.5 h-3.5" />
        <span className="text-xs font-medium uppercase tracking-[0.15em]">Security History</span>
      </div>

      {loading ? (
        <div className="space-y-3 py-1">
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
        <div className="flex items-center gap-3 py-2">
          <div className="w-6 h-6 rounded-full bg-amber-500/20 ring-1 ring-amber-400/20 flex items-center justify-center shrink-0">
            <Clock3 className="w-3 h-3 text-amber-300" />
          </div>
          <div>
            <p className="text-sm text-white/85">Security history is temporarily unavailable.</p>
            <p className="text-xs text-white/40 mt-0.5">The file remains protected; only the event feed could not be loaded.</p>
          </div>
        </div>
      ) : events.length === 0 ? (
        <div className="flex items-center gap-3 py-2">
          <div className="w-6 h-6 rounded-full bg-emerald-500/20 ring-1 ring-emerald-400/20 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-3 h-3 text-emerald-400" />
          </div>
          <div>
            <p className="text-sm text-white/85">No external access has occurred yet.</p>
            <p className="text-xs text-white/40 mt-0.5">Only you currently hold access to this file.</p>
          </div>
        </div>
      ) : (
        <div className={events.length > 5 ? "max-h-60 overflow-y-auto pr-1 space-y-0" : "space-y-0"}>
          {events.map((event, idx) => (
            <div key={event.id} className="flex gap-3">
              <div className="flex flex-col items-center">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${toneIconBg(event.tone)}`}
                >
                  {getEventIcon(event.event_type)}
                </div>
                {idx < events.length - 1 && (
                  <span className="mt-1 w-px h-5 bg-white/15 shrink-0" />
                )}
              </div>
              <div className={`${idx < events.length - 1 ? "pb-4" : "pb-1"} flex-1`}>
                <p className="text-sm text-white/92 leading-relaxed">{event.label}</p>
                <div className="mt-0.5 flex items-center gap-2 text-xs text-white/40">
                  <span>{relativeTime(event.at)}</span>
                  <span className="text-white/20">•</span>
                  <span>{new Date(event.at).toLocaleString()}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

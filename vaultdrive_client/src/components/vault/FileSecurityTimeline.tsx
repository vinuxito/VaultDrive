import { useEffect, useState } from "react";
import { Clock3, Upload, Link2, Share2, ShieldOff, Inbox, Eye, ShieldCheck } from "lucide-react";
import { API_URL } from "../../utils/api";

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

function relativeTime(dateString: string): string {
  const date = new Date(dateString);
  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  if (diffMins < 2) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString();
}

export function FileSecurityTimeline({ fileId }: FileSecurityTimelineProps) {
  const [events, setEvents] = useState<TimelineEvent[]>([]);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;
    fetch(`${API_URL}/v1/files/${fileId}/timeline`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: TimelineEnvelope | null) => {
        if (payload?.data) setEvents(payload.data);
      })
      .catch(() => undefined);
  }, [fileId]);

  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4 space-y-3">
      <div className="flex items-center gap-2 text-white/50">
        <Clock3 className="w-3.5 h-3.5" />
        <span className="text-xs font-medium uppercase tracking-[0.15em]">Security History</span>
      </div>

      {events.length === 0 ? (
        <div className="flex items-center gap-3 py-2">
          <div className="w-6 h-6 rounded-full bg-emerald-500/20 ring-1 ring-emerald-400/20 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-3 h-3 text-emerald-400" />
          </div>
          <p className="text-sm text-white/50">No external access has occurred yet</p>
        </div>
      ) : (
        <div className="space-y-0">
          {events.map((event, idx) => (
            <div key={event.id} className="flex gap-3">
              <div className="flex flex-col items-center">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${toneIconBg(event.tone)}`}
                >
                  {getEventIcon(event.event_type)}
                </div>
                {idx < events.length - 1 && (
                  <span className="mt-1 w-px h-4 bg-white/8 shrink-0" />
                )}
              </div>
              <div className={`${idx < events.length - 1 ? "pb-4" : "pb-1"} flex-1`}>
                <p className="text-sm text-white/90">{event.label}</p>
                <p className="text-xs text-white/40 mt-0.5">{relativeTime(event.at)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

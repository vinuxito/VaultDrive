import { useEffect, useState } from "react";
import { Clock3 } from "lucide-react";
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

function toneClasses(tone: string): string {
  if (tone === "warn") return "bg-amber-400";
  if (tone === "good") return "bg-emerald-400";
  return "bg-sky-400";
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
      <div className="flex items-center gap-2 text-white">
        <Clock3 className="w-4 h-4 text-[#f2d7d8]" />
        <span className="text-sm font-medium">Security Timeline</span>
      </div>

      {events.length === 0 ? (
        <p className="text-sm text-white/60">No security events recorded yet.</p>
      ) : (
        <div className="space-y-3">
          {events.map((event) => (
            <div key={event.id} className="flex gap-3">
              <div className="flex flex-col items-center pt-1">
                <span className={`h-2.5 w-2.5 rounded-full ${toneClasses(event.tone)}`} />
                <span className="mt-1 h-full w-px bg-white/10" />
              </div>
              <div className="pb-1">
                <p className="text-sm text-white/90">{event.label}</p>
                <p className="text-xs text-white/45 mt-0.5">{new Date(event.at).toLocaleString()}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

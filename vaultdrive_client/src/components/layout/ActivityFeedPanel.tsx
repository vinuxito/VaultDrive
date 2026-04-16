import { X, Share2, Upload } from "lucide-react";
import type { ActivityEvent } from "../../hooks";

interface ActivityFeedPanelProps {
  isOpen: boolean;
  onClose: () => void;
  events: ActivityEvent[];
}

function EventIcon({ eventType }: { eventType: string }) {
  if (eventType === "file_shared") {
    return <Share2 className="w-4 h-4 text-blue-500 shrink-0" />;
  }
  if (eventType === "drop_upload") {
    return <Upload className="w-4 h-4 text-emerald-500 shrink-0" />;
  }
  return <Upload className="w-4 h-4 text-muted-foreground shrink-0" />;
}

function eventLabel(eventType: string): string {
  if (eventType === "file_shared") return "File shared";
  if (eventType === "drop_upload") return "New file received via drop link";
  return eventType;
}

export function ActivityFeedPanel({ isOpen, onClose, events }: ActivityFeedPanelProps) {
  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-40 md:hidden"
          onClick={onClose}
        />
      )}

      <div
        className={`fixed inset-y-0 right-0 z-50 w-80 bg-card border-l border-border shadow-2xl flex flex-col transition-transform duration-300 ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
          <span className="font-semibold text-primary-foreground text-sm tracking-wide">
            Activity Feed
          </span>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-primary/40 transition-colors text-primary-foreground"
            aria-label="Close activity feed"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {events.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
              No activity yet
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {events.map((event) => (
                <li key={event.id} className="flex items-start gap-3 px-4 py-3 hover:bg-muted transition-colors">
                  <div className="mt-0.5">
                    <EventIcon eventType={event.event_type} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground leading-snug">
                      {eventLabel(event.event_type)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {new Date(event.created_at).toLocaleString()}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}

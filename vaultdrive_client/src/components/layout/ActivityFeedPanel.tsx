import { useEffect, useRef, type KeyboardEvent } from "react";
import { X, Share2, Upload } from "lucide-react";
import type { ActivityEvent } from "../../hooks";
import type { ActivityConnectionStatus } from "../../hooks/useSSE";

interface ActivityFeedPanelProps {
  isOpen: boolean;
  onClose: () => void;
  events: ActivityEvent[];
  connectionStatus?: ActivityConnectionStatus;
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

export function ActivityFeedPanel({ isOpen, onClose, events, connectionStatus = "connecting" }: ActivityFeedPanelProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const opener = document.activeElement as HTMLElement | null;
    closeButtonRef.current?.focus();

    return () => opener?.focus();
  }, [isOpen]);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }

    if (event.key !== "Tab") return;

    const focusable = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    );
    if (focusable.length === 0) {
      event.preventDefault();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (focusable.length === 1 || (event.shiftKey && document.activeElement === first)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-black/30 z-40 md:hidden"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        className="fixed inset-y-0 right-0 z-50 w-80 bg-card border-l border-border shadow-2xl flex flex-col transition-transform duration-300 translate-x-0"
        role="dialog"
        aria-modal="true"
        aria-labelledby="activity-feed-title"
        onKeyDown={handleKeyDown}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
          <span id="activity-feed-title" className="font-semibold text-foreground text-sm tracking-wide">
            Activity Feed
          </span>
          <button
            ref={closeButtonRef}
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
            aria-label="Close activity feed"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p role="status" className="border-b border-border bg-card px-4 py-3 text-sm text-muted-foreground">
          {{ live: "Live connection active. Events received in this session appear below.", connecting: "Connecting to live updates. Activity may be incomplete.", reconnecting: "Reconnecting to live updates. New activity is not confirmed yet.", offline: "You are offline. Live activity is unavailable.", paused: "Live updates are paused while this tab is hidden.", "signed-out": "Sign in to receive live updates.", forbidden: "Live updates are not permitted for this session." }[connectionStatus]}
        </p>
        <div className="flex-1 overflow-y-auto">
          {events.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
              No activity received in this session
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

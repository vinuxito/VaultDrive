import { useEffect, useRef } from "react";
import { API_URL } from "../utils/api";
import { handleUnauthorized } from "../components/protected-route";

export interface ActivityEvent {
  id: string;
  event_type: string;
  payload: Record<string, unknown>;
  created_at: string;
}

const subscribers = new Set<(event: ActivityEvent) => void>();
let sharedSource: EventSource | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_DELAY_MS = 30_000;

function normalizeEvent(raw: Record<string, unknown>): ActivityEvent {
  const payload = (raw.payload ?? {}) as Record<string, unknown>;
  const eventId =
    typeof raw.id === "string"
      ? raw.id
      : typeof payload.id === "string"
      ? payload.id
      : crypto.randomUUID();
  const createdAt =
    typeof raw.created_at === "string"
      ? raw.created_at
      : typeof payload.created_at === "string"
      ? payload.created_at
      : new Date().toISOString();

  return {
    id: eventId,
    event_type: (raw.event ?? raw.event_type ?? "") as string,
    payload,
    created_at: createdAt,
  };
}

function notifySubscribers(event: ActivityEvent) {
  subscribers.forEach((listener) => listener(event));
}

function closeSharedSource() {
  if (reconnectTimer !== null) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (sharedSource) {
    sharedSource.close();
    sharedSource = null;
  }
}

/** Exponential backoff: 5s, 10s, 20s … capped at MAX_RECONNECT_DELAY_MS */
function reconnectDelay(): number {
  return Math.min(5_000 * Math.pow(2, reconnectAttempts), MAX_RECONNECT_DELAY_MS);
}

async function obtainSSETicket(token: string): Promise<string | null> {
  try {
    const res = await fetch(`${API_URL}/events/ticket`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 401) {
      handleUnauthorized();
      return null;
    }
    if (!res.ok) return null;
    const data = (await res.json()) as { ticket?: string };
    return data.ticket ?? null;
  } catch {
    return null;
  }
}

async function connectSharedSource() {
  if (typeof window === "undefined" || sharedSource || subscribers.size === 0) {
    return;
  }

  // Do not connect when the tab is backgrounded.
  if (document.visibilityState === "hidden") return;

  const token = localStorage.getItem("token");
  if (!token) return;

  // Obtain a one-time ticket so the JWT never appears in the URL.
  const ticket = await obtainSSETicket(token);
  if (!ticket) return;

  sharedSource = new EventSource(`${API_URL}/events?ticket=${encodeURIComponent(ticket)}`);

  sharedSource.onmessage = (event: MessageEvent) => {
    reconnectAttempts = 0; // Successful message resets backoff.
    try {
      const raw = JSON.parse(event.data as string) as Record<string, unknown>;
      notifySubscribers(normalizeEvent(raw));
    } catch {
      // Malformed SSE payload — ignore silently.
    }
  };

  sharedSource.onerror = () => {
    closeSharedSource();
    if (subscribers.size > 0) {
      const delay = reconnectDelay();
      reconnectAttempts++;
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        void connectSharedSource();
      }, delay);
    }
  };
}

export function useSSE(onEvent: (event: ActivityEvent) => void): void {
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    const listener = (event: ActivityEvent) => onEventRef.current(event);
    subscribers.add(listener);
    void connectSharedSource();

    // Pause SSE when tab is hidden, resume when visible again.
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") {
        closeSharedSource();
      } else {
        void connectSharedSource();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      subscribers.delete(listener);
      document.removeEventListener("visibilitychange", handleVisibility);
      if (subscribers.size === 0) {
        closeSharedSource();
        reconnectAttempts = 0;
      }
    };
  }, []);
}

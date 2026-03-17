import { useEffect, useRef } from "react";
import { API_URL } from "../utils/api";

export interface ActivityEvent {
  id: string;
  event_type: string;
  payload: Record<string, unknown>;
  created_at: string;
}

const subscribers = new Set<(event: ActivityEvent) => void>();
let sharedSource: EventSource | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

function normalizeEvent(raw: Record<string, unknown>): ActivityEvent {
  const payload = (raw.payload ?? {}) as Record<string, unknown>;
  const eventId = typeof raw.id === "string"
    ? raw.id
    : typeof payload.id === "string"
    ? payload.id
    : crypto.randomUUID();
  const createdAt = typeof raw.created_at === "string"
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
  subscribers.forEach((listener) => {
    listener(event);
  });
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

function connectSharedSource() {
  if (typeof window === "undefined" || sharedSource || subscribers.size === 0) {
    return;
  }

  const token = localStorage.getItem("token");
  if (!token) return;

  sharedSource = new EventSource(`${API_URL}/events?token=${encodeURIComponent(token)}`);

  sharedSource.onmessage = (event: MessageEvent) => {
    try {
      const raw = JSON.parse(event.data as string) as Record<string, unknown>;
      notifySubscribers(normalizeEvent(raw));
    } catch {
    }
  };

  sharedSource.onerror = () => {
    closeSharedSource();
    if (subscribers.size > 0) {
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        connectSharedSource();
      }, 5000);
    }
  };
}

export function useSSE(onEvent: (event: ActivityEvent) => void): void {
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    const listener = (event: ActivityEvent) => onEventRef.current(event);
    subscribers.add(listener);
    connectSharedSource();

    return () => {
      subscribers.delete(listener);
      if (subscribers.size === 0) {
        closeSharedSource();
      }
    };
  }, []);
}

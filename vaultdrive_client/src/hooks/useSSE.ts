import { useEffect, useRef } from "react";
import { API_URL } from "../utils/api";

export interface ActivityEvent {
  id: string;
  event_type: string;
  payload: Record<string, unknown>;
  created_at: string;
}

export function useSSE(onEvent: (event: ActivityEvent) => void): void {
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;

    let es: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let active = true;

    const connect = () => {
      if (!active) return;

      const currentToken = localStorage.getItem("token");
      if (!currentToken) return;

      es = new EventSource(`${API_URL}/events?token=${encodeURIComponent(currentToken)}`);

      es.onmessage = (event: MessageEvent) => {
        try {
          const raw = JSON.parse(event.data as string) as Record<string, unknown>;
          const normalized: ActivityEvent = {
            id: crypto.randomUUID(),
            event_type: (raw.event ?? raw.event_type ?? "") as string,
            payload: (raw.payload ?? {}) as Record<string, unknown>,
            created_at: new Date().toISOString(),
          };
          onEventRef.current(normalized);
        } catch {
        }
      };

      es.onerror = () => {
        if (es) {
          es.close();
          es = null;
        }
        if (active) {
          reconnectTimer = setTimeout(() => {
            connect();
          }, 5000);
        }
      };
    };

    connect();

    return () => {
      active = false;
      if (reconnectTimer !== null) {
        clearTimeout(reconnectTimer);
      }
      if (es) {
        es.close();
        es = null;
      }
    };
  }, []);
}

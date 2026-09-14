import { useEffect, useLayoutEffect, useRef, useSyncExternalStore } from "react";
import { API_URL } from "../utils/api";
import { handleUnauthorized } from "../utils/auth-session";

export interface ActivityEvent {
  id: string;
  event_type: string;
  payload: Record<string, unknown>;
  created_at: string;
}
export type ActivityConnectionStatus = "connecting" | "live" | "reconnecting" | "offline" | "paused" | "signed-out" | "forbidden";

const subscribers = new Set<(event: ActivityEvent) => void>();
const statusSubscribers = new Set<() => void>();
let status: ActivityConnectionStatus = "connecting";
let sharedSource: EventSource | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let ticketRequest: AbortController | null = null;
let generation = 0;
let reconnectAttempts = 0;

function setStatus(next: ActivityConnectionStatus) {
  if (status === next) return;
  status = next;
  statusSubscribers.forEach((notify) => notify());
}
function subscribeStatus(notify: () => void) {
  statusSubscribers.add(notify);
  return () => { statusSubscribers.delete(notify); };
}

function normalizeEvent(raw: unknown): ActivityEvent | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const data = raw as Record<string, unknown>;
  const eventType = data.event ?? data.event_type;
  if (typeof eventType !== "string" || !eventType) return null;
  const payload = data.payload && typeof data.payload === "object" && !Array.isArray(data.payload) ? data.payload as Record<string, unknown> : {};
  return {
    id: typeof data.id === "string" ? data.id : typeof payload.id === "string" ? payload.id : crypto.randomUUID(),
    event_type: eventType,
    payload,
    created_at: typeof data.created_at === "string" ? data.created_at : typeof payload.created_at === "string" ? payload.created_at : new Date().toISOString(),
  };
}

function closeSharedSource() {
  generation += 1;
  if (reconnectTimer !== null) clearTimeout(reconnectTimer);
  reconnectTimer = null;
  ticketRequest?.abort();
  ticketRequest = null;
  sharedSource?.close();
  sharedSource = null;
}

function unavailableStatus(): ActivityConnectionStatus | null {
  if (!localStorage.getItem("token")) return "signed-out";
  if (navigator.onLine === false) return "offline";
  if (document.visibilityState === "hidden") return "paused";
  return null;
}

function scheduleReconnect() {
  if (subscribers.size === 0) return;
  const unavailable = unavailableStatus();
  if (unavailable) { setStatus(unavailable); return; }
  setStatus("reconnecting");
  const delay = Math.min(5000 * 2 ** Math.min(reconnectAttempts++, 3), 30_000);
  reconnectTimer = setTimeout(() => { reconnectTimer = null; void connectSharedSource(); }, delay);
}

async function connectSharedSource() {
  if (sharedSource || ticketRequest || subscribers.size === 0) return;
  const unavailable = unavailableStatus();
  if (unavailable) { setStatus(unavailable); return; }
  const token = localStorage.getItem("token");
  const attempt = generation;
  const controller = new AbortController();
  ticketRequest = controller;
  setStatus(reconnectAttempts > 0 ? "reconnecting" : "connecting");
  const stillCurrent = () => attempt === generation && subscribers.size > 0 && token === localStorage.getItem("token");
  try {
    const response = await fetch(`${API_URL}/events/ticket`, {
      method: "POST", headers: { Authorization: `Bearer ${token}` }, signal: controller.signal,
    });
    if (!stillCurrent()) return;
    if (response.status === 401) { setStatus("signed-out"); handleUnauthorized(); return; }
    if (response.status === 403) { setStatus("forbidden"); return; }
    if (!response.ok) { scheduleReconnect(); return; }
    const data: unknown = await response.json();
    if (!stillCurrent()) return;
    const ticket = data && typeof data === "object" ? (data as Record<string, unknown>).ticket : null;
    if (typeof ticket !== "string" || !ticket || ticket.length > 4096) { scheduleReconnect(); return; }
    const source = new EventSource(`${API_URL}/events?ticket=${encodeURIComponent(ticket)}`);
    sharedSource = source;
    source.onopen = () => { if (stillCurrent() && sharedSource === source) { reconnectAttempts = 0; setStatus("live"); } };
    source.onmessage = (message: MessageEvent) => {
      if (!stillCurrent() || sharedSource !== source) return;
      try {
        const event = normalizeEvent(JSON.parse(message.data as string));
        if (event) { reconnectAttempts = 0; setStatus("live"); subscribers.forEach((notify) => notify(event)); }
      } catch { /* A malformed event cannot become confirmed activity. */ }
    };
    source.onerror = () => {
      if (!stillCurrent() || sharedSource !== source) return;
      closeSharedSource();
      scheduleReconnect();
    };
  } catch {
    if (stillCurrent() && !controller.signal.aborted) scheduleReconnect();
  } finally {
    if (attempt === generation) ticketRequest = null;
  }
}

function reconnectForEnvironment() {
  closeSharedSource();
  reconnectAttempts = 0;
  void connectSharedSource();
}

export function useSSE(onEvent: (event: ActivityEvent) => void): ActivityConnectionStatus {
  const onEventRef = useRef(onEvent);
  const connectionStatus = useSyncExternalStore(subscribeStatus, () => status, () => "paused" as const);
  useLayoutEffect(() => { onEventRef.current = onEvent; }, [onEvent]);
  useEffect(() => {
    const listener = (event: ActivityEvent) => onEventRef.current(event);
    if (subscribers.size === 0) {
      document.addEventListener("visibilitychange", reconnectForEnvironment);
      window.addEventListener("online", reconnectForEnvironment);
      window.addEventListener("offline", reconnectForEnvironment);
      window.addEventListener("auth-change", reconnectForEnvironment);
    }
    subscribers.add(listener);
    void connectSharedSource();
    return () => {
      subscribers.delete(listener);
      if (subscribers.size === 0) {
        document.removeEventListener("visibilitychange", reconnectForEnvironment);
        window.removeEventListener("online", reconnectForEnvironment);
        window.removeEventListener("offline", reconnectForEnvironment);
        window.removeEventListener("auth-change", reconnectForEnvironment);
        closeSharedSource();
        reconnectAttempts = 0;
      }
    };
  }, []);
  return connectionStatus;
}

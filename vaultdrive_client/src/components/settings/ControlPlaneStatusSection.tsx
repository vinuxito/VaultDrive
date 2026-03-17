import { useCallback, useEffect, useMemo, useState } from "react";
import { ShieldCheck, Bot, AlertTriangle } from "lucide-react";

import { useSSE, type ActivityEvent } from "../../hooks";
import { API_URL } from "../../utils/api";
import { relativeTime } from "../../utils/format";
import {
  summarizeAgentOperations,
  type AgentOperationEntry,
} from "./agent-operations";

interface AgentKeyRecord {
  id: string;
  status: string;
}

interface Envelope<T> {
  success: boolean;
  data: T;
}

function toLiveEntry(event: ActivityEvent): AgentOperationEntry | null {
  if (event.event_type !== "agent_operation") return null;
  const action = typeof event.payload.action === "string" ? event.payload.action : "";
  if (!action) return null;

  return {
    id: typeof event.payload.id === "string" ? event.payload.id : event.id,
    action,
    resource_type: "agent_api_key",
    resource_id: typeof event.payload.key_id === "string" ? event.payload.key_id : undefined,
    created_at: typeof event.payload.created_at === "string" ? event.payload.created_at : event.created_at,
    metadata: event.payload,
  };
}

export function ControlPlaneStatusSection() {
  const [entries, setEntries] = useState<AgentOperationEntry[]>([]);
  const [activeKeyCount, setActiveKeyCount] = useState(0);

  const fetchSnapshot = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token) return;

    const [keysRes, auditRes] = await Promise.all([
      fetch(`${API_URL}/v1/agent-keys`, { headers: { Authorization: `Bearer ${token}` } }),
      fetch(`${API_URL}/v1/audit?resource_type=agent_api_key&limit=20&offset=0`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
    ]);

    const keysPayload = (await keysRes.json().catch(() => null)) as Envelope<AgentKeyRecord[]> | null;
    const auditPayload = (await auditRes.json().catch(() => null)) as Envelope<AgentOperationEntry[]> | null;

    setActiveKeyCount((keysPayload?.data ?? []).filter((key) => key.status === "active").length);
    setEntries(auditPayload?.data ?? []);
  }, []);

  useEffect(() => {
    void fetchSnapshot();
  }, [fetchSnapshot]);

  useSSE((event) => {
    const liveEntry = toLiveEntry(event);
    if (!liveEntry) return;
    setEntries((current) => [liveEntry, ...current].slice(0, 20));
  });

  const summary = useMemo(() => summarizeAgentOperations(entries, activeKeyCount), [entries, activeKeyCount]);
  const latestAt = entries[0]?.created_at ?? "";

  return (
    <div className="rounded-[1.8rem] border border-[#e8d9d0] bg-[linear-gradient(180deg,#fffdfb_0%,#f6efea_100%)] shadow-[0_20px_45px_rgba(125,79,80,0.08)] dark:border-slate-700 dark:bg-[linear-gradient(180deg,rgba(30,41,59,0.94)_0%,rgba(15,23,42,0.9)_100%)]">
      <div className="flex flex-col gap-4 px-6 py-5 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Control plane at a glance</p>
          <h2 className="mt-2 text-xl font-semibold text-slate-900 dark:text-slate-100">Calm, live, and reviewable</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            The system is live when the stream is connected, receipts name the call, and trust reasons are readable without opening docs.
          </p>
        </div>
        <div className="inline-flex items-center gap-2 self-start rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-medium text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          Live stream connected
        </div>
      </div>
      <div className="grid gap-3 px-6 pb-6 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-white/70 bg-white/85 px-4 py-4 dark:border-slate-700 dark:bg-slate-950/40">
          <p className="text-xs uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Latest event</p>
          <p className="mt-2 text-sm font-medium text-slate-900 dark:text-slate-100">{summary.latestEvent}</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{latestAt ? relativeTime(latestAt) : "Waiting for first live event"}</p>
        </div>
        <div className="rounded-2xl border border-white/70 bg-white/85 px-4 py-4 dark:border-slate-700 dark:bg-slate-950/40">
          <p className="text-xs uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Active keys</p>
          <p className="mt-2 flex items-center gap-2 text-sm font-medium text-slate-900 dark:text-slate-100">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            {summary.activeKeys} live credential{summary.activeKeys === 1 ? "" : "s"}
          </p>
        </div>
        <div className="rounded-2xl border border-white/70 bg-white/85 px-4 py-4 dark:border-slate-700 dark:bg-slate-950/40">
          <p className="text-xs uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Agents in view</p>
          <p className="mt-2 flex items-center gap-2 text-sm font-medium text-slate-900 dark:text-slate-100">
            <Bot className="h-4 w-4 text-[#7d4f50]" />
            {summary.activeAgents} operator lane{summary.activeAgents === 1 ? "" : "s"}
          </p>
        </div>
        <div className="rounded-2xl border border-white/70 bg-white/85 px-4 py-4 dark:border-slate-700 dark:bg-slate-950/40">
          <p className="text-xs uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Attention</p>
          <p className="mt-2 flex items-center gap-2 text-sm font-medium text-slate-900 dark:text-slate-100">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            {summary.attention}
          </p>
        </div>
      </div>
    </div>
  );
}

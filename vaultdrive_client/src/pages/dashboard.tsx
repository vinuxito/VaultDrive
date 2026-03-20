import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "../components/layout/dashboard-layout";
import { API_URL } from "../utils/api";
import {
  Files,
  Link2,
  Share2,
  Users,
  Upload,
  FolderPlus,
  Clock,
  FileUp,
  UserPlus,
  Shield,
  Activity,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";

interface StatCard {
  label: string;
  value: number | null;
  icon: React.ElementType;
  color: string;
  bg: string;
}

interface ActivityItem {
  id: string;
  event_type: string;
  message?: string;
  description?: string;
  created_at: string;
  timestamp?: string;
}

interface SecurityPosture {
  status: string;
  attention_count: number;
  expiring_tokens: { id: string; link_name: string; expires_at: string }[];
  stale_links: { id: string; token: string; created_at: string }[];
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 18) return "afternoon";
  return "evening";
}

function getActivityIcon(eventType: string): React.ElementType {
  if (eventType.includes("upload") || eventType.includes("file")) return FileUp;
  if (eventType.includes("share")) return Share2;
  if (eventType.includes("user") || eventType.includes("login")) return UserPlus;
  if (eventType.includes("drop")) return FolderPlus;
  return Activity;
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-[#7d4f50]/10 bg-white/60 p-5 animate-pulse">
      <div className="flex items-center justify-between mb-4">
        <div className="w-10 h-10 rounded-xl bg-slate-200" />
        <div className="w-8 h-4 rounded bg-slate-200" />
      </div>
      <div className="w-16 h-8 rounded bg-slate-200 mb-1" />
      <div className="w-24 h-3 rounded bg-slate-100 mt-2" />
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const firstName = user.first_name || user.email?.split("@")[0] || "there";

  const [stats, setStats] = useState<{
    files: number | null;
    links: number | null;
    shared: number | null;
    groups: number | null;
  }>({ files: null, links: null, shared: null, groups: null });
  const [statsLoading, setStatsLoading] = useState(true);

  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [activityLoading, setActivityLoading] = useState(true);
  const [activityUnavailable, setActivityUnavailable] = useState(false);
  const [posture, setPosture] = useState<SecurityPosture | null>(null);

  useEffect(() => {
    const authToken = localStorage.getItem("token");
    if (!authToken) { navigate("/login"); return; }

    const headers = { Authorization: `Bearer ${authToken}` };

    Promise.all([
      fetch(`${API_URL}/files`, { headers }).then((r) => r.ok ? r.json() : []),
      fetch(`${API_URL}/drop/tokens`, { headers }).then((r) => r.ok ? r.json() : []),
      fetch(`${API_URL}/files/shared`, { headers }).then((r) => r.ok ? r.json() : []),
      fetch(`${API_URL}/groups`, { headers }).then((r) => r.ok ? r.json() : []),
    ])
      .then(([files, tokens, shared, groups]) => {
        const activeTokens = Array.isArray(tokens)
          ? tokens.filter(
              (t: { used?: boolean; is_active?: boolean; expires_at?: string | null }) =>
                !t.used &&
                (t.is_active !== false) &&
                (!t.expires_at || new Date(t.expires_at) > new Date())
            )
          : [];
        setStats({
          files: Array.isArray(files) ? files.length : 0,
          links: activeTokens.length,
          shared: Array.isArray(shared) ? shared.length : 0,
          groups: Array.isArray(groups) ? groups.length : 0,
        });
      })
      .catch(() => setStats({ files: 0, links: 0, shared: 0, groups: 0 }))
      .finally(() => setStatsLoading(false));

    fetch(`${API_URL}/activity`, { headers })
      .then((r) => {
        if (r.status === 404) { setActivityUnavailable(true); return null; }
        if (!r.ok) { setActivityUnavailable(true); return null; }
        return r.json();
      })
      .then((data) => {
        if (data && Array.isArray(data)) {
          setActivity(data.slice(0, 5));
        }
      })
      .catch(() => setActivityUnavailable(true))
      .finally(() => setActivityLoading(false));

    fetch(`${API_URL}/security-posture`, { headers })
      .then((r) => r.ok ? r.json() : null)
      .then((data: SecurityPosture | null) => { if (data) setPosture(data); })
      .catch(() => undefined);
  }, [navigate]);

  const statCards: StatCard[] = [
    {
      label: "Total Files",
      value: stats.files,
      icon: Files,
      color: "text-[#7d4f50]",
      bg: "bg-[#f2d7d8]",
    },
    {
      label: "Active Links",
      value: stats.links,
      icon: Link2,
      color: "text-violet-600",
      bg: "bg-violet-100",
    },
    {
      label: "Shared Files",
      value: stats.shared,
      icon: Share2,
      color: "text-emerald-600",
      bg: "bg-emerald-100",
    },
    {
      label: "Groups",
      value: stats.groups,
      icon: Users,
      color: "text-amber-600",
      bg: "bg-amber-100",
    },
  ];

  const quickActions = [
    {
      label: "Upload File",
      description: "Add encrypted files to your vault",
      icon: Upload,
      color: "bg-[#7d4f50] hover:bg-[#6b4345] text-white",
      onClick: () => navigate("/files"),
    },
    {
      label: "Create Client Upload Link",
      description: "Create a secure link for client file delivery",
      icon: FolderPlus,
      color: "bg-violet-600 hover:bg-violet-700 text-white",
      onClick: () => navigate("/files"),
    },
    {
      label: "Share a File",
      description: "Securely share with a user",
      icon: Share2,
      color: "bg-emerald-600 hover:bg-emerald-700 text-white",
      onClick: () => navigate("/files"),
    },
  ];

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-8 pb-8">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
            Good {getGreeting()}, {firstName}.
          </h1>
          <p className="text-slate-500 flex items-center gap-1.5 text-sm">
            <Shield className="w-4 h-4 text-emerald-500" />
            Your vault is secure.
          </p>
        </div>

        {posture && (
          <section>
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4">
              Attention
            </h2>
            <div className="rounded-2xl border border-[#7d4f50]/10 bg-white/70 backdrop-blur-sm p-5">
              {posture.attention_count === 0 ? (
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-slate-700">Everything looks healthy</p>
                    <p className="text-xs text-slate-400 mt-0.5">No active links expiring soon, no stale shares</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                    <p className="text-sm font-medium text-slate-700">{posture.attention_count} item{posture.attention_count > 1 ? "s" : ""} need attention</p>
                  </div>
                  {posture.expiring_tokens.map((t) => (
                    <div key={t.id} className="flex items-start gap-2 pl-6">
                      <p className="text-xs text-amber-700">
                        Upload link <strong>{t.link_name || t.id.slice(0, 8)}</strong> expires {formatRelativeTime(t.expires_at)}
                      </p>
                    </div>
                  ))}
                  {posture.stale_links.map((l) => (
                    <div key={l.id} className="flex items-start gap-2 pl-6">
                      <p className="text-xs text-slate-500">
                        Share link {l.token.slice(0, 8)}… was created {formatRelativeTime(l.created_at)} and has never been accessed
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        <section>
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4">
            Vault Overview
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {statsLoading
              ? ["s1","s2","s3","s4"].map((k) => <SkeletonCard key={k} />)
              : statCards.map((card) => (
                  <div
                    key={card.label}
                    className="rounded-2xl border border-[#7d4f50]/10 bg-white/70 backdrop-blur-sm p-5 hover:shadow-md hover:shadow-[#7d4f50]/5 transition-all duration-200 cursor-default"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className={`w-10 h-10 rounded-xl ${card.bg} flex items-center justify-center`}>
                        <card.icon className={`w-5 h-5 ${card.color}`} />
                      </div>
                    </div>
                    <p className="text-3xl font-bold text-slate-900">
                      {card.value ?? "—"}
                    </p>
                    <p className="text-xs text-slate-500 mt-1 font-medium">{card.label}</p>
                  </div>
                ))}
          </div>
        </section>

        <section>
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4">
            Start Here
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {quickActions.map((action) => (
              <button
                type="button"
                key={action.label}
                onClick={action.onClick}
                className={`${action.color} rounded-xl px-5 py-4 text-left transition-all duration-200 active:scale-95 cursor-pointer`}
              >
                <action.icon className="w-5 h-5 mb-3 opacity-90" />
                <p className="font-semibold text-sm">{action.label}</p>
                <p className="text-xs opacity-75 mt-0.5">{action.description}</p>
              </button>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4">
            Activity
          </h2>
          <div className="rounded-2xl border border-[#7d4f50]/10 bg-white/70 backdrop-blur-sm overflow-hidden">
            {activityLoading ? (
              <div className="divide-y divide-slate-100">
                {["a1","a2","a3"].map((k) => (
                  <div key={k} className="flex items-center gap-3 px-5 py-4 animate-pulse">
                    <div className="w-8 h-8 rounded-lg bg-slate-200 shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3 bg-slate-200 rounded w-3/4" />
                      <div className="h-2.5 bg-slate-100 rounded w-1/3" />
                    </div>
                  </div>
                ))}
              </div>
            ) : activityUnavailable || activity.length === 0 ? (
              stats.files === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 px-6 text-center">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center mb-3">
                    <Activity className="w-5 h-5 text-slate-400" />
                  </div>
                  <p className="text-sm font-medium text-slate-700 mb-4">Get started with your vault</p>
                  <div className="w-full max-w-xs space-y-2 text-left">
                    {[
                      { step: "1", text: "Upload a file to your vault" },
                      { step: "2", text: "Create a client upload link" },
                      { step: "3", text: "Share a file with a colleague" },
                    ].map(({ step, text }) => (
                      <div key={step} className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-slate-50 border border-slate-100">
                        <span className="w-6 h-6 rounded-full bg-[#f2d7d8] text-[#7d4f50] text-xs font-semibold flex items-center justify-center shrink-0">{step}</span>
                        <p className="text-xs text-slate-600">{text}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center mb-3">
                    <Clock className="w-5 h-5 text-slate-400" />
                  </div>
                  <p className="text-sm font-medium text-slate-600">No activity yet</p>
                  <p className="text-xs text-slate-400 mt-1">Upload or share a file to begin.</p>
                </div>
              )
            ) : (
              <div className="divide-y divide-slate-100">
                {activity.map((item) => {
                  const IconComp = getActivityIcon(item.event_type);
                  const timestamp = item.created_at || item.timestamp || "";
                  return (
                    <div key={item.id} className="flex items-center gap-3 px-5 py-4 hover:bg-slate-50/60 transition-colors">
                      <div className="w-8 h-8 rounded-lg bg-[#f2d7d8] flex items-center justify-center shrink-0">
                        <IconComp className="w-4 h-4 text-[#7d4f50]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-800 truncate">
                          {item.message || item.description || item.event_type}
                        </p>
                        {timestamp && (
                          <p className="text-xs text-slate-400 mt-0.5">{formatRelativeTime(timestamp)}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>

      </div>
    </DashboardLayout>
  );
}

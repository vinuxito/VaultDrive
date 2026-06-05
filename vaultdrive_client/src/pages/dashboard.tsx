import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation, Trans } from "react-i18next";
import { API_URL } from "../utils/api";
import { getStoredUserFromLocalStorage } from "../utils/browser-storage";
import {
  FolderOpen,
  Link2,
  Share2,
  Users,
  Upload,
  FolderPlus,
  Clock,
  FileUp,
  UserPlus,
  ShieldCheck,
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
    <div className="rounded-2xl border border-primary/10 bg-card/60 p-5 animate-pulse flex flex-col h-full">
      <div className="w-10 h-10 rounded-xl bg-muted mb-4" />
      <div className="mt-auto">
        <div className="w-16 h-8 rounded bg-muted mb-1" />
        <div className="w-24 h-3 rounded bg-muted mt-2" />
      </div>
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { t } = useTranslation(["drive", "common"]);
  const user = getStoredUserFromLocalStorage() ?? {};
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
      label: t("drive:dashboard.overview.totalFiles", "Total Files"),
      value: stats.files,
      icon: FolderOpen,
      color: "text-primary",
      bg: "bg-primary/10",
    },
    {
      label: t("drive:dashboard.overview.activeLinks", "Active Links"),
      value: stats.links,
      icon: Link2,
      color: "text-violet-600 dark:text-violet-400",
      bg: "bg-violet-500/15",
    },
    {
      label: t("drive:dashboard.overview.sharedFiles", "Shared Files"),
      value: stats.shared,
      icon: Share2,
      color: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-500/15",
    },
    {
      label: t("drive:dashboard.overview.groups", "Groups"),
      value: stats.groups,
      icon: Users,
      color: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-500/15",
    },
  ];

  const quickActions = [
    {
      label: t("drive:dashboard.start.upload", "Upload File"),
      description: t("drive:dashboard.start.uploadDesc", "Add encrypted files to your vault"),
      icon: Upload,
      color: "bg-primary hover:bg-primary/90 text-white",
      onClick: () => navigate("/files"),
    },
    {
      label: t("drive:dashboard.start.createLink", "Create Client Upload Link"),
      description: t("drive:dashboard.start.createLinkDesc", "Create a secure link for client file delivery"),
      icon: FolderPlus,
      color: "bg-violet-600 hover:bg-violet-700 text-white",
      onClick: () => navigate("/files"),
    },
    {
      label: t("drive:dashboard.start.share", "Share a File"),
      description: t("drive:dashboard.start.shareDesc", "Securely share with a user"),
      icon: Share2,
      color: "bg-emerald-600 hover:bg-emerald-700 text-white",
      onClick: () => navigate("/files"),
    },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-8">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold text-foreground tracking-tight">
            {t(`drive:dashboard.greeting.${getGreeting()}`, `Good ${getGreeting()}, {{name}}.`, { name: firstName })}
          </h1>
          <p className="text-muted-foreground flex items-center gap-1.5 text-sm">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            {t("drive:dashboard.secure", "Your vault is secure.")}
          </p>
        </div>

        {posture && (
          <section>
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-4">
              {t("drive:dashboard.attention.title", "Attention")}
            </h2>
            <div className="rounded-2xl border border-primary/10 bg-card/80 backdrop-blur-sm p-5">
              {posture.attention_count === 0 ? (
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-foreground">{t("drive:dashboard.attention.healthy", "Everything looks healthy")}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{t("drive:dashboard.attention.healthyDesc", "No active links expiring soon, no stale shares")}</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                    <p className="text-sm font-medium text-foreground">
                      {posture.attention_count > 1 
                        ? t("drive:dashboard.attention.items", "{{count}} items need attention", { count: posture.attention_count })
                        : t("drive:dashboard.attention.item", "{{count}} item needs attention", { count: posture.attention_count })}
                    </p>
                  </div>
                  {posture.expiring_tokens.map((tObj) => (
                    <div key={tObj.id} className="flex items-start gap-2 pl-6">
                      <p className="text-xs text-amber-700">
                        <Trans i18nKey="drive:dashboard.attention.uploadLinkExpires" values={{ name: tObj.link_name || tObj.id.slice(0, 8), time: formatRelativeTime(tObj.expires_at) }}>
                          Upload link <strong>{ tObj.link_name || tObj.id.slice(0, 8) }</strong> expires { formatRelativeTime(tObj.expires_at) }
                        </Trans>
                      </p>
                    </div>
                  ))}
                  {posture.stale_links.map((l) => (
                    <div key={l.id} className="flex items-start gap-2 pl-6">
                      <p className="text-xs text-muted-foreground">
                        {t("drive:dashboard.attention.staleLink", "Share link {{token}}… was created {{time}} and has never been accessed", { token: l.token.slice(0, 8), time: formatRelativeTime(l.created_at) })}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        <section>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-4">
            {t("drive:dashboard.overview.title", "Vault Overview")}
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {statsLoading
              ? ["s1","s2","s3","s4"].map((k) => <SkeletonCard key={k} />)
              : statCards.map((card, index) => (
                  <div
                    key={card.label}
                    className="stat-card-enter rounded-2xl border border-primary/10 bg-card/80 backdrop-blur-sm p-5 hover:shadow-md hover:shadow-primary/5 transition-shadow duration-200 cursor-default flex flex-col h-full"
                    style={{ animationDelay: `${index * 60}ms` }}
                  >
                    <div className={`w-10 h-10 rounded-xl ${card.bg} flex items-center justify-center mb-4`}>
                      <card.icon className={`w-5 h-5 ${card.color}`} />
                    </div>
                    <div className="mt-auto">
                      <p className="text-3xl font-bold text-foreground">
                        {card.value ?? "—"}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1 font-medium">{card.label}</p>
                    </div>
                  </div>
                ))}
          </div>
        </section>

        <section>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-4">
            {t("drive:dashboard.start.title", "Start Here")}
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
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-4">
            {t("drive:dashboard.activity.title", "Activity")}
          </h2>
          <div className="rounded-2xl border border-primary/10 bg-card/80 backdrop-blur-sm overflow-hidden">
            {activityLoading ? (
              <div className="divide-y divide-border">
                {["a1","a2","a3"].map((k) => (
                  <div key={k} className="flex items-center gap-3 px-5 py-4 animate-pulse">
                    <div className="w-8 h-8 rounded-lg bg-muted shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3 bg-muted rounded w-3/4" />
                      <div className="h-2.5 bg-muted rounded w-1/3" />
                    </div>
                  </div>
                ))}
              </div>
            ) : activityUnavailable || activity.length === 0 ? (
              stats.files === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 px-6 text-center">
                  <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center mb-3">
                    <Activity className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <p className="text-sm font-medium text-foreground mb-4">{t("drive:dashboard.activity.getStarted", "Get started with your vault")}</p>
                  <div className="w-full max-w-xs space-y-2 text-left">
                    {[
                      { step: "1", text: t("drive:dashboard.activity.step1", "Upload a file to your vault") },
                      { step: "2", text: t("drive:dashboard.activity.step2", "Create a client upload link") },
                      { step: "3", text: t("drive:dashboard.activity.step3", "Share a file with a colleague") },
                    ].map(({ step, text }) => (
                      <div key={step} className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-muted border border-border">
                        <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-semibold flex items-center justify-center shrink-0">{step}</span>
                        <p className="text-xs text-muted-foreground">{text}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
                  <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center mb-3">
                    <Clock className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <p className="text-sm font-medium text-muted-foreground">{t("drive:dashboard.activity.noActivity", "No activity yet")}</p>
                  <p className="text-xs text-muted-foreground mt-1">{t("drive:dashboard.activity.noActivityDesc", "Upload or share a file to begin.")}</p>
                </div>
              )
            ) : (
              <div className="divide-y divide-border">
                {activity.map((item) => {
                  const IconComp = getActivityIcon(item.event_type);
                  const timestamp = item.created_at || item.timestamp || "";
                  return (
                    <div key={item.id} className="flex items-center gap-3 px-5 py-4 hover:bg-muted/60 transition-colors">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <IconComp className="w-4 h-4 text-primary shrink-0" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-foreground truncate">
                          {item.message || item.description || item.event_type}
                        </p>
                        {timestamp && (
                          <p className="text-xs text-muted-foreground mt-0.5">{formatRelativeTime(timestamp)}</p>
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
  );
}

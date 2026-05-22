import {
  FolderOpen,
  Link2,
  Settings,
  LogOut,
  Users,
  LayoutDashboard,
  ShieldCheck,
  HelpCircle,
} from "lucide-react";
import { cn } from "../../lib/utils";
import { useLocation, useNavigate } from "react-router-dom";
import { BrandLogo } from "../branding";
import { useTranslation } from "react-i18next";

interface SidebarProps {

  collapsed?: boolean;
}

export function Sidebar({ collapsed = false }: SidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation(["common"]);

  const navItems = [
    { icon: LayoutDashboard, label: t("common:nav.dashboard"), path: "/dashboard" },
    { icon: FolderOpen, label: t("common:nav.files"), path: "/files" },
    { icon: Users, label: t("common:nav.groups"), path: "/groups" },
    { icon: Link2, label: t("common:nav.shared"), path: "/shared" },
    { icon: ShieldCheck, label: t("common:nav.accessCenter"), path: "/access-center" },
  ];

  const handleLogout = () => {

    localStorage.removeItem("token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("user");
    window.dispatchEvent(new Event("auth-change"));
    navigate("/login");
  };

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-40 elegant-overlay border-r border-primary/15 flex-col transition-all duration-300 ease-in-out",
        collapsed ? "w-[72px]" : "w-64",
        "hidden md:flex"
      )}
    >
      <div className="flex-1 flex flex-col overflow-y-auto">
        <div className={cn("flex items-center h-16 px-4 shrink-0 transition-all duration-300", collapsed ? 'justify-center' : 'justify-between')}>
            <BrandLogo className={cn("h-8 transition-transform duration-300", collapsed && "rotate-90")} />
          </div>

        <nav className="flex-1 p-3 space-y-2">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <button
                type="button"
                key={item.label}
                onClick={() => navigate(item.path)}
                onMouseEnter={() => {
                  // Prefetch the lazy chunk on hover so navigation feels instant
                  const prefetchMap: Record<string, () => Promise<unknown>> = {
                    "/dashboard": () => import("../../pages/dashboard"),
                    "/files": () => import("../../pages/files"),
                    "/groups": () => import("../../pages/groups"),
                    "/shared": () => import("../../pages/shared"),
                    "/access-center": () => import("../../pages/access-center"),
                  };
                  prefetchMap[item.path]?.();
                }}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 text-foreground/80",
                  "hover:bg-primary/10 hover:text-foreground",
                  isActive && "bg-primary/20 text-primary font-semibold border border-primary/40",
                  "text-left",
                  collapsed && "justify-center"
                )}
                title={item.label}
              >
                <item.icon
                  className={cn(
                    "w-5 h-5 shrink-0"
                  )}
                />
                {!collapsed && <span className="font-medium text-sm">{item.label}</span>}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="p-3 border-t border-primary/15 shrink-0">
        <button
          type="button"
          onClick={() => navigate("/settings")}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 text-foreground/80",
            "hover:bg-primary/10 hover:text-foreground",
            location.pathname === '/settings' && "bg-primary/20 text-primary font-semibold border border-primary/40",
            "text-left",
            collapsed && "justify-center"
          )}
          title={t("common:nav.settings")}
        >
          <Settings className={cn("w-5 h-5 shrink-0")} />
          {!collapsed && <span className="font-medium text-sm">{t("common:nav.settings")}</span>}
        </button>

        <button
          type="button"
          onClick={() => navigate("/help")}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 text-foreground/80",
            "hover:bg-primary/10 hover:text-foreground",
            location.pathname.startsWith('/help') && "bg-primary/20 text-primary font-semibold border border-primary/40",
            "text-left",
            collapsed && "justify-center"
          )}
          title={t("common:nav.help")}
        >
          <HelpCircle className={cn("w-5 h-5 shrink-0")} />
          {!collapsed && <span className="font-medium text-sm">{t("common:nav.help")}</span>}
        </button>

        <button
            type="button"
            onClick={handleLogout}
            className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200",
                "text-destructive/80 hover:bg-destructive/10 hover:text-destructive",
                "text-left",
                collapsed && "justify-center"
            )}
            title={t("common:nav.logout")}
            >
            <LogOut className={cn("w-5 h-5 shrink-0")} />
            {!collapsed && <span className="font-medium text-sm">{t("common:nav.logout")}</span>}
        </button>

      </div>
    </aside>
  );
}
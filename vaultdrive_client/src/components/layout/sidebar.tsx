import {
  FolderOpen,
  Link2,
  Settings,
  LogOut,
  Users,
  LayoutDashboard,
  ShieldCheck,
  HelpCircle,
  User,
  Shield,
} from "lucide-react";
import { cn } from "../../lib/utils";
import { useLocation } from "react-router-dom";
import { useLogout, useTransitionNavigate } from "../../hooks";
import { BrandLogo } from "../branding";
import { useTranslation } from "react-i18next";
import { preload } from "swr";
import { API_URL } from "../../utils/api";
import { getStoredUserFromLocalStorage } from "../../utils/browser-storage";
import { isRouteActive } from "./navigation";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip";

const fetcher = (url: string) => {
  const token = localStorage.getItem("token");
  return fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  }).then((res) => {
    if (!res.ok) throw new Error("API error");
    return res.json();
  });
};

export type SidebarMode = "expanded" | "compact" | "hidden";

interface SidebarProps {
  mode?: SidebarMode;
  collapsed?: boolean;
}

export function Sidebar({ mode, collapsed = false }: SidebarProps) {
  const navigate = useTransitionNavigate();
  const logout = useLogout();
  const location = useLocation();
  const { t } = useTranslation(["common"]);
  const isAdmin = getStoredUserFromLocalStorage()?.is_admin === true;

  const isCompact = mode ? mode === "compact" : collapsed;
  const isHidden = mode === "hidden";

  const navItems = [
    { icon: LayoutDashboard, label: t("common:nav.dashboard"), path: "/dashboard" },
    { icon: FolderOpen, label: t("common:nav.files"), path: "/files" },
    { icon: Users, label: t("common:nav.groups"), path: "/groups" },
    { icon: Link2, label: t("common:nav.shared"), path: "/shared" },
    { icon: ShieldCheck, label: t("common:nav.accessCenter"), path: "/access-center" },
    ...(isAdmin ? [{ icon: Shield, label: t("common:nav.admin"), path: "/admin" }] : []),
  ];

  return (
    <TooltipProvider delayDuration={150}>
      <aside
        role="navigation"
        aria-label={t("common:nav.mainNavigation")}
        className={cn(
          "fixed inset-y-0 left-0 z-40 elegant-overlay border-r border-primary/15 flex-col transition-all duration-300 ease-in-out",
          isHidden
            ? "-translate-x-full opacity-0 pointer-events-none w-0"
            : isCompact
              ? "w-[68px] translate-x-0 opacity-100"
              : "w-64 translate-x-0 opacity-100",
          "hidden md:flex"
        )}
      >
        <div className="flex-1 flex flex-col overflow-y-auto">
          <div className={cn("flex items-center h-16 px-4 shrink-0 transition-all duration-300", isCompact ? 'justify-center' : 'justify-between')}>
              <BrandLogo className={cn("h-8 transition-transform duration-300", isCompact && "rotate-90")} />
            </div>

        <nav className="flex-1 p-3 space-y-2">
          {navItems.map((item) => {
            const isActive = isRouteActive(location.pathname, item.path);
            const btn = (
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

                  // Preload data aggressively
                  if (item.path === "/files") {
                    preload(`${API_URL}/files`, fetcher);
                    preload(`${API_URL}/folders`, fetcher);
                  } else if (item.path === "/shared") {
                    preload(`${API_URL}/files/shared`, fetcher);
                  }
                }}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 text-foreground/80",
                  "hover:bg-primary/10 hover:text-foreground",
                  isActive && "bg-primary/20 text-foreground font-semibold border border-primary/40",
                  "text-left",
                  isCompact && "justify-center"
                )}
                title={item.label}
                aria-label={item.label}
                aria-current={isActive ? "page" : undefined}
              >
                <item.icon className="w-5 h-5 shrink-0" />
                {!isCompact && <span className="font-medium text-sm">{item.label}</span>}
              </button>
            );

            if (isCompact) {
              return (
                <Tooltip key={item.label}>
                  <TooltipTrigger asChild>{btn}</TooltipTrigger>
                  <TooltipContent side="right" sideOffset={12} className="font-medium text-xs">
                    {item.label}
                  </TooltipContent>
                </Tooltip>
              );
            }
            return btn;
          })}
        </nav>
      </div>

      <div className="p-3 border-t border-primary/15 shrink-0 space-y-1">
        {isCompact ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => navigate("/profile")}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 text-foreground/80",
                  "hover:bg-primary/10 hover:text-foreground",
                  isRouteActive(location.pathname, "/profile") && "bg-primary/20 text-foreground font-semibold border border-primary/40",
                  "text-left justify-center"
                )}
                title={t("common:nav.profile")}
                aria-label={t("common:nav.profile")}
                aria-current={isRouteActive(location.pathname, "/profile") ? "page" : undefined}
              >
                <User className="w-5 h-5 shrink-0" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={12} className="font-medium text-xs">
              {t("common:nav.profile")}
            </TooltipContent>
          </Tooltip>
        ) : (
          <button
            type="button"
            onClick={() => navigate("/profile")}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 text-foreground/80",
              "hover:bg-primary/10 hover:text-foreground",
              isRouteActive(location.pathname, "/profile") && "bg-primary/20 text-foreground font-semibold border border-primary/40",
              "text-left"
            )}
            title={t("common:nav.profile")}
            aria-label={t("common:nav.profile")}
            aria-current={isRouteActive(location.pathname, "/profile") ? "page" : undefined}
          >
            <User className="w-5 h-5 shrink-0" />
            <span className="font-medium text-sm">{t("common:nav.profile")}</span>
          </button>
        )}

        {isCompact ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => navigate("/settings")}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 text-foreground/80",
                  "hover:bg-primary/10 hover:text-foreground",
                  isRouteActive(location.pathname, '/settings') && "bg-primary/20 text-foreground font-semibold border border-primary/40",
                  "text-left justify-center"
                )}
                title={t("common:nav.settings")}
                aria-label={t("common:nav.settings")}
                aria-current={isRouteActive(location.pathname, "/settings") ? "page" : undefined}
              >
                <Settings className="w-5 h-5 shrink-0" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={12} className="font-medium text-xs">
              {t("common:nav.settings")}
            </TooltipContent>
          </Tooltip>
        ) : (
          <button
            type="button"
            onClick={() => navigate("/settings")}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 text-foreground/80",
              "hover:bg-primary/10 hover:text-foreground",
              isRouteActive(location.pathname, '/settings') && "bg-primary/20 text-foreground font-semibold border border-primary/40",
              "text-left"
            )}
            title={t("common:nav.settings")}
            aria-label={t("common:nav.settings")}
            aria-current={isRouteActive(location.pathname, "/settings") ? "page" : undefined}
          >
            <Settings className="w-5 h-5 shrink-0" />
            <span className="font-medium text-sm">{t("common:nav.settings")}</span>
          </button>
        )}

        {isCompact ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => navigate("/help")}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 text-foreground/80",
                  "hover:bg-primary/10 hover:text-foreground",
                  location.pathname.startsWith('/help') && "bg-primary/20 text-foreground font-semibold border border-primary/40",
                  "text-left justify-center"
                )}
                title={t("common:nav.help")}
                aria-label={t("common:nav.help")}
                aria-current={isRouteActive(location.pathname, "/help") ? "page" : undefined}
              >
                <HelpCircle className="w-5 h-5 shrink-0" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={12} className="font-medium text-xs">
              {t("common:nav.help")}
            </TooltipContent>
          </Tooltip>
        ) : (
          <button
            type="button"
            onClick={() => navigate("/help")}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 text-foreground/80",
              "hover:bg-primary/10 hover:text-foreground",
              location.pathname.startsWith('/help') && "bg-primary/20 text-foreground font-semibold border border-primary/40",
              "text-left"
            )}
            title={t("common:nav.help")}
            aria-label={t("common:nav.help")}
            aria-current={isRouteActive(location.pathname, "/help") ? "page" : undefined}
          >
            <HelpCircle className="w-5 h-5 shrink-0" />
            <span className="font-medium text-sm">{t("common:nav.help")}</span>
          </button>
        )}

        {isCompact ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={logout}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200",
                  "text-red-700 dark:text-red-300 hover:bg-destructive/10",
                  "text-left justify-center"
                )}
                title={t("common:nav.logout")}
                aria-label={t("common:nav.logout")}
              >
                <LogOut className="w-5 h-5 shrink-0" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={12} className="font-medium text-xs">
              {t("common:nav.logout")}
            </TooltipContent>
          </Tooltip>
        ) : (
          <button
            type="button"
            onClick={logout}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200",
              "text-red-700 dark:text-red-300 hover:bg-destructive/10",
              "text-left"
            )}
            title={t("common:nav.logout")}
            aria-label={t("common:nav.logout")}
          >
            <LogOut className="w-5 h-5 shrink-0" />
            <span className="font-medium text-sm">{t("common:nav.logout")}</span>
          </button>
        )}
      </div>
    </aside>
  </TooltipProvider>
);
}

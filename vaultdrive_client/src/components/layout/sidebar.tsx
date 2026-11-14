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
  onToggleMode?: () => void;
}

export function Sidebar({ mode, collapsed = false, onToggleMode }: SidebarProps) {
  const navigate = useTransitionNavigate();
  const logout = useLogout();
  const location = useLocation();
  const { t } = useTranslation(["common"]);
  const isAdmin = getStoredUserFromLocalStorage()?.is_admin === true;

  const isCompact = mode ? mode === "compact" : collapsed;
  const isHidden = mode === "hidden";

  const triggerVaultAction = (
    action: "smart-upload" | "drop-request" | "open-reconcile" | "toggle-dual"
  ) => {
    const dispatch = () => {
      if (action === "toggle-dual") {
        const cur = localStorage.getItem("abrn_continuum_viewport");
        const next = cur === "dual" ? "desktop" : "dual";
        localStorage.setItem("abrn_continuum_viewport", next);
        window.dispatchEvent(
          new CustomEvent("abrn-vault-action", { detail: { action: "set-viewport", viewport: next } })
        );
      } else {
        window.dispatchEvent(new CustomEvent("abrn-vault-action", { detail: { action } }));
      }
    };
    if (!location.pathname.startsWith("/files")) {
      navigate("/files");
      setTimeout(dispatch, 180);
      return;
    }
    dispatch();
  };

  const navItems = [
    { icon: FolderOpen, label: t("common:nav.files"), path: "/files", badge: "AES" },
    { icon: Link2, label: t("common:nav.shared"), path: "/shared", badge: "#key" },
    { icon: Users, label: t("common:nav.groups"), path: "/groups" },
    { icon: ShieldCheck, label: t("common:nav.accessCenter"), path: "/access-center", badge: "OK", emerald: true },
    { icon: LayoutDashboard, label: t("common:nav.dashboard"), path: "/dashboard" },
    ...(isAdmin ? [{ icon: Shield, label: t("common:nav.admin"), path: "/admin" }] : []),
  ];

  return (
    <TooltipProvider delayDuration={150}>
      <aside
        role="navigation"
        aria-label={t("common:nav.mainNavigation")}
        style={{ background: "var(--abrn-bg-elevated)", borderColor: "var(--abrn-border)" }}
        className={cn(
          "fixed inset-y-0 left-0 z-40 border-r flex-col transition-all duration-200 ease-in-out",
          isHidden
            ? "-translate-x-full opacity-0 pointer-events-none w-0"
            : isCompact
              ? "w-[68px] translate-x-0 opacity-100"
              : "w-[238px] translate-x-0 opacity-100",
          "hidden md:flex"
        )}
      >
        <div className="flex-1 flex flex-col overflow-y-auto overflow-x-hidden">
          <div
            style={{ borderColor: "var(--abrn-border)" }}
            className={cn(
              "flex items-center h-[54px] px-3 border-b shrink-0 transition-all duration-200",
              isCompact ? "justify-center" : "justify-start"
            )}
          >
            <div
              onClick={onToggleMode}
              title="Expandir o compactar menú lateral (⌘B)"
              className={cn("flex items-center gap-2.5 min-w-0", onToggleMode && "cursor-pointer")}
            >
              <BrandLogo className="h-9 w-9 rounded-lg object-contain border border-primary/25 bg-card p-0.5 shrink-0 shadow-2xs" />
              {!isCompact && (
                <div className="min-w-0">
                  <div className="abrn-serif text-[13.5px] font-bold text-foreground leading-tight truncate">
                    ABRN Drive
                  </div>
                  <div className="text-[10.5px] font-bold text-primary leading-tight truncate">
                    ABRN Asesores
                  </div>
                </div>
              )}
            </div>
          </div>

        <nav className="flex-1 p-2.5 space-y-1">
          {!isCompact && (
            <div className="px-2 pt-1 pb-0.5 text-[10px] font-extrabold uppercase tracking-[0.08em] text-muted-foreground">
              Bóveda ABRN
            </div>
          )}
          {navItems.map((item) => {
            const isActive = isRouteActive(location.pathname, item.path);
            const btn = (
              <button
                type="button"
                key={item.label}
                onClick={() => navigate(item.path)}
                onMouseEnter={() => {
                  const prefetchMap: Record<string, () => Promise<unknown>> = {
                    "/dashboard": () => import("../../pages/dashboard"),
                    "/files": () => import("../../pages/files"),
                    "/groups": () => import("../../pages/groups"),
                    "/shared": () => import("../../pages/shared"),
                    "/access-center": () => import("../../pages/access-center"),
                  };
                  prefetchMap[item.path]?.();

                  if (item.path === "/files") {
                    preload(`${API_URL}/files`, fetcher);
                    preload(`${API_URL}/folders`, fetcher);
                  } else if (item.path === "/shared") {
                    preload(`${API_URL}/files/shared`, fetcher);
                  }
                }}
                className={cn(
                  "w-full h-[38px] flex items-center px-2.5 rounded-[10px] transition-all duration-150 text-muted-foreground border border-transparent",
                  "hover:bg-card hover:text-foreground hover:border-border",
                  isActive && "bg-primary/15 text-primary font-bold border-primary/35",
                  "text-left",
                  isCompact ? "justify-center" : "justify-between gap-2"
                )}
                title={item.label}
                aria-label={item.label}
                aria-current={isActive ? "page" : undefined}
              >
                <span className="flex items-center gap-2.5 min-w-0 overflow-hidden">
                  <item.icon className="w-[17px] h-[17px] shrink-0" />
                  {!isCompact && <span className="font-semibold text-[12.5px] truncate">{item.label}</span>}
                </span>
                {!isCompact && item.badge && (
                  <span
                    className={cn(
                      "abrn-mono text-[10px] px-1.5 py-0.5 rounded-full font-bold shrink-0 border",
                      item.emerald
                        ? "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                        : "bg-card text-primary border-border"
                    )}
                  >
                    {item.badge}
                  </span>
                )}
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

          {!isCompact && (
            <div className="px-2 pt-3 pb-0.5 text-[10px] font-extrabold uppercase tracking-[0.08em] text-muted-foreground">
              Flujo Contable
            </div>
          )}

          <button
            type="button"
            data-testid="sidebar-smart-upload-btn"
            onClick={() => triggerVaultAction("smart-upload")}
            title="Subir y Ordenar Archivos Sueltos"
            className={cn(
              "w-full h-[38px] flex items-center px-2.5 rounded-[10px] transition-all duration-150 text-muted-foreground border border-transparent hover:bg-card hover:text-foreground hover:border-border cursor-pointer",
              isCompact ? "justify-center" : "justify-between gap-2"
            )}
          >
            <span className="flex items-center gap-2.5 min-w-0 overflow-hidden">
              <svg className="w-[17px] h-[17px] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              {!isCompact && <span className="font-semibold text-[12.5px] truncate">Subir y Ordenar</span>}
            </span>
            {!isCompact && (
              <span className="abrn-mono text-[10px] px-1.5 py-0.5 rounded-full font-bold shrink-0 bg-card text-primary border border-border">
                Auto
              </span>
            )}
          </button>

          <button
            type="button"
            data-testid="sidebar-reconcile-btn"
            onClick={() => triggerVaultAction("open-reconcile")}
            title="Conciliación CFDI 4.0 ↔ Estado de Cuenta en RAM"
            className={cn(
              "w-full h-[38px] flex items-center px-2.5 rounded-[10px] transition-all duration-150 text-muted-foreground border border-transparent hover:bg-card hover:text-foreground hover:border-border cursor-pointer",
              isCompact ? "justify-center" : "justify-between gap-2"
            )}
          >
            <span className="flex items-center gap-2.5 min-w-0 overflow-hidden">
              <svg className="w-[17px] h-[17px] shrink-0 text-emerald-700 dark:text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
              {!isCompact && <span className="font-semibold text-[12.5px] truncate">Cuadre BBVA</span>}
            </span>
            {!isCompact && (
              <span className="abrn-mono text-[10px] px-1.5 py-0.5 rounded-full font-bold shrink-0 bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                RAM
              </span>
            )}
          </button>

          <button
            type="button"
            data-testid="sidebar-dual-continuum-btn"
            onClick={() => triggerVaultAction("toggle-dual")}
            title="Espejo Continuo en Vivo (Escritorio + Celular 0ms)"
            className={cn(
              "w-full h-[38px] flex items-center px-2.5 rounded-[10px] transition-all duration-150 text-muted-foreground border border-transparent hover:bg-card hover:text-foreground hover:border-border cursor-pointer",
              isCompact ? "justify-center" : "justify-between gap-2"
            )}
          >
            <span className="flex items-center gap-2.5 min-w-0 overflow-hidden">
              <svg className="w-[17px] h-[17px] shrink-0 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="3" width="13" height="11" rx="2" />
                <rect x="16" y="7" width="6" height="14" rx="1.5" />
                <path d="M6 18h5" />
              </svg>
              {!isCompact && <span className="font-semibold text-[12.5px] truncate">Dual en Vivo</span>}
            </span>
            {!isCompact && (
              <span className="abrn-mono text-[10px] px-1.5 py-0.5 rounded-full font-bold shrink-0 bg-primary/15 text-primary border border-primary/30">
                0ms
              </span>
            )}
          </button>

          <button
            type="button"
            data-testid="sidebar-drop-request-btn"
            onClick={() => triggerVaultAction("drop-request")}
            title="Pedir Documentos por WhatsApp (Buzón Secure Drop)"
            className={cn(
              "w-full h-[38px] flex items-center px-2.5 rounded-[10px] transition-all duration-150 text-muted-foreground border border-transparent hover:bg-card hover:text-foreground hover:border-border cursor-pointer relative",
              isCompact ? "justify-center" : "justify-between gap-2"
            )}
          >
            {isCompact && (
              <span className="absolute top-1.5 right-2 w-1.5 h-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400" />
            )}
            <span className="flex items-center gap-2.5 min-w-0 overflow-hidden">
              <svg className="w-[17px] h-[17px] shrink-0 text-emerald-700 dark:text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
                <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
              </svg>
              {!isCompact && <span className="font-semibold text-[12.5px] truncate">Buzón Drop</span>}
            </span>
            {!isCompact && (
              <span className="abrn-mono text-[10px] px-1.5 py-0.5 rounded-full font-bold shrink-0 bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                Drop
              </span>
            )}
          </button>
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
                  "text-muted-foreground hover:text-destructive hover:bg-destructive/10",
                  "text-left justify-center cursor-pointer"
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
              "text-muted-foreground hover:text-destructive hover:bg-destructive/10",
              "text-left cursor-pointer"
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

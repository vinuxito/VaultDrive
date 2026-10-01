import { Link, useLocation } from "react-router-dom";
import { Files, Share2, User, Lock } from "lucide-react";
import { cn } from "../../lib/utils";
import { useTranslation } from "react-i18next";
import { useTransitionNavigate } from "../../hooks";
import { isRouteActive } from "../layout/navigation";
import { playDeadboltThud } from "../../utils/audioHaptics";

export function BottomNav() {
  const location = useLocation();
  const navigate = useTransitionNavigate();
  const { t } = useTranslation(["common", "drive"]);
  const token = localStorage.getItem("token");

  if (!token || location.pathname === "/login") {
    return null;
  }

  const handleQuickLock = () => {
    playDeadboltThud();
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(25);
    }
    window.dispatchEvent(new CustomEvent("vault-action", { detail: { action: "lock" } }));
  };

  const navItems = [
    { path: "/files", icon: Files, label: t("common:nav.files") },
    { path: "/shared", icon: Share2, label: t("common:nav.shared") },
    { path: "/profile", icon: User, label: t("common:nav.profile") },
  ];

  return (
    <nav
      aria-label={t("common:nav.bottomNavigation", "Bottom navigation")}
      className="fixed bottom-0 left-0 right-0 z-30 lux-navbar border-t border-primary/15 md:hidden safe-area-bottom"
    >
      <div className="flex min-h-16 items-stretch justify-around py-1">
        {navItems.slice(0, 2).map(({ path, icon: Icon, label }) => {
          const isActive = isRouteActive(location.pathname, path);
          return (
            <Link
              key={path}
              to={path}
              onClick={(e) => {
                e.preventDefault();
                navigate(path);
              }}
              className={cn(
                "flex min-w-0 flex-1 flex-col items-center justify-center px-1 py-1 transition-colors duration-200 cursor-pointer min-h-[48px]",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className={cn("w-5 h-5 mb-1", isActive && "fill-current")} />
              <span className="line-clamp-2 text-center text-[11px] font-medium leading-tight">{label}</span>
            </Link>
          );
        })}

        {/* Sovereign Emergency Lock button in thumb sweep (Bottom 40%) */}
        <button
          type="button"
          onClick={handleQuickLock}
          aria-label={t("drive:vault.lockVault", "Bloquear Bóveda")}
          className="flex min-w-0 flex-1 flex-col items-center justify-center px-1 py-1 transition-colors duration-200 cursor-pointer text-amber-500/90 hover:text-amber-500 active:scale-95 min-h-[48px]"
        >
          <div className="p-1 rounded-lg bg-amber-500/10 border border-amber-500/20 mb-0.5">
            <Lock className="w-4 h-4 text-amber-500" />
          </div>
          <span className="line-clamp-2 text-center text-[10px] font-semibold tracking-tight text-amber-600 dark:text-amber-400">
            {t("drive:vault.lockNav", "Bloquear")}
          </span>
        </button>

        {navItems.slice(2).map(({ path, icon: Icon, label }) => {
          const isActive = isRouteActive(location.pathname, path);
          return (
            <Link
              key={path}
              to={path}
              onClick={(e) => {
                e.preventDefault();
                navigate(path);
              }}
              className={cn(
                "flex min-w-0 flex-1 flex-col items-center justify-center px-1 py-1 transition-colors duration-200 cursor-pointer min-h-[48px]",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className={cn("w-5 h-5 mb-1", isActive && "fill-current")} />
              <span className="line-clamp-2 text-center text-[11px] font-medium leading-tight">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

import { Link, useLocation } from "react-router-dom";
import { Files, Share2, User } from "lucide-react";
import { cn } from "../../lib/utils";
import { useTranslation } from "react-i18next";
import { useTransitionNavigate } from "../../hooks";
import { isRouteActive } from "../layout/navigation";

export function BottomNav() {
  const location = useLocation();
  const navigate = useTransitionNavigate();
  const { t } = useTranslation(["common"]);
  const token = localStorage.getItem("token");


  if (!token || location.pathname === "/login") {
    return null;
  }

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
        {navItems.map(({ path, icon: Icon, label }) => {
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
                "flex min-w-0 flex-1 flex-col items-center justify-center px-1 py-1 transition-colors duration-200",
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

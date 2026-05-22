import { Link, useLocation } from "react-router-dom";
import { Files, Share2, User } from "lucide-react";
import { cn } from "../../lib/utils";
import { useTranslation } from "react-i18next";

export function BottomNav() {
  const location = useLocation();
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
    <nav className="fixed bottom-0 left-0 right-0 z-30 lux-navbar border-t border-primary/15 md:hidden safe-area-bottom">
      <div className="flex items-center justify-around h-16">
        {navItems.map(({ path, icon: Icon, label }) => {
          const isActive = location.pathname === path;
          return (
            <Link
              key={path}
              to={path}
              className={cn(
                "flex flex-col items-center justify-center flex-1 h-full transition-colors duration-200",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className={cn("w-5 h-5 mb-1", isActive && "fill-current")} />
              <span className="text-xs font-medium">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

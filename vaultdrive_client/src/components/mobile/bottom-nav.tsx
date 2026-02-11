import { Link, useLocation } from "react-router-dom";
import { Home, Files, Share2, User } from "lucide-react";
import { cn } from "../../lib/utils";

export function BottomNav() {
  const location = useLocation();
  const token = localStorage.getItem("token");

  if (!token || location.pathname === "/login") {
    return null;
  }

  const navItems = [
    { path: "/", icon: Home, label: "Home" },
    { path: "/files", icon: Files, label: "Files" },
    { path: "/shared", icon: Share2, label: "Shared" },
    { path: "/profile", icon: User, label: "Profile" },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 glass border-t border-white/10 md:hidden safe-area-bottom">
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

import {
  FolderOpen,
  Link2,
  Settings,
  LogOut,
  Users,
  LayoutDashboard,
  ShieldCheck,
} from "lucide-react";
import { cn } from "../../lib/utils";
import { useLocation, useNavigate } from "react-router-dom";
import { BrandLogo } from "../branding";

interface SidebarProps {
  collapsed?: boolean;
}

export function Sidebar({ collapsed = false }: SidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard" },
    { icon: FolderOpen, label: "Files", path: "/files" },
    { icon: Users, label: "Groups", path: "/groups" },
    { icon: Link2, label: "Shared with Me", path: "/shared" },
    { icon: ShieldCheck, label: "Access Center", path: "/access-center" },
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
          title="Settings"
        >
          <Settings className={cn("w-5 h-5 shrink-0")} />
          {!collapsed && <span className="font-medium text-sm">Settings</span>}
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
            title="Logout"
            >
            <LogOut className={cn("w-5 h-5 shrink-0")} />
            {!collapsed && <span className="font-medium text-sm">Logout</span>}
        </button>
      </div>
    </aside>
  );
}
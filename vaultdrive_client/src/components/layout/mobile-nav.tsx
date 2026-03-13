import { Home, Files, Share2, Settings, User, LogOut, X, Users } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { cn } from "../../lib/utils";
import { ABRNLogo, PoweredByBadge } from "../branding";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";

interface MobileNavProps {
  isOpen: boolean;
  onClose: () => void;
}

interface NavLinkProps {
  to: string;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  isActive: boolean;
  handler?: () => void;
}

export function MobileNav({ isOpen, onClose }: MobileNavProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const user = JSON.parse(localStorage.getItem("user") || "{}");

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("user");
    window.dispatchEvent(new Event("auth-change"));
    navigate("/login");
    onClose();
  };

  const [, setRefresh] = useState(0);

  useEffect(() => {
    const updateAuth = () => setRefresh((v) => v + 1);
    window.addEventListener("auth-change", updateAuth);
    window.addEventListener("storage", updateAuth);
    return () => {
      window.removeEventListener("auth-change", updateAuth);
      window.removeEventListener("storage", updateAuth);
    };
  }, []);

  if (!isOpen) return null;
  
  const getInitials = (name?: string) => {
    if (!name) return "?";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase();
  };

  const navItems = [
    { to: "/", icon: <Home />, label: "Home", handler: () => {
      const token = localStorage.getItem("token");
      if (token) {
        navigate("/files");
      }
    }},
    { to: "/files", icon: <Files />, label: "Files" },
    { to: "/groups", icon: <Users />, label: "Groups" },
    { to: "/shared", icon: <Share2 />, label: "Shared" },
    { to: "/profile", icon: <User />, label: "Profile" },
    { to: "/settings", icon: <Settings />, label: "Settings" },
  ];

  return (
    <>
      <div
        className="fixed inset-0 bg-black/60 z-40 animate-fade-in md:hidden"
        onClick={onClose}
      />
      <div className="fixed inset-y-0 left-0 w-[280px] elegant-overlay z-50 animate-slide-right flex flex-col md:hidden">
        <div className="flex items-center justify-between p-4 border-b border-[#7d4f50]/15">
          <Link to="/" onClick={onClose} className="flex items-center gap-2">
            <ABRNLogo className="h-8" alt="ABRN Asesores" />
          </Link>
          <button
            onClick={onClose}
            className="p-2 hover:bg-[#7d4f50]/10 rounded-full transition-colors"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {user.username && (
          <div className="p-4 border-b border-[#7d4f50]/15">
            <Link to="/profile" onClick={onClose} className="flex items-center gap-3">
              <Avatar className="w-10 h-10">
                <AvatarImage src={user.avatar_url} />
                <AvatarFallback className="bg-primary/20 text-primary font-semibold">
                  {getInitials(user.first_name) || "?"}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium text-foreground">{user.first_name} {user.last_name}</p>
                <p className="text-xs text-muted-foreground">{user.email}</p>
              </div>
            </Link>
          </div>
        )}

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {user.username &&
            navItems.map((item) => (
              <NavLink
                key={item.label}
                to={item.to}
                icon={item.icon}
                label={item.label}
                onClick={onClose}
                isActive={location.pathname === item.to}
                handler={item.handler}
              />
            ))}
        </nav>

        {user.username && (
          <div className="p-3 border-t border-[#7d4f50]/15">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 p-3 rounded-lg text-red-500/80 hover:bg-red-500/10 hover:text-red-500 transition-colors"
              aria-label="Logout"
            >
              <LogOut className="w-5 h-5" />
              <span className="font-medium text-sm">Logout</span>
            </button>
          </div>
        )}

        <div className="p-3 border-t border-[#7d4f50]/15">
          <PoweredByBadge className="text-xs" />
        </div>
      </div>
    </>
  );
}

function NavLink({ to, icon, label, onClick, isActive, handler }: NavLinkProps) {
  const handleClick = (e: React.MouseEvent) => {
    if (handler) {
      e.preventDefault();
      handler();
    }
    onClick();
  };

  return (
    <Link
      to={handler ? "/files" : to}
      onClick={handleClick}
      className={cn(
        "flex items-center gap-3 p-3 rounded-lg transition-colors text-foreground/70",
        isActive ? "bg-[#7d4f50]/20 text-[#c4999b]" : "hover:bg-[#7d4f50]/10 hover:text-foreground"
      )}
      role="menuitem"
    >
      <span className="w-5 h-5">{icon}</span>
      <span className="font-medium text-sm">{label}</span>
    </Link>
  );
}
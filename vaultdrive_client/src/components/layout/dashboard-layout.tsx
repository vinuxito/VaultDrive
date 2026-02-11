

import { useState, type ReactNode, useEffect } from "react";
import { Menu, Search, Bell, Command } from "lucide-react";
import { Sidebar } from "./sidebar";
import { MobileNav } from "./mobile-nav";
import { BottomNav } from "../mobile/bottom-nav";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { useNavigate } from "react-router-dom";
import { CommandPalette } from "./command-palette";
import { PoweredByBadge } from "../branding";
import { cn } from "../../lib/utils";

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const navigate = useNavigate();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);

  const user = JSON.parse(localStorage.getItem("user") || "{}");
  
  // Effect to listen for Cmd+K to open the command palette
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setShowCommandPalette(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("user");
    window.dispatchEvent(new Event("auth-change"));
    navigate("/login");
  };
  
  const getInitials = (name?: string) => {
    if (!name) return "?";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase();
  };


  return (
    <div className="min-h-screen w-full bg-slate-950 text-foreground flex">
      <div className="fixed inset-0 z-[-1] bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950" />
      
      <CommandPalette isOpen={showCommandPalette} onClose={() => setShowCommandPalette(false)} />

      <Sidebar
        collapsed={sidebarCollapsed}
      />

      <MobileNav isOpen={showMobileMenu} onClose={() => setShowMobileMenu(false)} />

      <main className={cn(
        "flex-1 flex flex-col min-w-0 transition-all duration-300 ease-in-out pb-16 md:pb-0",
        sidebarCollapsed ? "md:ml-[72px]" : "md:ml-64"
        )}>
        <header className="sticky top-0 z-30 bg-slate-900/80 backdrop-blur-xl border-b border-white/10 px-4 sm:px-6 py-3 flex items-center justify-between shadow-lg shadow-black/5">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="p-2 rounded-lg hover:bg-white/10 transition-colors hidden md:block"
              aria-label="Toggle sidebar"
            >
              <Menu className="w-5 h-5" />
            </button>
            <button
              onClick={() => setShowMobileMenu(true)}
              className="p-2 rounded-lg hover:bg-white/10 transition-colors md:hidden"
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            
            <button 
              onClick={() => setShowCommandPalette(true)}
              className="hidden sm:flex items-center gap-2 p-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
            >
                <Search className="w-4 h-4" />
                <span>Search...</span>
                <kbd className="ml-4 px-1.5 py-0.5 text-xs border border-white/10 rounded-md bg-white/5 flex items-center gap-1">
                    <Command className="w-2.5 h-2.5" />K
                </kbd>
            </button>
          </div>

          <div className="flex items-center gap-3">
            <button 
              onClick={() => setShowCommandPalette(true)}
              className="p-2 rounded-full hover:bg-white/10 transition-colors sm:hidden" aria-label="Search"
            >
              <Search className="w-5 h-5" />
            </button>

            <button className="p-2 rounded-full hover:bg-white/10 transition-colors relative" aria-label="Notifications">
              <Bell className="w-5 h-5" />
              <span className="absolute top-2 right-2 w-1.5 h-1.5 bg-red-500 rounded-full" />
            </button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2">
                <Avatar className="w-8 h-8">
                  <AvatarImage src={user.avatar_url} />
                  <AvatarFallback className="bg-primary/20 text-primary font-semibold">
                    {getInitials(user.first_name) || "?"}
                  </AvatarFallback>
                </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 bg-slate-900/95 dark:bg-slate-900/95 backdrop-blur-2xl border-white/20 shadow-xl">
                <DropdownMenuLabel>
                  <p className="font-semibold">{user.first_name} {user.last_name}</p>
                  <p className="text-xs text-muted-foreground font-normal">{user.email}</p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate('/profile')}>Profile</DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/settings')}>Settings</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-red-500 focus:bg-red-500/10 focus:text-red-500">
                  Logout
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <div className="px-2 py-2">
                  <PoweredByBadge className="text-xs" />
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-4 sm:p-6">
          {children}
        </div>
      </main>

      <BottomNav />
    </div>
  );
}

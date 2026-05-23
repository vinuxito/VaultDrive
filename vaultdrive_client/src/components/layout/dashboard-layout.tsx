

import { useState, useRef, type ReactNode, useEffect } from "react";
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
import { useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
// Local command palette removed to use global one
import { PoweredByBadge } from "../branding";
import { cn } from "../../lib/utils";
import { useSessionVault } from "../../context/SessionVaultContext";
import { useSSE } from "../../hooks";
import type { ActivityEvent } from "../../hooks";
import { ActivityFeedPanel } from "./ActivityFeedPanel";
import { Toast } from "./Toast";
import type { ToastMessage } from "./Toast";
import { OnboardingWizard } from "../onboarding/OnboardingWizard";
import { requiresPinSetup } from "../../utils/pin-trust";
import { API_URL } from "../../utils/api";
import { getStoredUserFromLocalStorage } from "../../utils/browser-storage";
import { useTranslation } from "react-i18next";

interface DashboardLayoutProps {

  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const sessionVault = useSessionVault();
  const { t } = useTranslation(["common", "drive"]);
  const { clearVault } = useSessionVault();

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  // Command palette state moved to global component
  const [activityFeedOpen, setActivityFeedOpen] = useState(false);
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const user = getStoredUserFromLocalStorage() ?? {};
  const [showOnboarding, setShowOnboarding] = useState(() => requiresPinSetup(user));

  // Verify PIN status from server to handle stale localStorage
  useEffect(() => {
    if (!showOnboarding) return;
    const token = localStorage.getItem("token");
    if (!token) return;
    fetch(`${API_URL}/users/pin/status`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (data?.pin_set) {
          // PIN already set server-side — update localStorage and dismiss onboarding
          const stored = getStoredUserFromLocalStorage() ?? {};
          localStorage.setItem("user", JSON.stringify({ ...stored, pin_set: true }));
          setShowOnboarding(false);
        }
      })
      .catch(() => undefined);
  }, [showOnboarding]);

  const handleOnboardingComplete = () => {
    setShowOnboarding(false);
    window.dispatchEvent(new Event("auth-change"));
  };

  useEffect(() => {
    const handleAuthChange = () => {
      const latestUser = getStoredUserFromLocalStorage() ?? {};
      if (requiresPinSetup(latestUser)) {
        setShowOnboarding(true);
      }
    };

    window.addEventListener("auth-change", handleAuthChange);
    return () => window.removeEventListener("auth-change", handleAuthChange);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }));
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (toasts.length === 0) return;
    const timer = setTimeout(() => {
      setToasts((prev) => prev.slice(1));
    }, 4000);
    return () => clearTimeout(timer);
  }, [toasts]);

  // Burst consolidation: events arriving within 800 ms are grouped into one toast.
  const burstCount = useRef(0);
  const burstTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firstBurstEvent = useRef<typeof events[number] | null>(null);

  useSSE((event) => {
    setEvents((prev) => [event, ...prev].slice(0, 50));
    setUnreadCount((prev) => prev + 1);

    burstCount.current += 1;
    if (firstBurstEvent.current === null) {
      firstBurstEvent.current = event;
    }

    if (burstTimer.current !== null) {
      clearTimeout(burstTimer.current);
    }

    burstTimer.current = setTimeout(() => {
      burstTimer.current = null;
      const count = burstCount.current;
      const first = firstBurstEvent.current;
      burstCount.current = 0;
      firstBurstEvent.current = null;

      const message =
        count > 1
          ? t("common:notifications.newActivities", { count })
          : first?.event_type === "file_shared"
          ? t("common:notifications.fileShared")
          : first?.event_type === "drop_upload"
          ? t("common:notifications.dropUpload")
          : t("common:notifications.newActivity", { type: first?.event_type ?? "" });

      setToasts((prev) => [...prev, { id: crypto.randomUUID(), message, type: "info" } as ToastMessage]);
    }, 800);

  });

  const handleLogout = () => {
    clearVault();
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
    <div className="min-h-screen w-full text-foreground flex">
      <div className="fixed inset-0 z-[-1]" style={{background: "var(--gradient-page)"}} />

        {showOnboarding && (
          <OnboardingWizard onComplete={handleOnboardingComplete} />
        )}
      
      {/* Global CommandPalette renders via App.tsx */}

      <Sidebar
        collapsed={sidebarCollapsed}
      />

      <MobileNav isOpen={showMobileMenu} onClose={() => setShowMobileMenu(false)} />

      <main className={cn(
        "flex-1 flex flex-col min-w-0 transition-all duration-300 ease-in-out pb-16 md:pb-0",
        sidebarCollapsed ? "md:ml-[72px]" : "md:ml-64"
        )}>
        <header className="sticky top-0 z-30 lux-navbar px-4 sm:px-6 py-3 flex items-center justify-between shadow-sm shadow-primary/5">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="p-2 rounded-lg hover:bg-primary/10 transition-colors hidden md:block"
              aria-label="Toggle sidebar"
            >
              <Menu className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={() => setShowMobileMenu(true)}
              className="p-2 rounded-lg hover:bg-primary/10 transition-colors md:hidden"
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            
            <button 
              type="button"
              onClick={() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }))}
              className="hidden sm:flex items-center gap-2 p-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-primary/5 transition-colors"
            >
              <Search className="w-4 h-4" />
                <span>{t("common:nav.search")}</span>
                <kbd className="ml-4 px-1.5 py-0.5 text-xs border border-primary/20 rounded-md bg-primary/5 flex items-center gap-1">

                    <Command className="w-2.5 h-2.5" />K
                </kbd>
            </button>
          </div>

          <div className="flex items-center gap-3">
            <button 
              type="button"
              onClick={() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }))}
              className="p-2 rounded-full hover:bg-primary/10 transition-colors sm:hidden" aria-label="Search"
            >
              <Search className="w-5 h-5" />
            </button>

            <button
              type="button"
              onClick={() => { setActivityFeedOpen(true); setUnreadCount(0); }}
              className="p-2 rounded-full hover:bg-primary/10 transition-colors relative"
              aria-label="Notifications"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 min-w-[16px] h-4 px-0.5 bg-red-500 rounded-full text-white text-[10px] font-bold flex items-center justify-center">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" className="flex items-center gap-2">
                <Avatar className="w-8 h-8">
                  <AvatarImage src={typeof user.avatar_url === "string" ? user.avatar_url : undefined} />
                  <AvatarFallback className="bg-primary/20 text-primary font-semibold">
                    {getInitials(user.first_name) || "?"}
                  </AvatarFallback>
                </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 bg-gradient-to-br from-primary to-primary/90 backdrop-blur-2xl border-white/20 shadow-xl text-white">
                <DropdownMenuLabel>
                  <p className="font-semibold">{user.first_name} {user.last_name}</p>
                  <p className="text-xs text-muted-foreground font-normal">{user.email}</p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate('/profile')}>{t("common:userMenu.profile")}</DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/settings')}>{t("common:userMenu.settings")}</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-red-500 focus:bg-red-500/10 focus:text-red-500">
                  {t("common:userMenu.logout")}
                </DropdownMenuItem>

                <DropdownMenuSeparator />
                <div className="px-2 py-2">
                  <PoweredByBadge className="text-xs" />
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-4 sm:p-6 relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
              className="h-full"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      <BottomNav />

      <ActivityFeedPanel
        isOpen={activityFeedOpen}
        onClose={() => setActivityFeedOpen(false)}
        events={events}
      />
      <Toast
        toasts={toasts}
        onDismiss={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))}
      />
    </div>
  );
}

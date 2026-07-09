import { useState, useRef, type ReactNode, useEffect, useCallback } from "react";
import { Menu, Search, Bell, Command } from "lucide-react";
import { Sidebar } from "./sidebar";
import { MobileNav } from "./mobile-nav";
import { BottomNav } from "../mobile/bottom-nav";
import { LanguageToggle } from "../ui/language-toggle";
import { useTheme } from "../theme-provider";

import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { useLocation } from "react-router-dom";
import { useTransitionNavigate } from "../../hooks";
import { motion, AnimatePresence } from "framer-motion";
// Local command palette removed to use global one
import { PoweredByBadge } from "../branding";
import { cn } from "../../lib/utils";
import { useSessionVault } from "../../context/SessionVaultContext";
import { useSSE } from "../../hooks";
import type { ActivityEvent } from "../../hooks";
import { ActivityFeedPanel } from "./ActivityFeedPanel";
import { Toast } from "./Toast";
import { useToast } from "../../context/ToastContext";
import { OnboardingWizard } from "../onboarding/OnboardingWizard";
import { requiresPinSetup } from "../../utils/pin-trust";
import { API_URL } from "../../utils/api";
import { getStoredUserFromLocalStorage } from "../../utils/browser-storage";
import { useTranslation } from "react-i18next";
import { getOfflineQueue, removeQueueItem } from "../../utils/offline-db";
import { branding } from "../../config/branding";
import { mutate } from "swr";
import { WifiOff, RefreshCw } from "lucide-react";

interface DashboardLayoutProps {

  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const navigate = useTransitionNavigate();
  const location = useLocation();
  const { t } = useTranslation(["common", "drive"]);
  const { clearVault } = useSessionVault();
  const { toasts, addToast, dismissToast } = useToast();

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  // Command palette state moved to global component
  const [activityFeedOpen, setActivityFeedOpen] = useState(false);
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [queueLength, setQueueLength] = useState(0);

  // Function to refresh queue length
  const updateQueueLength = useCallback(async () => {
    try {
      const q = await getOfflineQueue();
      setQueueLength(q.length);
    } catch {
      // ignore
    }
  }, []);

  const triggerSync = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token) return;

    const performSync = async () => {
      try {
        const queue = await getOfflineQueue();
        if (queue.length === 0) return;

        setIsSyncing(true);
        
        const response = await fetch(`${API_URL}/v1/files/sync`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ actions: queue }),
        });

        if (!response.ok) {
          throw new Error("Sync API failed");
        }

        const data = await response.json();
        const results = data.results || [];
        
        let successCount = 0;
        
        for (const res of results) {
          const item = queue.find(q => q.file_id === res.file_id);
          if (!item) continue;
          
          if (res.success) {
            successCount++;
            if (item.id !== undefined) {
              await removeQueueItem(item.id);
            }
          } else if (res.conflict) {
            if (item.id !== undefined) {
              await removeQueueItem(item.id);
            }
            addToast(
              t("drive:vault.sync.conflict", { filename: res.filename || item.filename || "file" }),
              "info"
            );
          } else {
            if (item.id !== undefined) {
              await removeQueueItem(item.id);
            }
          }
        }

        if (successCount > 0) {
          addToast(t("drive:vault.sync.success", { count: successCount }), "success");
        }
        
        // Refresh files list
        mutate(`${API_URL}/files`);
        
      } catch (err) {
        console.error("Failed to sync offline actions:", err);
      } finally {
        setIsSyncing(false);
        updateQueueLength();
      }
    };

    if (navigator.locks) {
      try {
        await navigator.locks.request("vaultdrive-sync-lock", { ifAvailable: true }, async (lock) => {
          if (!lock) return; // Already running in another tab
          await performSync();
        });
      } catch {
        await performSync();
      }
    } else {
      await performSync();
    }
  }, [addToast, t, updateQueueLength]);

  useEffect(() => {
    updateQueueLength();
    
    const handleOnline = () => {
      setIsOnline(true);
      triggerSync();
    };
    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    
    const handleActionQueued = () => {
      updateQueueLength();
    };
    window.addEventListener("offline-action-queued", handleActionQueued);

    if (navigator.onLine) {
      triggerSync();
    }

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("offline-action-queued", handleActionQueued);
    };
  }, [updateQueueLength, triggerSync]);

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

  // Auto-dismiss is now handled by ToastProvider

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

      addToast(message, "info");
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
            {branding.logoVariant === "abrn" && !isOnline && (
              <div 
                data-testid="offline-badge-abrn"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-[#800020] text-white border border-white/20 shadow-sm"
              >
                <WifiOff className="w-3.5 h-3.5" />
                <span>OFFLINE</span>
                {queueLength > 0 && (
                  <span className="ml-1 bg-white text-[#800020] px-1.5 py-0.5 rounded-full text-[10px] font-bold">
                    {queueLength}
                  </span>
                )}
              </div>
            )}
            {branding.logoVariant === "abrn" && isOnline && isSyncing && (
              <div 
                data-testid="sync-badge-abrn"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-white text-[#800020] border border-[#800020]/20 shadow-sm"
              >
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>SYNCING</span>
              </div>
            )}

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

            <LanguageToggle />

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
              <DropdownMenuContent
                align="end"
                className={cn(
                  "w-56 backdrop-blur-2xl shadow-xl",
                  isDark
                    ? "bg-gradient-to-br from-primary to-primary/90 border-white/20 text-white"
                    : "bg-card border-border text-foreground"
                )}
              >
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

        <AnimatePresence>
          {branding.logoVariant !== "abrn" && (!isOnline || isSyncing) && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className={cn(
                "overflow-hidden border-b",
                isSyncing 
                  ? "border-amber-500/20 bg-amber-500/5 backdrop-blur-md" 
                  : "border-cyan-500/20 bg-cyan-500/5 backdrop-blur-md"
              )}
              data-testid="offline-banner-quantix"
            >
              <div className="max-w-7xl mx-auto px-4 py-2.5 sm:px-6 lg:px-8 flex items-center justify-between gap-4">
                <div className="flex items-center gap-2.5">
                  {isSyncing ? (
                    <div className="relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
                    </div>
                  ) : (
                    <div className="relative flex h-3 w-3">
                      <span className="animate-pulse absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-cyan-500"></span>
                    </div>
                  )}
                  <span className={cn(
                    "text-xs sm:text-sm font-medium",
                    isSyncing ? "text-amber-300" : "text-cyan-300"
                  )}>
                    {isSyncing 
                      ? t("drive:vault.sync.syncing") 
                      : t("drive:vault.sync.offline")
                    }
                  </span>
                </div>
                {queueLength > 0 && (
                  <div className={cn(
                    "text-xs px-2 py-0.5 rounded-full font-bold shadow-sm",
                    isSyncing ? "bg-amber-500/20 text-amber-300" : "bg-cyan-500/20 text-cyan-300"
                  )}>
                    {queueLength} {queueLength === 1 ? "change pending" : "changes pending"}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

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
        onDismiss={dismissToast}
      />
    </div>
  );
}

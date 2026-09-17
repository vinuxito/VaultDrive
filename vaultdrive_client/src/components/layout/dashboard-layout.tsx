import { useState, useRef, type ReactNode, useEffect, useCallback } from "react";
import { Menu, Search, Bell, Command } from "lucide-react";
import { Sidebar, type SidebarMode } from "./sidebar";
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
import { useLogout, useTransitionNavigate } from "../../hooks";
import { motion, AnimatePresence } from "framer-motion";
// Local command palette removed to use global one
import { PoweredByBadge } from "../branding";
import { cn } from "../../lib/utils";
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
import { getOfflineQueue, removeQueueItem, updateQueueItem, type OfflineAction } from "../../utils/offline-db";
import { chunkOfflineActions, classifyOfflineActions, matchOfflineSyncResults } from "../../utils/offline-sync";
import { OfflineQueueReview } from "../offline/OfflineQueueReview";
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
  const logout = useLogout();
  const { toasts, addToast, dismissToast } = useToast();
  const user = getStoredUserFromLocalStorage() ?? {};
  const currentOwnerId = typeof user.id === "string" ? user.id : null;

  const [sidebarMode, setSidebarMode] = useState<SidebarMode>(() => {
    const saved = localStorage.getItem("abrndrive_sidebar_mode");
    return (saved === "expanded" || saved === "compact" || saved === "hidden") ? saved : "expanded";
  });

  const toggleSidebarMode = useCallback(() => {
    setSidebarMode((prev) => {
      const next: SidebarMode = prev === "expanded" ? "compact" : prev === "compact" ? "hidden" : "expanded";
      localStorage.setItem("abrndrive_sidebar_mode", next);
      return next;
    });
  }, []);

  // Keyboard shortcut: ⌘B / Ctrl+B to toggle sidebar visibility
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "b") {
        const activeEl = document.activeElement;
        if (activeEl && (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA" || (activeEl as HTMLElement).isContentEditable)) {
          return;
        }
        e.preventDefault();
        setSidebarMode((prev) => {
          const next: SidebarMode = prev === "hidden" ? "expanded" : "hidden";
          localStorage.setItem("abrndrive_sidebar_mode", next);
          return next;
        });
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const [showMobileMenu, setShowMobileMenu] = useState(false);
  // Command palette state moved to global component
  const [activityFeedOpen, setActivityFeedOpen] = useState(false);
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [queueItems, setQueueItems] = useState<OfflineAction[]>([]);
  const [showOfflineReview, setShowOfflineReview] = useState(false);
  const syncInFlightRef = useRef(false);
  const queueLength = queueItems.length;

  // Function to refresh queue length
  const refreshQueue = useCallback(async () => {
    try {
      const q = await getOfflineQueue();
      setQueueItems(q);
    } catch {
      // ignore
    }
  }, []);

  const triggerSync = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token || !currentOwnerId || syncInFlightRef.current) return;

    const performSync = async () => {
      syncInFlightRef.current = true;
      try {
        const queue = await getOfflineQueue();
        const { ready } = classifyOfflineActions(queue, currentOwnerId);
        if (ready.length === 0) return;

        setIsSyncing(true);
        let successCount = 0;

        for (const chunk of chunkOfflineActions(ready)) {
          const attemptedAt = new Date().toISOString();
          await Promise.all(chunk.map((item) => updateQueueItem(item.id, {
            status: "unknown",
            last_error: "Waiting for server confirmation.",
            last_attempt_at: attemptedAt,
          })));
          await refreshQueue();

          const response = await fetch(`${API_URL}/v1/files/sync`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ actions: chunk }),
          });
          if (!response.ok) throw new Error(`Sync API failed (${response.status})`);

          const data = await response.json() as { results?: unknown };
          if (!Array.isArray(data.results)) throw new Error("Sync response did not include confirmed results");
          const outcomes = matchOfflineSyncResults(chunk, data.results);
          for (const outcome of outcomes) {
            if (outcome.kind === "remove") {
              successCount++;
              await removeQueueItem(outcome.id);
            } else {
              await updateQueueItem(outcome.id, {
                status: outcome.kind,
                last_error: outcome.error,
                last_attempt_at: attemptedAt,
              });
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
        addToast("Some offline changes need review because the server did not confirm them.", "info");
      } finally {
        setIsSyncing(false);
        syncInFlightRef.current = false;
        refreshQueue();
      }
    };

    if (navigator.locks) {
      try {
        await navigator.locks.request("vaultdrive-sync-lock", { ifAvailable: true }, async (lock) => {
          if (!lock) return; // Already running in another tab
          await performSync();
        });
      } catch (error) {
        console.error("Could not acquire the offline sync lock:", error);
        addToast("Offline changes were held because a safe sync lock was unavailable.", "info");
      }
    } else {
      await performSync();
    }
  }, [addToast, currentOwnerId, refreshQueue, t]);

  const retryOfflineAction = useCallback(async (item: OfflineAction) => {
    if (!item.id || item.owner_id !== currentOwnerId || !item.action_id) return;
    await updateQueueItem(item.id, { status: "pending", last_error: undefined, last_attempt_at: item.last_attempt_at });
    await refreshQueue();
    await triggerSync();
  }, [currentOwnerId, refreshQueue, triggerSync]);

  const discardOfflineAction = useCallback(async (item: OfflineAction) => {
    if (!item.id) return;
    await removeQueueItem(item.id);
    await refreshQueue();
  }, [refreshQueue]);

  const reconcileOfflineRename = useCallback(async (item: OfflineAction) => {
    if (!item.id || item.type !== "rename" || item.owner_id !== currentOwnerId) return;
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_URL}/files`, { headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) throw new Error("Could not inspect the current file list");
      const files = await response.json() as Array<{ id?: string; filename?: string; parent_hash?: string }>;
      const serverFile = files.find((file) => file.id === item.file_id);
      const matches = Boolean(serverFile
        && serverFile.filename === item.new_filename
        && (!item.new_hash || serverFile.parent_hash === item.new_hash));
      if (matches) {
        await removeQueueItem(item.id);
        addToast(`Confirmed rename to ${item.new_filename}.`, "success");
      } else {
        await updateQueueItem(item.id, {
          status: "failed",
          last_error: "The server file does not match the queued rename. Review it before retrying.",
          last_attempt_at: item.last_attempt_at,
        });
      }
    } catch (error) {
      await updateQueueItem(item.id, {
        status: "unknown",
        last_error: error instanceof Error ? error.message : "Could not inspect the server file.",
        last_attempt_at: item.last_attempt_at,
      });
    } finally {
      await refreshQueue();
    }
  }, [addToast, currentOwnerId, refreshQueue]);

  useEffect(() => {
    refreshQueue();
    
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
      refreshQueue();
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
  }, [refreshQueue, triggerSync]);

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

  const activityConnection = useSSE((event) => {
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
        mode={sidebarMode}
        collapsed={sidebarMode !== "expanded"}
      />

      {sidebarMode === "hidden" && (
        <div
          role="button"
          tabIndex={0}
          onClick={() => {
            setSidebarMode("expanded");
            localStorage.setItem("abrndrive_sidebar_mode", "expanded");
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              setSidebarMode("expanded");
              localStorage.setItem("abrndrive_sidebar_mode", "expanded");
            }
          }}
          className="fixed inset-y-0 left-0 w-2 z-40 hover:bg-primary/30 transition-colors cursor-pointer hidden md:block group"
          title="Click to restore sidebar (⌘B)"
          aria-label="Restore sidebar"
        >
          <div className="h-full w-full opacity-0 group-hover:opacity-100 bg-primary/40 transition-opacity" />
        </div>
      )}

      <MobileNav isOpen={showMobileMenu} onClose={() => setShowMobileMenu(false)} />

      <main className={cn(
        "flex-1 flex flex-col min-w-0 transition-all duration-300 ease-in-out pb-16 md:pb-0",
        sidebarMode === "expanded" ? "md:ml-64" : sidebarMode === "compact" ? "md:ml-[68px]" : "md:ml-0"
      )}>
        <header className="sticky top-0 z-30 lux-navbar px-2 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-1 sm:gap-3 shadow-sm shadow-primary/5">
          <div className="flex min-w-0 items-center gap-1 sm:gap-2">
            <button
              type="button"
              onClick={toggleSidebarMode}
              className="p-2 rounded-lg hover:bg-primary/10 transition-colors hidden md:block"
              aria-label="Toggle sidebar"
              title={`Sidebar: ${sidebarMode} (⌘B to toggle)`}
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

          <div className="ml-auto flex max-w-full flex-wrap items-center justify-end gap-1 sm:gap-3">
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
                <span className="absolute top-1.5 right-1.5 min-w-[16px] h-4 px-0.5 bg-red-700 rounded-full text-white text-[10px] font-bold flex items-center justify-center">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>

            <LanguageToggle />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" className="flex items-center gap-2" aria-label="Account menu">
                <Avatar className="w-8 h-8">
                  <AvatarImage src={typeof user.avatar_url === "string" ? user.avatar_url : undefined} />
                  <AvatarFallback className="bg-primary/20 text-foreground font-semibold">
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
                    ? "bg-card border-border text-foreground"
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
                <DropdownMenuItem onClick={logout} className="text-red-700 focus:bg-red-500/10 focus:text-red-700 dark:text-red-300 dark:focus:text-red-300">
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

        {queueLength > 0 && (
          <div className="border-b border-amber-500/20 bg-amber-500/10 px-4 py-2 text-sm text-foreground">
            <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
              <span>{queueLength} offline change{queueLength === 1 ? "" : "s"} waiting for confirmation</span>
              <button type="button" className="font-semibold text-primary hover:underline" onClick={() => setShowOfflineReview((open) => !open)}>
                {showOfflineReview ? "Hide details" : "Review changes"}
              </button>
            </div>
          </div>
        )}

        {showOfflineReview && queueLength > 0 && (
          <OfflineQueueReview
            items={queueItems}
            currentOwnerId={currentOwnerId}
            onRetry={(item) => { void retryOfflineAction(item); }}
            onDiscard={(item) => { void discardOfflineAction(item); }}
            onReconcileRename={(item) => { void reconcileOfflineRename(item); }}
          />
        )}

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
        connectionStatus={activityConnection}
      />
      <Toast
        toasts={toasts}
        onDismiss={dismissToast}
      />
    </div>
  );
}

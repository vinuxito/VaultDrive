import { useEffect, useState } from "react";
import { Command } from "cmdk";
import { useNavigate } from "react-router-dom";
import { 
  Settings, 
  Users, 
  ShieldCheck, 
  Home, 
  LogOut, 
  Search,
  FolderOpen
} from "lucide-react";
import { branding } from "../../config/branding";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "../theme-provider";
import { cn } from "../../lib/utils";

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { theme } = useTheme();
  const isDark = theme === "dark";

  // Toggle the menu when ⌘K is pressed
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const runCommand = (command: () => void) => {
    setOpen(false);
    command();
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
          {/* Backdrop with framer-motion blur fade */}
          <motion.div
            initial={{ opacity: 0, backdropFilter: "blur(0px)" }}
            animate={{ opacity: 1, backdropFilter: "blur(12px)" }}
            exit={{ opacity: 0, backdropFilter: "blur(0px)" }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/50"
            onClick={() => setOpen(false)}
          />

          {/* Command Menu Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className={cn(
              "relative z-50 w-full max-w-lg overflow-hidden rounded-2xl border shadow-2xl",
              isDark
                ? "bg-slate-900/90 border-slate-700/50 ring-1 ring-white/10"
                : "bg-card border-border ring-1 ring-black/5"
            )}
          >
            <Command
              className={cn("w-full", isDark ? "text-slate-100" : "text-foreground")}
              filter={(value, search) => {
                if (value.toLowerCase().includes(search.toLowerCase())) return 1;
                return 0;
              }}
            >
              <div className={cn("flex items-center border-b px-4 py-3", isDark ? "border-slate-700/50" : "border-border")}>
                <Search className={cn("mr-3 h-5 w-5", isDark ? "text-slate-400" : "text-muted-foreground")} />
                <Command.Input
                  autoFocus
                  placeholder={`Search ${branding.productName} or type a command...`}
                  className={cn(
                    "flex-1 bg-transparent text-sm outline-none",
                    isDark ? "placeholder:text-slate-400 text-white" : "placeholder:text-muted-foreground text-foreground"
                  )}
                />
                <span className="ml-2 text-xs text-muted-foreground font-mono">ESC</span>
              </div>

              <Command.List className={cn("max-h-[300px] overflow-y-auto p-2 scrollbar-thin", isDark ? "scrollbar-thumb-slate-700" : "scrollbar-thumb-slate-300")}>
                <Command.Empty className={cn("py-6 text-center text-sm", isDark ? "text-slate-400" : "text-muted-foreground")}>
                  No results found.
                </Command.Empty>

                <Command.Group heading="Navigation" className={cn("px-2 text-xs font-medium py-2", isDark ? "text-slate-400" : "text-muted-foreground")}>
                  <Command.Item
                    onSelect={() => runCommand(() => navigate("/dashboard"))}
                    className={cn(
                      "flex cursor-pointer items-center rounded-lg px-2 py-2.5 text-sm transition-colors",
                      isDark 
                        ? "text-slate-200 hover:bg-indigo-500/20 aria-selected:bg-indigo-500/20" 
                        : "text-foreground hover:bg-muted aria-selected:bg-muted"
                    )}
                  >
                    <Home className={cn("mr-3 h-4 w-4", isDark ? "text-indigo-400" : "text-primary")} />
                    Dashboard
                  </Command.Item>
                  <Command.Item
                    onSelect={() => runCommand(() => navigate("/files"))}
                    className={cn(
                      "flex cursor-pointer items-center rounded-lg px-2 py-2.5 text-sm transition-colors",
                      isDark 
                        ? "text-slate-200 hover:bg-indigo-500/20 aria-selected:bg-indigo-500/20" 
                        : "text-foreground hover:bg-muted aria-selected:bg-muted"
                    )}
                  >
                    <FolderOpen className={cn("mr-3 h-4 w-4", isDark ? "text-indigo-400" : "text-primary")} />
                    My Vault
                  </Command.Item>
                  <Command.Item
                    onSelect={() => runCommand(() => navigate("/groups"))}
                    className={cn(
                      "flex cursor-pointer items-center rounded-lg px-2 py-2.5 text-sm transition-colors",
                      isDark 
                        ? "text-slate-200 hover:bg-indigo-500/20 aria-selected:bg-indigo-500/20" 
                        : "text-foreground hover:bg-muted aria-selected:bg-muted"
                    )}
                  >
                    <Users className={cn("mr-3 h-4 w-4", isDark ? "text-indigo-400" : "text-primary")} />
                    Groups & Teams
                  </Command.Item>
                </Command.Group>

                <Command.Group heading="Account" className={cn("px-2 text-xs font-medium py-2", isDark ? "text-slate-400" : "text-muted-foreground")}>
                  <Command.Item
                    onSelect={() => runCommand(() => navigate("/settings"))}
                    className={cn(
                      "flex cursor-pointer items-center rounded-lg px-2 py-2.5 text-sm transition-colors",
                      isDark 
                        ? "text-slate-200 hover:bg-indigo-500/20 aria-selected:bg-indigo-500/20" 
                        : "text-foreground hover:bg-muted aria-selected:bg-muted"
                    )}
                  >
                    <Settings className={cn("mr-3 h-4 w-4", isDark ? "text-indigo-400" : "text-primary")} />
                    Settings
                  </Command.Item>
                  <Command.Item
                    onSelect={() => runCommand(() => navigate("/access-center"))}
                    className={cn(
                      "flex cursor-pointer items-center rounded-lg px-2 py-2.5 text-sm transition-colors",
                      isDark 
                        ? "text-slate-200 hover:bg-indigo-500/20 aria-selected:bg-indigo-500/20" 
                        : "text-foreground hover:bg-muted aria-selected:bg-muted"
                    )}
                  >
                    <ShieldCheck className={cn("mr-3 h-4 w-4", isDark ? "text-indigo-400" : "text-primary")} />
                    Privacy & Access Center
                  </Command.Item>
                  <Command.Item
                    onSelect={() => {
                      runCommand(() => {
                        localStorage.removeItem("token");
                        window.location.href = "/login";
                      });
                    }}
                    className={cn(
                      "flex cursor-pointer items-center rounded-lg px-2 py-2.5 text-sm transition-colors text-red-500 hover:bg-red-500/10 aria-selected:bg-red-500/10",
                      isDark ? "text-red-400 hover:bg-red-500/20 aria-selected:bg-red-500/20" : ""
                    )}
                  >
                    <LogOut className="mr-3 h-4 w-4" />
                    Sign Out
                  </Command.Item>
                </Command.Group>
              </Command.List>
            </Command>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

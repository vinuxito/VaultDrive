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

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

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
            className="relative z-50 w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-card shadow-2xl ring-1 ring-black/5"
          >
            <Command
              className="w-full text-foreground"
              filter={(value, search) => {
                if (value.toLowerCase().includes(search.toLowerCase())) return 1;
                return 0;
              }}
            >
              <div className="flex items-center border-b border-border px-4 py-3">
                <Search className="mr-3 h-5 w-5 text-muted-foreground" />
                <Command.Input
                  autoFocus
                  placeholder={`Search ${branding.productName} or type a command...`}
                  className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground text-foreground"
                />
                <span className="ml-2 text-xs text-muted-foreground font-mono">ESC</span>
              </div>

              <Command.List className="max-h-[300px] overflow-y-auto p-2 scrollable-panel">
                <Command.Empty className="py-6 text-center text-sm text-muted-foreground">
                  No results found.
                </Command.Empty>

                <Command.Group heading="Navigation" className="px-2 text-xs font-medium py-2 text-muted-foreground">
                  <Command.Item
                    onSelect={() => runCommand(() => navigate("/dashboard"))}
                    className="flex cursor-pointer items-center rounded-lg px-2 py-2.5 text-sm transition-colors text-foreground hover:bg-muted aria-selected:bg-muted"
                  >
                    <Home className="mr-3 h-4 w-4 text-primary" />
                    Dashboard
                  </Command.Item>
                  <Command.Item
                    onSelect={() => runCommand(() => navigate("/files"))}
                    className="flex cursor-pointer items-center rounded-lg px-2 py-2.5 text-sm transition-colors text-foreground hover:bg-muted aria-selected:bg-muted"
                  >
                    <FolderOpen className="mr-3 h-4 w-4 text-primary" />
                    My Vault
                  </Command.Item>
                  <Command.Item
                    onSelect={() => runCommand(() => navigate("/groups"))}
                    className="flex cursor-pointer items-center rounded-lg px-2 py-2.5 text-sm transition-colors text-foreground hover:bg-muted aria-selected:bg-muted"
                  >
                    <Users className="mr-3 h-4 w-4 text-primary" />
                    Groups & Teams
                  </Command.Item>
                </Command.Group>

                <Command.Group heading="Account" className="px-2 text-xs font-medium py-2 text-muted-foreground">
                  <Command.Item
                    onSelect={() => runCommand(() => navigate("/settings"))}
                    className="flex cursor-pointer items-center rounded-lg px-2 py-2.5 text-sm transition-colors text-foreground hover:bg-muted aria-selected:bg-muted"
                  >
                    <Settings className="mr-3 h-4 w-4 text-primary" />
                    Settings
                  </Command.Item>
                  <Command.Item
                    onSelect={() => runCommand(() => navigate("/access-center"))}
                    className="flex cursor-pointer items-center rounded-lg px-2 py-2.5 text-sm transition-colors text-foreground hover:bg-muted aria-selected:bg-muted"
                  >
                    <ShieldCheck className="mr-3 h-4 w-4 text-primary" />
                    Privacy & Access Center
                  </Command.Item>
                  <Command.Item
                    onSelect={() => {
                      runCommand(() => {
                        localStorage.removeItem("token");
                        window.location.href = "/login";
                      });
                    }}
                    className="flex cursor-pointer items-center rounded-lg px-2 py-2.5 text-sm transition-colors text-red-500 hover:bg-red-500/10 aria-selected:bg-red-500/10"
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

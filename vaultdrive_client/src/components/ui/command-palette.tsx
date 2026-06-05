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
            className="fixed inset-0 bg-slate-900/40"
            onClick={() => setOpen(false)}
          />

          {/* Command Menu Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="relative z-50 w-full max-w-lg overflow-hidden rounded-2xl bg-slate-900/90 border border-slate-700/50 shadow-2xl ring-1 ring-white/10"
          >
            <Command
              className="w-full text-slate-100"
              filter={(value, search) => {
                if (value.toLowerCase().includes(search.toLowerCase())) return 1;
                return 0;
              }}
            >
              <div className="flex items-center border-b border-slate-700/50 px-4 py-3">
                <Search className="mr-3 h-5 w-5 text-slate-400" />
                <Command.Input
                  autoFocus
                  placeholder={`Search ${branding.productName} or type a command...`}
                  className="flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
                />
                <span className="ml-2 text-xs text-slate-500 font-mono">ESC</span>
              </div>

              <Command.List className="max-h-[300px] overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-slate-700">
                <Command.Empty className="py-6 text-center text-sm text-slate-400">
                  No results found.
                </Command.Empty>

                <Command.Group heading="Navigation" className="px-2 text-xs font-medium text-slate-400 py-2">
                  <Command.Item
                    onSelect={() => runCommand(() => navigate("/dashboard"))}
                    className="flex cursor-pointer items-center rounded-lg px-2 py-2.5 text-sm text-slate-200 hover:bg-indigo-500/20 aria-selected:bg-indigo-500/20 transition-colors"
                  >
                    <Home className="mr-3 h-4 w-4 text-indigo-400" />
                    Dashboard
                  </Command.Item>
                  <Command.Item
                    onSelect={() => runCommand(() => navigate("/files"))}
                    className="flex cursor-pointer items-center rounded-lg px-2 py-2.5 text-sm text-slate-200 hover:bg-indigo-500/20 aria-selected:bg-indigo-500/20 transition-colors"
                  >
                    <FolderOpen className="mr-3 h-4 w-4 text-indigo-400" />
                    My Vault
                  </Command.Item>
                  <Command.Item
                    onSelect={() => runCommand(() => navigate("/groups"))}
                    className="flex cursor-pointer items-center rounded-lg px-2 py-2.5 text-sm text-slate-200 hover:bg-indigo-500/20 aria-selected:bg-indigo-500/20 transition-colors"
                  >
                    <Users className="mr-3 h-4 w-4 text-indigo-400" />
                    Groups & Teams
                  </Command.Item>
                </Command.Group>

                <Command.Group heading="Account" className="px-2 text-xs font-medium text-slate-400 py-2">
                  <Command.Item
                    onSelect={() => runCommand(() => navigate("/settings"))}
                    className="flex cursor-pointer items-center rounded-lg px-2 py-2.5 text-sm text-slate-200 hover:bg-indigo-500/20 aria-selected:bg-indigo-500/20 transition-colors"
                  >
                    <Settings className="mr-3 h-4 w-4 text-indigo-400" />
                    Settings
                  </Command.Item>
                  <Command.Item
                    onSelect={() => runCommand(() => navigate("/access-center"))}
                    className="flex cursor-pointer items-center rounded-lg px-2 py-2.5 text-sm text-slate-200 hover:bg-indigo-500/20 aria-selected:bg-indigo-500/20 transition-colors"
                  >
                    <ShieldCheck className="mr-3 h-4 w-4 text-indigo-400" />
                    Privacy & Access Center
                  </Command.Item>
                  <Command.Item
                    onSelect={() => {
                      runCommand(() => {
                        localStorage.removeItem("token");
                        window.location.href = "/login";
                      });
                    }}
                    className="flex cursor-pointer items-center rounded-lg px-2 py-2.5 text-sm text-red-400 hover:bg-red-500/20 aria-selected:bg-red-500/20 transition-colors"
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

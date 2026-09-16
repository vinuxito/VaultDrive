import { useCallback, useEffect, useRef, useState } from "react";
import { Command } from "cmdk";
import { useNavigate } from "react-router-dom";
import { 
  Settings, 
  Users, 
  ShieldCheck, 
  Home, 
  LogOut, 
  Search,
  FolderOpen,
  File,
  FileText,
  Image as ImageIcon,
  Film,
  Archive,
  Share2,
  User,
  HelpCircle,
} from "lucide-react";
import { branding } from "../../config/branding";
import { motion, AnimatePresence } from "framer-motion";
import { useFileSearch } from "../../hooks/useFileSearch";
import { useLogout } from "../../hooks/useLogout";
import { useDialogFocus } from "../../hooks/useDialogFocus";
import { useTranslation } from "react-i18next";
import { getStoredUserFromLocalStorage } from "../../utils/browser-storage";

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const dialogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const logout = useLogout();
  const { t } = useTranslation(["common"]);
  const fileResults = useFileSearch(inputValue);
  const [authenticated, setAuthenticated] = useState(() => Boolean(localStorage.getItem("token")));
  const isAdmin = getStoredUserFromLocalStorage()?.is_admin === true;

  const closePalette = useCallback(() => {
    setOpen(false);
  }, []);
  useDialogFocus({ open, onClose: closePalette, containerRef: dialogRef, initialFocusRef: inputRef });

  // Toggle the menu when ⌘K is pressed
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        if (!authenticated) return;
        if (open) {
          closePalette();
        } else {
          setOpen(true);
        }
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [authenticated, closePalette, open]);

  useEffect(() => {
    const refreshAuthentication = () => {
      const nextAuthenticated = Boolean(localStorage.getItem("token"));
      setAuthenticated(nextAuthenticated);
      if (!nextAuthenticated) setOpen(false);
    };
    window.addEventListener("auth-change", refreshAuthentication);
    window.addEventListener("storage", refreshAuthentication);
    return () => {
      window.removeEventListener("auth-change", refreshAuthentication);
      window.removeEventListener("storage", refreshAuthentication);
    };
  }, []);

  const runCommand = (command: () => void) => {
    setInputValue("");
    closePalette();
    command();
  };


  return (
    <AnimatePresence>
      {authenticated && open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-2 pt-[min(15vh,5rem)] sm:p-4 sm:pt-[15vh]">
          {/* Backdrop with framer-motion blur fade */}
          <motion.div
            initial={{ opacity: 0, backdropFilter: "blur(0px)" }}
            animate={{ opacity: 1, backdropFilter: "blur(12px)" }}
            exit={{ opacity: 0, backdropFilter: "blur(0px)" }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/50"
            onClick={closePalette}
            aria-hidden="true"
          />

          {/* Command Menu Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="relative z-50 flex max-h-[calc(100dvh-1rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl ring-1 ring-black/5 sm:max-h-[70dvh]"
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label={t("common:commandPalette.label")}
            tabIndex={-1}
          >
            <Command
              label={t("common:commandPalette.label")}
              className="flex min-h-0 w-full flex-col text-foreground"
              filter={(value, search) => {
                if (value.toLowerCase().includes(search.toLowerCase())) return 1;
                return 0;
              }}
            >
              <div className="flex items-center border-b border-border px-4 py-3">
                <Search className="mr-3 h-5 w-5 text-muted-foreground" />
                <Command.Input
                  ref={inputRef}
                  value={inputValue}
                  onValueChange={setInputValue}
                  placeholder={t("common:commandPalette.placeholder", { product: branding.productName })}
                  className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground text-foreground"
                />
                <span className="ml-2 text-xs text-muted-foreground font-mono">ESC</span>
              </div>

              <Command.List className="min-h-0 flex-1 overflow-y-auto p-2 scrollable-panel">
                <Command.Empty className="py-6 text-center text-sm text-muted-foreground">
                  {t("common:commandPalette.noResults")}
                </Command.Empty>

                {fileResults.length > 0 && (
                  <Command.Group heading={t("common:commandPalette.filesGroup")} className="px-2 text-xs font-medium py-2 text-muted-foreground">
                    {fileResults.map((file) => (
                      <Command.Item
                        key={file.id}
                        value={`file-${file.id}-${file.filename}`}
                        onSelect={() => runCommand(() => navigate("/files", { state: { highlightFileId: file.id } }))}
                        className="flex cursor-pointer items-center rounded-lg px-2 py-2.5 text-sm transition-colors text-foreground hover:bg-muted aria-selected:bg-muted"
                      >
                        <FileTypeIcon filename={file.filename} className="mr-3 h-4 w-4 text-muted-foreground shrink-0" />
                        <div className="flex flex-col min-w-0">
                          <span className="font-medium truncate">{file.filename}</span>
                          {file.folder_name && (
                            <span className="text-[10px] text-muted-foreground">
                              {t("common:commandPalette.inFolder", { folder: file.folder_name })}
                            </span>
                          )}
                        </div>
                      </Command.Item>
                    ))}
                  </Command.Group>
                )}

                <Command.Group heading={t("common:commandPalette.navigationGroup")} className="px-2 text-xs font-medium py-2 text-muted-foreground">
                  <Command.Item
                    onSelect={() => runCommand(() => navigate("/dashboard"))}
                    className="flex cursor-pointer items-center rounded-lg px-2 py-2.5 text-sm transition-colors text-foreground hover:bg-muted aria-selected:bg-muted"
                  >
                    <Home className="mr-3 h-4 w-4 text-primary" />
                    {t("common:nav.dashboard")}
                  </Command.Item>
                  <Command.Item
                    onSelect={() => runCommand(() => navigate("/files"))}
                    className="flex cursor-pointer items-center rounded-lg px-2 py-2.5 text-sm transition-colors text-foreground hover:bg-muted aria-selected:bg-muted"
                  >
                    <FolderOpen className="mr-3 h-4 w-4 text-primary" />
                    {t("common:nav.files")}
                  </Command.Item>
                  <Command.Item
                    onSelect={() => runCommand(() => navigate("/groups"))}
                    className="flex cursor-pointer items-center rounded-lg px-2 py-2.5 text-sm transition-colors text-foreground hover:bg-muted aria-selected:bg-muted"
                  >
                    <Users className="mr-3 h-4 w-4 text-primary" />
                    {t("common:nav.groups")}
                  </Command.Item>
                  <Command.Item
                    onSelect={() => runCommand(() => navigate("/shared"))}
                    className="flex cursor-pointer items-center rounded-lg px-2 py-2.5 text-sm transition-colors text-foreground hover:bg-muted aria-selected:bg-muted"
                  >
                    <Share2 className="mr-3 h-4 w-4 text-primary" />
                    {t("common:nav.shared")}
                  </Command.Item>
                </Command.Group>

                <Command.Group heading={t("common:commandPalette.accountGroup")} className="px-2 text-xs font-medium py-2 text-muted-foreground">
                  <Command.Item
                    onSelect={() => runCommand(() => navigate("/profile"))}
                    className="flex cursor-pointer items-center rounded-lg px-2 py-2.5 text-sm transition-colors text-foreground hover:bg-muted aria-selected:bg-muted"
                  >
                    <User className="mr-3 h-4 w-4 text-primary" />
                    {t("common:nav.profile")}
                  </Command.Item>
                  <Command.Item
                    onSelect={() => runCommand(() => navigate("/settings"))}
                    className="flex cursor-pointer items-center rounded-lg px-2 py-2.5 text-sm transition-colors text-foreground hover:bg-muted aria-selected:bg-muted"
                  >
                    <Settings className="mr-3 h-4 w-4 text-primary" />
                    {t("common:nav.settings")}
                  </Command.Item>
                  <Command.Item
                    onSelect={() => runCommand(() => navigate("/access-center"))}
                    className="flex cursor-pointer items-center rounded-lg px-2 py-2.5 text-sm transition-colors text-foreground hover:bg-muted aria-selected:bg-muted"
                  >
                    <ShieldCheck className="mr-3 h-4 w-4 text-primary" />
                    {t("common:nav.accessCenter")}
                  </Command.Item>
                  <Command.Item
                    onSelect={() => runCommand(() => navigate("/help"))}
                    className="flex cursor-pointer items-center rounded-lg px-2 py-2.5 text-sm transition-colors text-foreground hover:bg-muted aria-selected:bg-muted"
                  >
                    <HelpCircle className="mr-3 h-4 w-4 text-primary" />
                    {t("common:nav.help")}
                  </Command.Item>
                  {isAdmin && (
                    <Command.Item
                      onSelect={() => runCommand(() => navigate("/admin"))}
                      className="flex cursor-pointer items-center rounded-lg px-2 py-2.5 text-sm transition-colors text-foreground hover:bg-muted aria-selected:bg-muted"
                    >
                      <ShieldCheck className="mr-3 h-4 w-4 text-primary" />
                      {t("common:nav.admin")}
                    </Command.Item>
                  )}
                  <Command.Item
                    onSelect={() => {
                      runCommand(logout);
                    }}
                    className="flex cursor-pointer items-center rounded-lg px-2 py-2.5 text-sm transition-colors text-red-500 hover:bg-red-500/10 aria-selected:bg-red-500/10"
                  >
                    <LogOut className="mr-3 h-4 w-4" />
                    {t("common:nav.logout")}
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

function FileTypeIcon({ filename, className }: { filename: string; className?: string }) {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  if (["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext))
    return <ImageIcon className={className} />;
  if (["mp4", "mov", "avi", "mkv"].includes(ext))
    return <Film className={className} />;
  if (["pdf", "doc", "docx", "txt", "md"].includes(ext))
    return <FileText className={className} />;
  if (["zip", "tar", "gz", "rar"].includes(ext))
    return <Archive className={className} />;
  return <File className={className} />;
}

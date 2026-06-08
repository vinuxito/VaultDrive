import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { X, Folder, Loader2, AlertCircle } from "lucide-react";
import { useTheme } from "../theme-provider";
import { cn } from "../../lib/utils";

interface FolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (name: string) => Promise<void>;
  mode: "create" | "rename";
  initialName?: string;
  parentFolderName?: string;
}

export default function FolderModal({
  isOpen,
  onClose,
  onSubmit,
  mode,
  initialName = "",
  parentFolderName,
}: FolderModalProps) {
  const [name, setName] = useState(initialName);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { theme } = useTheme();
  const isDark = theme === "dark";

  useEffect(() => {
    if (isOpen) {
      setName(initialName);
      setError("");
    }
  }, [isOpen, initialName]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      setError("Folder name cannot be empty");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await onSubmit(name.trim());
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onClose();
    }
  };

  const getTitle = () => {
    if (mode === "rename") {
      return "Rename Folder";
    }
    if (parentFolderName) {
      return `Create Subfolder in "${parentFolderName}"`;
    }
    return "Create Root Folder";
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className={cn(
              "w-full max-w-md mx-4 rounded-2xl shadow-2xl border",
              isDark
                ? "bg-gradient-to-br from-primary to-primary/90 border-white/10 text-white"
                : "bg-card border-border text-foreground"
            )}
          >
            <div className={cn("flex items-center justify-between p-4 border-b", isDark ? "border-white/10" : "border-border")}>
              <div className="flex items-center gap-2">
                <Folder className={cn("h-5 w-5", isDark ? "text-primary-foreground" : "text-primary")} />
                <h2 className={cn("text-xl font-semibold", isDark ? "text-white" : "text-foreground")}>{getTitle()}</h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className={cn(
                  "transition-colors",
                  isDark ? "text-white/80 hover:text-white" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4">
              <div className="space-y-4">
                <div>
                  <label htmlFor="folder-name" className={cn("block text-sm font-medium mb-2", isDark ? "text-white" : "text-foreground")}>
                    Folder Name
                  </label>
                  <Input
                    id="folder-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={loading}
                    autoFocus
                    placeholder="Enter folder name"
                    className={cn(
                      isDark
                        ? "bg-white/15 border-white/20 text-white placeholder-white/60 focus:border-white/40 focus:bg-white/20"
                        : "bg-muted border-border text-foreground placeholder-muted-foreground focus:border-primary focus:bg-background"
                    )}
                  />
                </div>

                {error && (
                  <div className={cn(
                    "flex items-start gap-2 p-3 border rounded-lg",
                    isDark
                      ? "bg-primary/20 border-primary/30"
                      : "bg-destructive/10 border-destructive/20 text-destructive"
                  )}>
                    <AlertCircle className={cn("h-5 w-5 flex-shrink-0 mt-0.5", isDark ? "text-primary/60" : "text-destructive")} />
                    <p className="text-sm">{error}</p>
                  </div>
                )}

                <div className="flex gap-2 justify-end pt-2">
                  <Button
                    type="button"
                    variant="modal-cancel"
                    onClick={onClose}
                    disabled={loading}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={loading}
                    className="bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] hover:bg-[hsl(var(--primary))/0.9] font-semibold"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        {mode === "create" ? "Creating..." : "Renaming..."}
                      </>
                    ) : (
                      mode === "create" ? "Create" : "Rename"
                    )}
                  </Button>
                </div>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

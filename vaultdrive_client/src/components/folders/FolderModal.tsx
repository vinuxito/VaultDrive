import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { X, Folder, Loader2, AlertCircle } from "lucide-react";
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className={cn(
              "w-full max-w-md rounded-2xl shadow-2xl border max-h-[calc(100dvh-2rem)] overflow-y-auto",
              "bg-card border-border text-foreground"
            )}
          >
            <div className={cn("flex items-center justify-between p-4 border-b", "border-border")}>
              <div className="flex items-center gap-2">
                <Folder className={cn("h-5 w-5", "text-primary")} />
                <h2 className={cn("text-xl font-semibold", "text-foreground")}>{getTitle()}</h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className={cn(
                  "transition-colors",
                  "text-muted-foreground hover:text-foreground"
                )}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4">
              <div className="space-y-4">
                <div>
                  <label htmlFor="folder-name" className={cn("block text-sm font-medium mb-2", "text-foreground")}>
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
                      "bg-muted border-border text-foreground placeholder-muted-foreground focus:border-primary focus:bg-background"
                    )}
                  />
                </div>

                {error && (
                  <div className={cn(
                    "flex items-start gap-2 p-3 border rounded-lg",
                    "bg-destructive/10 border-destructive/20 text-destructive"
                  )}>
                    <AlertCircle className={cn("h-5 w-5 flex-shrink-0 mt-0.5", "text-destructive")} />
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
                    className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold"
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

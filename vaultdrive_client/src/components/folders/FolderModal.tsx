import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { X, Folder, Loader2, AlertCircle } from "lucide-react";

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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-gradient-to-br from-[#7d4f50] to-[#6b4345] border border-white/10 rounded-2xl shadow-2xl w-full max-w-md mx-4"
          >
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Folder className="h-5 w-5 text-[#f2d7d8]" />
                <h2 className="text-xl font-semibold text-white">{getTitle()}</h2>
              </div>
              <button
                onClick={onClose}
                disabled={loading}
                className="text-white/70 hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-white/90 mb-2">
                    Folder Name
                  </label>
                  <Input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={loading}
                    autoFocus
                    placeholder="Enter folder name"
                    className="bg-white/10 border-white/20 text-white placeholder-white/50 focus:border-white/40 focus:bg-white/15"
                  />
                </div>

                {error && (
                  <div className="flex items-start gap-2 p-3 bg-[#6b4345]/30 border border-[#d4a5a6]/40 rounded-lg">
                    <AlertCircle className="h-5 w-5 text-[#d4a5a6] flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-[#f2d7d8]">{error}</p>
                  </div>
                )}

                <div className="flex gap-2 justify-end pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={onClose}
                    disabled={loading}
                    className="border-2 border-white/40 text-white hover:bg-white/10 bg-transparent"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={loading}
                    className="bg-white text-[#7d4f50] hover:bg-[#f2d7d8] font-semibold"
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

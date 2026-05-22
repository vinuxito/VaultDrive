import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "../ui/button";
import { X, Trash2, Loader2, AlertTriangle } from "lucide-react";

interface DeleteFolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  folderName: string;
  hasSubfolders: boolean;
}

export default function DeleteFolderModal({
  isOpen,
  onClose,
  onConfirm,
  folderName,
  hasSubfolders,
}: DeleteFolderModalProps) {
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm();
      onClose();
    } catch (error) {
      console.error("Error deleting folder:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-gradient-to-br from-primary to-primary/90 border border-white/10 rounded-2xl shadow-2xl w-full max-w-md mx-4"
          >
            {/* Header with red accent for delete action */}
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Trash2 className="h-5 w-5 text-destructive" />
                <h2 className="text-xl font-semibold text-white">Delete Folder</h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="text-white/70 hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-4">
              <div className="space-y-4">
                <p className="text-white">
                  Are you sure you want to delete the folder{" "}
                  <span className="font-semibold text-primary-foreground">"{folderName}"</span>?
                </p>

                {hasSubfolders && (
                  <div className="flex items-start gap-2 p-3 bg-primary/20 border border-primary/30 rounded-lg">
                    <AlertTriangle className="h-5 w-5 text-primary/60 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-primary-foreground">
                      <p className="font-semibold mb-1">Warning</p>
                      <p>
                        This folder contains subfolders. All subfolders and their contents
                        will be permanently deleted.
                      </p>
                    </div>
                  </div>
                )}

                <p className="text-sm text-white/70">
                  This action cannot be undone.
                </p>

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
                    type="button"
                    onClick={handleConfirm}
                    disabled={loading}
                    className="bg-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive))/0.9] text-white border-0"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Deleting...
                      </>
                    ) : (
                      "Delete Folder"
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

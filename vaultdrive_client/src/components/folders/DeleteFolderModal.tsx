import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "../ui/button";
import { X, Trash2, Loader2, AlertTriangle } from "lucide-react";
import { cn } from "../../lib/utils";

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
            className={cn(
              "w-full max-w-md mx-4 rounded-2xl shadow-2xl border",
              "bg-card border-border text-foreground"
            )}
          >
            {/* Header with red accent for delete action */}
            <div className={cn("flex items-center justify-between p-4 border-b", "border-border")}>
              <div className="flex items-center gap-2">
                <Trash2 className="h-5 w-5 text-destructive" />
                <h2 className={cn("text-xl font-semibold", "text-foreground")}>Mover carpeta a la Papelera</h2>
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

            <div className="p-4">
              <div className="space-y-4">
                <p className={"text-foreground"}>
                  ¿Quieres mover la carpeta{" "}
                  <span className={cn("font-semibold", "text-foreground")}>"{folderName}"</span> a la Papelera?
                </p>

                {hasSubfolders && (
                  <div className={cn(
                    "flex items-start gap-2 p-3 border rounded-lg",
                    "bg-amber-500/10 border-amber-500/30 text-foreground"
                  )}>
                    <AlertTriangle className={cn("h-5 w-5 flex-shrink-0 mt-0.5", "text-amber-500")} />
                    <div className="text-sm">
                      <p className="font-semibold mb-1">Incluye subcarpetas</p>
                      <p>
                        Esta carpeta y todo lo que contiene pasarán juntos a tu Papelera recuperable.
                      </p>
                    </div>
                  </div>
                )}

                <p className={cn("text-sm", "text-muted-foreground")}>
                  Podrás restaurarla cuando quieras desde Papelera. Solo tú puedes vaciarla para siempre.
                </p>

                <div className="flex gap-2 justify-end pt-2">
                  <Button
                    type="button"
                    variant="modal-cancel"
                    onClick={onClose}
                    disabled={loading}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="button"
                    onClick={handleConfirm}
                    disabled={loading}
                    className="bg-destructive hover:bg-destructive/90 text-destructive-foreground border-0"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Moviendo...
                      </>
                    ) : (
                      "Mover a Papelera"
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

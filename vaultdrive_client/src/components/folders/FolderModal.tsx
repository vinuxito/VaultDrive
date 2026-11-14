import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { X, Folder, Loader2, AlertCircle, Check } from "lucide-react";
import { cn } from "../../lib/utils";

export const STANDARD_ACCOUNTANT_SUBFOLDERS = [
  "01 Expediente Legal",
  "02 Constancia y 32-D",
  "03 Estados de Cuenta",
  "04 Facturas XML",
  "05 Entregables",
] as const;

interface FolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (name: string, options?: { withStandardSubfolders?: boolean }) => Promise<void>;
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
  const [withStandardSubfolders, setWithStandardSubfolders] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isOpen) {
      setName(initialName);
      setWithStandardSubfolders(!parentFolderName && mode === "create");
      setError("");
    }
  }, [isOpen, initialName, parentFolderName, mode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      setError("El nombre de la carpeta no puede estar vacío");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await onSubmit(name.trim(), {
        withStandardSubfolders: mode === "create" && !parentFolderName ? withStandardSubfolders : false,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ocurrió un error al guardar la carpeta");
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
      return "Renombrar Carpeta";
    }
    if (parentFolderName) {
      return `Nueva Subcarpeta en "${parentFolderName}"`;
    }
    return "Nueva Carpeta / Expediente ABRN";
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget && !loading) onClose();
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-xs p-4"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            style={{ borderColor: "var(--abrn-border-strong)" }}
            className={cn(
              "w-full max-w-[500px] rounded-[15px] shadow-2xl border max-h-[calc(100dvh-2rem)] overflow-hidden",
              "bg-card text-foreground"
            )}
          >
            <div
              style={{ background: "var(--abrn-bg-elevated)", borderColor: "var(--abrn-border)" }}
              className="flex items-center justify-between px-4 py-3 border-b"
            >
              <div className="flex items-center gap-2 min-w-0">
                <Folder className="h-4 w-4 text-primary shrink-0" />
                <h2 className="abrn-serif text-[15px] font-bold text-foreground truncate">{getTitle()}</h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="abrn-btn !h-7 !px-2.5 !text-[11.5px]"
              >
                <X className="h-3.5 w-3.5" />
                <span>Cerrar</span>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4 space-y-3.5">
              <div>
                <label htmlFor="folder-name" className="block text-xs font-bold mb-1.5 text-foreground">
                  {mode === "create" && !parentFolderName ? "Nombre del cliente o proyecto" : "Nombre de la carpeta"}
                </label>
                <Input
                  id="folder-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={loading}
                  autoFocus
                  placeholder="Ej. Constructora Monte Albán SA"
                  className="bg-background border-border text-foreground font-semibold focus:border-primary"
                />
              </div>

              {mode === "create" && !parentFolderName && (
                <button
                  type="button"
                  data-testid="folder-template-toggle"
                  onClick={() => setWithStandardSubfolders((prev) => !prev)}
                  style={{
                    background: withStandardSubfolders ? "var(--abrn-primary-tint)" : "var(--abrn-bg-elevated)",
                    borderColor: withStandardSubfolders ? "var(--abrn-border-strong)" : "var(--abrn-border)",
                  }}
                  className="w-full text-left p-3 rounded-[10px] border transition-colors cursor-pointer flex items-start gap-2.5"
                >
                  <span
                    style={{
                      background: withStandardSubfolders ? "var(--abrn-primary)" : "var(--abrn-bg)",
                      borderColor: "var(--abrn-border-strong)",
                      color: withStandardSubfolders ? "var(--abrn-primary-fg)" : "transparent",
                    }}
                    className="mt-0.5 w-4 h-4 rounded-[4px] border flex items-center justify-center shrink-0"
                  >
                    <Check className="w-3 h-3 stroke-[3]" />
                  </span>
                  <div className="text-[11.5px] leading-relaxed text-muted-foreground">
                    <div className="font-bold text-foreground mb-0.5">
                      Crear con las 5 subcarpetas contables estándar
                    </div>
                    <span>
                      <em>01 Expediente Legal</em> · <em>02 Constancia y 32-D</em> · <em>03 Estados de Cuenta</em> ·{" "}
                      <em>04 Facturas XML</em> · <em>05 Entregables</em>
                    </span>
                  </div>
                </button>
              )}

              {error && (
                <div className="flex items-start gap-2 p-3 border rounded-lg bg-destructive/10 border-destructive/20 text-destructive">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <p className="text-xs font-medium">{error}</p>
                </div>
              )}

              <div className="flex gap-2 justify-end pt-1">
                <Button
                  type="button"
                  variant="modal-cancel"
                  onClick={onClose}
                  disabled={loading}
                >
                  Cancelar
                </Button>
                <button
                  type="submit"
                  disabled={loading}
                  className="abrn-btn abrn-btn-primary !h-9 !px-4"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>{mode === "create" ? "Creando..." : "Guardando..."}</span>
                    </>
                  ) : mode === "create" ? (
                    !parentFolderName && withStandardSubfolders ? "Crear con 5 Subcarpetas" : "Crear Carpeta"
                  ) : (
                    "Guardar Nombre"
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

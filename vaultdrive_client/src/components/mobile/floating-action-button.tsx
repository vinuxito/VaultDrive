import { useState } from "react";
import { Plus, Upload, FolderPlus, X, Lock, Camera } from "lucide-react";
import { cn } from "../../lib/utils";
import { playDeadboltThud } from "../../utils/audioHaptics";

export interface FloatingActionButtonProps {
  onUploadClick: () => void;
  onNewFolderClick: () => void;
  onCameraClick?: () => void;
  onLockClick?: () => void;
}

export function FloatingActionButton({
  onUploadClick,
  onNewFolderClick,
  onCameraClick,
  onLockClick,
}: FloatingActionButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  const toggleOpen = () => {
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(15);
    }
    setIsOpen((prev) => !prev);
  };

  const handleUpload = () => {
    setIsOpen(false);
    onUploadClick();
  };

  const handleNewFolder = () => {
    setIsOpen(false);
    onNewFolderClick();
  };

  const handleCamera = () => {
    setIsOpen(false);
    if (onCameraClick) {
      onCameraClick();
    } else {
      (document.getElementById("camera-input") as HTMLInputElement | null)?.click();
    }
  };

  const handleLock = () => {
    setIsOpen(false);
    playDeadboltThud();
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(30);
    }
    if (onLockClick) {
      onLockClick();
    } else {
      window.dispatchEvent(new CustomEvent("vault-action", { detail: { action: "lock" } }));
    }
  };

  return (
    <div className="fixed bottom-20 right-5 z-40 md:hidden flex flex-col items-end pointer-events-auto">
      {/* Speed Dial Actions */}
      {isOpen && (
        <div className="flex flex-col items-end gap-2.5 mb-3 animate-in fade-in-0 slide-in-from-bottom-3 duration-150">
          <button
            type="button"
            onClick={handleLock}
            className="flex items-center gap-2.5 px-4 py-3 rounded-full bg-amber-500/10 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-500/30 shadow-lg active:scale-95 transition-all text-xs font-semibold cursor-pointer min-h-[48px]"
            aria-label="Bloquear Bóveda"
          >
            <Lock className="w-4 h-4 text-amber-500" />
            <span>Bloquear Bóveda</span>
          </button>

          <button
            type="button"
            onClick={handleCamera}
            className="flex items-center gap-2.5 px-4 py-3 rounded-full bg-emerald-600 text-white shadow-lg active:scale-95 transition-all text-xs font-semibold cursor-pointer min-h-[48px]"
            aria-label="Cámara Segura"
          >
            <Camera className="w-4 h-4" />
            <span>Foto Directa a Bóveda</span>
          </button>

          <button
            type="button"
            onClick={handleNewFolder}
            className="flex items-center gap-2.5 px-4 py-3 rounded-full bg-card text-card-foreground border border-border shadow-lg active:scale-95 transition-all text-xs font-medium cursor-pointer min-h-[48px]"
            aria-label="Nueva Carpeta"
          >
            <FolderPlus className="w-4 h-4 text-primary" />
            <span>Nueva Carpeta</span>
          </button>

          <button
            type="button"
            onClick={handleUpload}
            className="flex items-center gap-2.5 px-4 py-3 rounded-full bg-primary text-primary-foreground shadow-lg active:scale-95 transition-all text-xs font-semibold cursor-pointer min-h-[48px]"
            aria-label="Subir Archivo"
          >
            <Upload className="w-4 h-4" />
            <span>Subir Archivo</span>
          </button>
        </div>
      )}

      {/* Main 56px FAB trigger */}
      <button
        type="button"
        onClick={toggleOpen}
        aria-label={isOpen ? "Cerrar menú de acción" : "Crear o subir archivo"}
        aria-expanded={isOpen}
        className={cn(
          "h-14 w-14 rounded-full shadow-2xl flex items-center justify-center text-primary-foreground active:scale-95 transition-all duration-200 cursor-pointer min-h-[48px] min-w-[48px]",
          isOpen
            ? "bg-muted-foreground/80 rotate-45"
            : "bg-primary shadow-primary/40"
        )}
      >
        {isOpen ? <X className="w-6 h-6" /> : <Plus className="w-6 h-6 stroke-[2.5]" />}
      </button>
    </div>
  );
}

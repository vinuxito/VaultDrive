import { useState } from "react";
import { Plus, Upload, FolderPlus, X } from "lucide-react";
import { cn } from "../../lib/utils";

export interface FloatingActionButtonProps {
  onUploadClick: () => void;
  onNewFolderClick: () => void;
}

export function FloatingActionButton({
  onUploadClick,
  onNewFolderClick,
}: FloatingActionButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  const toggleOpen = () => {
    if (navigator.vibrate) {
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

  return (
    <div className="fixed bottom-20 right-5 z-40 md:hidden flex flex-col items-end pointer-events-auto">
      {/* Speed Dial Actions */}
      {isOpen && (
        <div className="flex flex-col items-end gap-3 mb-3 animate-in fade-in-0 slide-in-from-bottom-3 duration-150">
          <button
            type="button"
            onClick={handleNewFolder}
            className="flex items-center gap-2.5 px-4 py-2.5 rounded-full bg-card text-card-foreground border border-border shadow-lg active:scale-95 transition-all text-xs font-medium cursor-pointer"
            aria-label="Nueva Carpeta"
          >
            <FolderPlus className="w-4 h-4 text-primary" />
            <span>Nueva Carpeta</span>
          </button>

          <button
            type="button"
            onClick={handleUpload}
            className="flex items-center gap-2.5 px-4 py-2.5 rounded-full bg-primary text-primary-foreground shadow-lg active:scale-95 transition-all text-xs font-semibold cursor-pointer"
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
          "h-14 w-14 rounded-full shadow-2xl flex items-center justify-center text-primary-foreground active:scale-95 transition-all duration-200 cursor-pointer",
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

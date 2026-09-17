import React, { useEffect, useRef, useState } from "react";
import {
  Eye,
  Download,
  Share2,
  Shield,
  FolderInput,
  Star,
  Copy,
  Trash2,
  FolderPlus,
  Upload,
  RefreshCw,
  Layers,
  Edit2,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "../../lib/utils";

export type ContextTargetType = "file" | "multi-file" | "folder" | "canvas";

export interface ContextMenuState {
  isOpen: boolean;
  x: number;
  y: number;
  targetType: ContextTargetType;
  targetData?: any;
}

interface VaultContextMenuProps {
  state: ContextMenuState;
  onClose: () => void;
  onPreview?: (file: any) => void;
  onDownload?: (file: any) => void;
  onShare?: (file: any) => void;
  onPassport?: (file: any) => void;
  onMove?: (file: any) => void;
  onToggleStar?: (fileId: string) => void;
  onCopyHash?: (file: any) => void;
  onDelete?: (file: any) => void;
  onBatchDownload?: (files: any[]) => void;
  onBatchMove?: (files: any[]) => void;
  onBatchStage?: (files: any[]) => void;
  onBatchDelete?: (files: any[]) => void;
  onCreateFolder?: () => void;
  onCreateSubfolder?: (folderId: string) => void;
  onUploadHere?: (folderId?: string) => void;
  onRenameFolder?: (folderId: string, name: string) => void;
  onShareFolder?: (folderId: string, name: string) => void;
  onDeleteFolder?: (folderId: string, name: string) => void;
  onRefresh?: () => void;
}

export const VaultContextMenu: React.FC<VaultContextMenuProps> = ({
  state,
  onClose,
  onPreview,
  onDownload,
  onShare,
  onPassport,
  onMove,
  onToggleStar,
  onCopyHash,
  onDelete,
  onBatchDownload,
  onBatchMove,
  onBatchStage,
  onBatchDelete,
  onCreateFolder,
  onCreateSubfolder,
  onUploadHere,
  onRenameFolder,
  onShareFolder,
  onDeleteFolder,
  onRefresh,
}) => {
  const { t } = useTranslation(["common", "drive"]);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [coords, setCoords] = useState<{ x: number; y: number }>({ x: state.x, y: state.y });

  // Boundary clamping to keep menu inside viewport
  useEffect(() => {
    if (!state.isOpen) return;

    const MENU_WIDTH = 230;
    const MENU_HEIGHT = 320;
    const padding = 12;

    const clampedX = Math.max(padding, Math.min(state.x, Math.max(padding, window.innerWidth - MENU_WIDTH - padding)));
    const clampedY = Math.max(padding, Math.min(state.y, Math.max(padding, window.innerHeight - MENU_HEIGHT - padding)));

    setCoords({ x: clampedX, y: clampedY });
  }, [state.isOpen, state.x, state.y]);

  // Click outside and escape dismissal
  useEffect(() => {
    if (!state.isOpen) return;

    const handlePointerDown = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [state.isOpen, onClose]);

  if (!state.isOpen) return null;

  const { targetType, targetData } = state;

  const MenuItem = ({
    icon: Icon,
    label,
    shortcut,
    onClick,
    destructive = false,
  }: {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    shortcut?: string;
    onClick: () => void;
    destructive?: boolean;
  }) => (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
        onClose();
      }}
      className={cn(
        "w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-left text-xs transition-colors cursor-pointer select-none",
        destructive
          ? "text-destructive hover:bg-destructive/10"
          : "text-foreground hover:bg-primary/10 hover:text-primary"
      )}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <Icon className={cn("w-4 h-4 shrink-0", destructive ? "text-destructive" : "text-muted-foreground")} />
        <span className="truncate font-medium">{label}</span>
      </div>
      {shortcut && (
        <kbd className="ml-3 px-1.5 py-0.5 text-[10px] font-mono rounded bg-muted/60 text-muted-foreground border border-border/40">
          {shortcut}
        </kbd>
      )}
    </button>
  );

  const Divider = () => <div className="h-px bg-border/60 my-1 mx-2" />;

  return (
    <div
      ref={menuRef}
      role="menu"
      aria-orientation="vertical"
      style={{
        left: `${coords.x}px`,
        top: `${coords.y}px`,
      }}
      className="fixed z-50 min-w-[210px] max-w-[280px] p-1.5 rounded-xl bg-card/95 backdrop-blur-xl border border-border/80 shadow-2xl ring-1 ring-black/5 animate-in fade-in-0 zoom-in-95 duration-100 select-none"
    >
      {targetType === "file" && targetData && (
        <>
          <div className="px-3 py-1 text-[11px] font-semibold text-muted-foreground truncate border-b border-border/40 mb-1">
            {targetData.filename || targetData.name || "Archivo"}
          </div>
          {onPreview && (
            <MenuItem
              icon={Eye}
              label={t("common:actions.preview", "Vista Rápida")}
              shortcut="Espacio"
              onClick={() => onPreview(targetData)}
            />
          )}
          {onDownload && (
            <MenuItem
              icon={Download}
              label={t("common:actions.download", "Descargar")}
              shortcut="⌘D"
              onClick={() => onDownload(targetData)}
            />
          )}
          {onShare && (
            <MenuItem
              icon={Share2}
              label={t("common:actions.share", "Compartir Enlace")}
              shortcut="L"
              onClick={() => onShare(targetData)}
            />
          )}
          {onPassport && (
            <MenuItem
              icon={Shield}
              label={t("drive:actions.cryptoPassport", "Pasaporte Criptográfico")}
              shortcut="P"
              onClick={() => onPassport(targetData)}
            />
          )}
          {onMove && (
            <MenuItem
              icon={FolderInput}
              label={t("common:actions.move", "Mover a Carpeta...")}
              shortcut="M"
              onClick={() => onMove(targetData)}
            />
          )}
          {onToggleStar && (
            <MenuItem
              icon={Star}
              label={targetData.is_starred ? t("drive:actions.unstar", "Quitar Destacado") : t("drive:actions.star", "Destacar")}
              shortcut="S"
              onClick={() => onToggleStar(targetData.id)}
            />
          )}
          {onCopyHash && (
            <MenuItem
              icon={Copy}
              label={t("drive:actions.copyHash", "Copiar Sello SHA-256")}
              shortcut="C"
              onClick={() => onCopyHash(targetData)}
            />
          )}
          <Divider />
          {onDelete && (
            <MenuItem
              icon={Trash2}
              label={t("common:actions.delete", "Eliminar Archivo")}
              shortcut="Supr"
              destructive
              onClick={() => onDelete(targetData)}
            />
          )}
        </>
      )}

      {targetType === "multi-file" && Array.isArray(targetData) && (
        <>
          <div className="px-3 py-1 text-[11px] font-semibold text-muted-foreground truncate border-b border-border/40 mb-1">
            {targetData.length} archivos seleccionados
          </div>
          {onBatchDownload && (
            <MenuItem
              icon={Download}
              label={t("drive:actions.batchDownload", "Descargar Lote (Zip)")}
              shortcut="⌘D"
              onClick={() => onBatchDownload(targetData)}
            />
          )}
          {onBatchMove && (
            <MenuItem
              icon={FolderInput}
              label={t("drive:actions.batchMove", "Mover Seleccionados...")}
              shortcut="M"
              onClick={() => onBatchMove(targetData)}
            />
          )}
          {onBatchStage && (
            <MenuItem
              icon={Layers}
              label={t("drive:actions.addToDock", "Enviar al Staging Dock")}
              shortcut="X"
              onClick={() => onBatchStage(targetData)}
            />
          )}
          <Divider />
          {onBatchDelete && (
            <MenuItem
              icon={Trash2}
              label={t("drive:actions.batchDelete", "Eliminar Seleccionados")}
              shortcut="Supr"
              destructive
              onClick={() => onBatchDelete(targetData)}
            />
          )}
        </>
      )}

      {targetType === "folder" && targetData && (
        <>
          <div className="px-3 py-1 text-[11px] font-semibold text-muted-foreground truncate border-b border-border/40 mb-1">
            📁 {targetData.name || "Carpeta"}
          </div>
          {onCreateSubfolder && (
            <MenuItem
              icon={FolderPlus}
              label={t("drive:actions.newSubfolder", "Nueva Subcarpeta")}
              shortcut="N"
              onClick={() => onCreateSubfolder(targetData.id)}
            />
          )}
          {onUploadHere && (
            <MenuItem
              icon={Upload}
              label={t("drive:actions.uploadHere", "Subir Archivo Aquí")}
              shortcut="U"
              onClick={() => onUploadHere(targetData.id)}
            />
          )}
          {onShareFolder && (
            <MenuItem
              icon={Share2}
              label={t("drive:actions.shareFolder", "Compartir Carpeta")}
              shortcut="L"
              onClick={() => onShareFolder(targetData.id, targetData.name)}
            />
          )}
          {onRenameFolder && (
            <MenuItem
              icon={Edit2}
              label={t("common:actions.rename", "Renombrar Carpeta")}
              shortcut="F2"
              onClick={() => onRenameFolder(targetData.id, targetData.name)}
            />
          )}
          <Divider />
          {onDeleteFolder && (
            <MenuItem
              icon={Trash2}
              label={t("common:actions.delete", "Eliminar Carpeta")}
              shortcut="Supr"
              destructive
              onClick={() => onDeleteFolder(targetData.id, targetData.name)}
            />
          )}
        </>
      )}

      {targetType === "canvas" && (
        <>
          {onCreateFolder && (
            <MenuItem
              icon={FolderPlus}
              label={t("drive:actions.newFolder", "Nueva Carpeta")}
              shortcut="N"
              onClick={onCreateFolder}
            />
          )}
          {onUploadHere && (
            <MenuItem
              icon={Upload}
              label={t("drive:actions.uploadFiles", "Subir Archivos")}
              shortcut="U"
              onClick={() => onUploadHere()}
            />
          )}
          <Divider />
          {onRefresh && (
            <MenuItem
              icon={RefreshCw}
              label={t("common:actions.refresh", "Actualizar Bóveda")}
              shortcut="⌘R"
              onClick={onRefresh}
            />
          )}
        </>
      )}
    </div>
  );
};

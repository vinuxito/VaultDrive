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
  MessageCircle,
  Inbox,
  Sparkles,
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
  onWhatsAppShare?: (file: any) => void;
  onPassport?: (file: any) => void;
  onMove?: (file: any) => void;
  onRenameInline?: (file: any) => void;
  onToggleStar?: (fileId: string) => void;
  onCopyHash?: (file: any) => void;
  onStageFile?: (file: any) => void;
  onDelete?: (file: any) => void;
  onBatchDownload?: (files: any[]) => void;
  onBatchMove?: (files: any[]) => void;
  onBatchStage?: (files: any[]) => void;
  onBatchDelete?: (files: any[]) => void;
  onCreateFolder?: () => void;
  onCreateSubfolder?: (folderId: string) => void;
  onUploadHere?: (folderId?: string) => void;
  onSmartUpload?: () => void;
  onRequestDrop?: () => void;
  onRequestDropForFolder?: (folderId: string, name: string) => void;
  onTogglePinFolder?: (folderId: string, name: string) => void;
  isFolderPinned?: (folderId: string) => boolean;
  onGenerateStandardSubfolders?: (folderId: string, name: string) => void;
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
  onWhatsAppShare,
  onPassport,
  onMove,
  onRenameInline,
  onToggleStar,
  onCopyHash,
  onStageFile,
  onDelete,
  onBatchDownload,
  onBatchMove,
  onBatchStage,
  onBatchDelete,
  onCreateFolder,
  onCreateSubfolder,
  onUploadHere,
  onSmartUpload,
  onRequestDrop,
  onRequestDropForFolder,
  onTogglePinFolder,
  isFolderPinned,
  onGenerateStandardSubfolders,
  onRenameFolder,
  onShareFolder,
  onDeleteFolder,
  onRefresh,
}) => {
  const { t } = useTranslation(["common", "drive"]);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [coords, setCoords] = useState<{ x: number; y: number }>({ x: state.x, y: state.y });

  useEffect(() => {
    if (!state.isOpen) return;

    const MENU_WIDTH = 272;
    const MENU_HEIGHT = 360;
    const padding = 10;

    const clampedX = Math.max(padding, Math.min(state.x, Math.max(padding, window.innerWidth - MENU_WIDTH - padding)));
    const clampedY = Math.max(padding, Math.min(state.y, Math.max(padding, window.innerHeight - MENU_HEIGHT - padding)));

    setCoords({ x: clampedX, y: clampedY });
  }, [state.isOpen, state.x, state.y]);

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
        "w-full h-[33px] flex items-center justify-between px-2.5 rounded-[8px] text-left text-[12px] font-semibold transition-colors cursor-pointer select-none",
        destructive
          ? "text-destructive hover:bg-destructive/10"
          : "text-foreground hover:bg-primary/12 hover:text-primary"
      )}
    >
      <div className="flex items-center gap-2 min-w-0">
        <Icon className={cn("w-3.5 h-3.5 shrink-0", destructive ? "text-destructive" : "text-muted-foreground")} />
        <span className="truncate">{label}</span>
      </div>
      {shortcut && <kbd className="abrn-kbd-pill ml-3 shrink-0">{shortcut}</kbd>}
    </button>
  );

  const Divider = () => <div style={{ background: "var(--abrn-border)" }} className="h-px my-1 mx-1.5" />;

  return (
    <div
      ref={menuRef}
      role="menu"
      data-testid="vault-context-menu"
      aria-orientation="vertical"
      style={{
        left: `${coords.x}px`,
        top: `${coords.y}px`,
        background: "var(--abrn-popover)",
        borderColor: "var(--abrn-border-strong)",
        boxShadow: "var(--abrn-shadow-lg)",
      }}
      className="fixed z-[60] min-w-[262px] max-w-[300px] p-1.5 rounded-[12px] border animate-in fade-in-0 zoom-in-95 duration-100 select-none"
    >
      {targetType === "file" && targetData && (
        <>
          <div
            style={{ borderColor: "var(--abrn-border)" }}
            className="px-2.5 py-1.5 text-[10.5px] font-extrabold uppercase tracking-[0.04em] text-primary truncate border-b mb-1"
          >
            {targetData.filename || targetData.name || "Archivo"}
          </div>
          {onPreview && (
            <MenuItem
              icon={Eye}
              label={t("common:actions.preview", "Abrir en Visor 94vw")}
              shortcut="Enter"
              onClick={() => onPreview(targetData)}
            />
          )}
          {onShare && (
            <MenuItem
              icon={Share2}
              label={t("common:actions.share", "Crear Enlace #key")}
              shortcut="L"
              onClick={() => onShare(targetData)}
            />
          )}
          {onWhatsAppShare && (
            <MenuItem
              icon={MessageCircle}
              label={t("drive:actions.whatsappShare", "Enviar por WhatsApp")}
              shortcut="W"
              onClick={() => onWhatsAppShare(targetData)}
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
          {onPassport && (
            <MenuItem
              icon={Shield}
              label={t("drive:actions.cryptoPassport", "Pasaporte Criptográfico")}
              shortcut="P"
              onClick={() => onPassport(targetData)}
            />
          )}
          <Divider />
          {onRenameInline && (
            <MenuItem
              icon={Edit2}
              label="Renombrar aquí mismo"
              shortcut="F2"
              onClick={() => onRenameInline(targetData)}
            />
          )}
          {onToggleStar && (
            <MenuItem
              icon={Star}
              label={targetData.is_starred ? t("drive:actions.unstar", "Quitar de Fijados") : t("drive:actions.star", "Fijar archivo arriba ★")}
              shortcut="S"
              onClick={() => onToggleStar(targetData.id)}
            />
          )}
          {onStageFile && (
            <MenuItem
              icon={Layers}
              label={t("drive:actions.addToDock", "Enviar al Staging Dock")}
              shortcut="Espacio"
              onClick={() => onStageFile(targetData)}
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
          {onDownload && (
            <MenuItem
              icon={Download}
              label={t("common:actions.download", "Descargar")}
              shortcut="⌘D"
              onClick={() => onDownload(targetData)}
            />
          )}
          <Divider />
          {onDelete && (
            <MenuItem
              icon={Trash2}
              label={t("common:actions.delete", "Enviar a papelera cifrada")}
              shortcut="Supr"
              destructive
              onClick={() => onDelete(targetData)}
            />
          )}
        </>
      )}

      {targetType === "multi-file" && Array.isArray(targetData) && (
        <>
          <div
            style={{ borderColor: "var(--abrn-border)" }}
            className="px-2.5 py-1.5 text-[10.5px] font-extrabold uppercase tracking-[0.04em] text-primary truncate border-b mb-1"
          >
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
              shortcut="Espacio"
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
          <div
            style={{ borderColor: "var(--abrn-border)" }}
            className="px-2.5 py-1.5 text-[10.5px] font-extrabold uppercase tracking-[0.04em] text-primary truncate border-b mb-1"
          >
            Carpeta · {targetData.name || "Carpeta"}
          </div>
          {onShareFolder && (
            <MenuItem
              icon={Share2}
              label={t("drive:actions.shareFolder", "Compartir Carpeta")}
              shortcut="#key"
              onClick={() => onShareFolder(targetData.id, targetData.name)}
            />
          )}
          {onRequestDropForFolder && (
            <MenuItem
              icon={Inbox}
              label="Solicitar Docs (Buzón Secure Drop)"
              shortcut="Drop"
              onClick={() => onRequestDropForFolder(targetData.id, targetData.name)}
            />
          )}
          {onTogglePinFolder && (
            <MenuItem
              icon={Star}
              label={isFolderPinned?.(targetData.id) ? "Quitar de Fijados" : "Fijar Carpeta Arriba ★"}
              onClick={() => onTogglePinFolder(targetData.id, targetData.name)}
            />
          )}
          {onGenerateStandardSubfolders && (
            <MenuItem
              icon={Sparkles}
              label="Generar 5 Subcarpetas Base"
              onClick={() => onGenerateStandardSubfolders(targetData.id, targetData.name)}
            />
          )}
          <Divider />
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
          <div
            style={{ borderColor: "var(--abrn-border)" }}
            className="px-2.5 py-1.5 text-[10.5px] font-extrabold uppercase tracking-[0.04em] text-primary truncate border-b mb-1"
          >
            Acciones Rápidas Bóveda ABRN
          </div>
          {onSmartUpload && (
            <MenuItem
              icon={Sparkles}
              label="Subir y Auto-Ordenar Archivos"
              shortcut="⌘U"
              onClick={onSmartUpload}
            />
          )}
          {onRequestDrop && (
            <MenuItem
              icon={Inbox}
              label="Solicitar Docs al Cliente (Drop)"
              shortcut="D"
              onClick={onRequestDrop}
            />
          )}
          {onCreateFolder && (
            <MenuItem
              icon={FolderPlus}
              label={t("drive:actions.newFolder", "Nueva Carpeta con Plantilla")}
              shortcut="⇧N"
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

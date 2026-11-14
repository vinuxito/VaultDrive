import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  File,
  Download,
  Link2,
  Star,
  Shield,
  ShieldCheck,
  Share2,
  Users,
  FolderOpen,
  Trash2,
  Zap,
  Clock,
  Loader2,
  Eye,
  Check,
  Edit2,
  MessageCircle,
  ShoppingBag,
} from "lucide-react";
import { RowActionMenu } from "../ui/row-action-menu";

export interface FileData {
  id: string;
  filename: string;
  file_size: number;
  created_at: string;
  metadata: string;
  is_owner?: boolean;
  starred?: boolean;
  owner_email?: string | null;
  owner_name?: string | null;
  group_name?: string | null;
  group_id?: string | null;
  shared_by?: string | null;
  shared_by_email?: string | null;
  shared_by_name?: string | null;
  shared_at?: string | null;
  drop_token?: string | null;
  drop_folder_id?: string | null;
  drop_folder_name?: string | null;
  pin_wrapped_key?: string | null;
  folder_id?: string | null;
  parent_hash?: string | null;
}

interface FileGridProps {
  files: FileData[];
  selectedFileIds: Set<string>;
  toggleFileSelection: (fileId: string) => void;
  toggleSelectAllVisible: () => void;
  allVisibleSelected: boolean;
  headerCheckboxRef: React.RefObject<HTMLInputElement | null>;
  onDownload: (file: FileData) => void;
  onCreateShareLink: (file: FileData) => void;
  onWhatsAppShare?: (file: FileData) => void;
  onToggleStar: (fileId: string) => void;
  onAccessPanel: (file: { id: string; filename: string }) => void;
  onShareClick: (fileId: string, filename: string, metadata: string, pinWrappedKey?: string) => void;
  onQuickShare: (fileId: string) => void;
  onManageSharesClick: (file: { id: string; filename: string }) => void;
  onMoveClick: (file: FileData) => void;
  onDeleteClick: (file: { id: string; filename: string }) => void;
  onPreviewClick: (file: FileData) => void;
  onContextMenu: (event: React.MouseEvent, file: FileData) => void;
  setOpenActionMenu: (fileId: string | null) => void;
  openActionMenu: string | null;
  onOpenReceipt: (file: FileData) => void;
  downloadingFileIds?: Set<string>;
  deletingFileIds?: Set<string>;
  focusedFileId?: string | null;
  activeInspectorFileId?: string | null;
  folderNameById?: Record<string, string>;
  renamingFileId?: string | null;
  onStartRename?: (fileId: string | null) => void;
  onRenameFile?: (file: FileData, newFilename: string) => Promise<void> | void;
  dockedFileIds?: Set<string>;
  onToggleStageFile?: (file: FileData) => void;
  sortBy?: "name" | "date" | "size";
  sortAsc?: boolean;
  onSort?: (field: "name" | "date" | "size") => void;
  onRowHover?: (file: FileData) => void;
  onPassportClick?: (file: FileData) => void;
  onDoubleClickRow?: (file: FileData) => void;
  onOpenCinemascope?: (file: FileData) => void;
  onMobileInspectClick?: (file: FileData) => void;
}

interface ThumbAndBadgeMeta {
  extLabel: string;
  thumbClass: string;
  typePillLabel: string;
}

function getThumbAndBadgeMeta(filename: string): ThumbAndBadgeMeta {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "pdf") {
    return { extLabel: "PDF", thumbClass: "abrn-thumb-pdf", typePillLabel: "DOCUMENTO PDF" };
  }
  if (ext === "xml") {
    return { extLabel: "CFDI", thumbClass: "abrn-thumb-xml", typePillLabel: "CFDI 4.0" };
  }
  if (["xlsx", "xls", "csv", "tsv", "ods"].includes(ext)) {
    return {
      extLabel: ext === "csv" ? "CSV" : "XLSX",
      thumbClass: "abrn-thumb-xlsx",
      typePillLabel: ext === "csv" ? "TABLA CSV" : "HOJA XLSX",
    };
  }
  if (["png", "jpg", "jpeg", "webp", "svg", "gif", "bmp", "avif"].includes(ext)) {
    return { extLabel: "4K", thumbClass: "abrn-thumb-image", typePillLabel: "IMAGEN 4K" };
  }
  if (["mp4", "webm", "mov", "mkv", "m4v"].includes(ext)) {
    return { extLabel: "MP4", thumbClass: "abrn-thumb-video", typePillLabel: "STREAM 64KB" };
  }
  if (["sh", "ts", "tsx", "js", "py", "go", "json", "md", "sql"].includes(ext)) {
    return {
      extLabel: ext.toUpperCase().slice(0, 4),
      thumbClass: "abrn-thumb-code",
      typePillLabel: "SCRIPT / CÓDIGO",
    };
  }
  return {
    extLabel: (ext || "DOC").toUpperCase().slice(0, 4),
    thumbClass: "abrn-thumb-code",
    typePillLabel: "CIFRADO AES",
  };
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatDate(dateString: string): string {
  if (!dateString) return "Reciente";
  const d = new Date(dateString);
  if (Number.isNaN(d.getTime())) return "Reciente";
  const now = new Date();
  const isToday =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (isToday) {
    return d.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString("es-MX", { day: "2-digit", month: "short" });
}

function getDayGroup(dateString: string): "HOY" | "ESTA SEMANA" | "ANTERIORES" {
  if (!dateString) return "HOY";
  const d = new Date(dateString);
  if (Number.isNaN(d.getTime())) return "HOY";
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  if (
    diffDays < 1 &&
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear()
  ) {
    return "HOY";
  }
  if (diffDays <= 7) {
    return "ESTA SEMANA";
  }
  return "ANTERIORES";
}

function getOriginSummary(file: FileData): { label: string; isDrop: boolean; isShared: boolean } {
  if (file.drop_token) {
    return {
      label: file.drop_folder_name
        ? `Subido por cliente (${file.drop_folder_name})`
        : "Subido por cliente (Secure Drop)",
      isDrop: true,
      isShared: false,
    };
  }
  if (file.group_name) {
    return { label: `Equipo · ${file.group_name}`, isDrop: false, isShared: true };
  }
  if (file.shared_by || file.shared_by_name) {
    return {
      label: `Compartido por ${file.shared_by_name || file.shared_by}`,
      isDrop: false,
      isShared: true,
    };
  }
  return { label: "Subido por mí", isDrop: false, isShared: false };
}

function computeShortSha(file: FileData): string {
  if (file.parent_hash && file.parent_hash.length >= 8) {
    return file.parent_hash.slice(0, 8);
  }
  let acc = 2166136261;
  const src = `${file.id}:${file.filename}:${file.file_size}`;
  for (let i = 0; i < src.length; i++) {
    acc ^= src.charCodeAt(i);
    acc = Math.imul(acc, 16777619);
  }
  return (acc >>> 0).toString(16).padStart(8, "0");
}

export const FileGrid: React.FC<FileGridProps> = ({
  files,
  selectedFileIds,
  toggleFileSelection,
  toggleSelectAllVisible,
  allVisibleSelected,
  headerCheckboxRef,
  onDownload,
  onCreateShareLink,
  onWhatsAppShare,
  onToggleStar,
  onAccessPanel,
  onShareClick,
  onQuickShare,
  onManageSharesClick,
  onMoveClick,
  onDeleteClick,
  onPreviewClick,
  onContextMenu,
  onOpenReceipt,
  downloadingFileIds = new Set(),
  deletingFileIds = new Set(),
  focusedFileId,
  activeInspectorFileId,
  folderNameById = {},
  renamingFileId: controlledRenamingId,
  onStartRename,
  onRenameFile,
  dockedFileIds = new Set(),
  onToggleStageFile,
  sortBy,
  sortAsc,
  onSort,
  onRowHover,
  onDoubleClickRow,
  onOpenCinemascope,
  onMobileInspectClick,
}) => {
  const { t } = useTranslation(["drive"]);
  const [localRenamingId, setLocalRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState<string>("");
  const [armedDeleteId, setArmedDeleteId] = useState<string | null>(null);
  const renameInputRef = useRef<HTMLInputElement | null>(null);

  const activeRenamingId = controlledRenamingId !== undefined ? controlledRenamingId : localRenamingId;

  const setRenaming = (id: string | null, initialFilename?: string) => {
    if (initialFilename !== undefined) {
      setRenameDraft(initialFilename);
    }
    if (onStartRename) {
      onStartRename(id);
    } else {
      setLocalRenamingId(id);
    }
  };

  useEffect(() => {
    if (!activeRenamingId) return;
    const targetFile = files.find((f) => f.id === activeRenamingId);
    if (targetFile) {
      setRenameDraft(targetFile.filename);
    }
    const timer = setTimeout(() => {
      const inp = renameInputRef.current;
      if (inp) {
        inp.focus();
        const dotIdx = inp.value.lastIndexOf(".");
        inp.setSelectionRange(0, dotIdx > 0 ? dotIdx : inp.value.length);
      }
    }, 20);
    return () => clearTimeout(timer);
  }, [activeRenamingId, files]);

  useEffect(() => {
    if (!armedDeleteId) return;
    const timer = setTimeout(() => setArmedDeleteId(null), 4500);
    return () => clearTimeout(timer);
  }, [armedDeleteId]);

  const commitInlineRename = async (file: FileData) => {
    const trimmed = renameDraft.trim();
    setRenaming(null);
    if (!trimmed || trimmed === file.filename) return;
    await onRenameFile?.(file, trimmed);
  };

  const groupedSections: Array<{ title: string; items: FileData[] }> = (() => {
    if (files.length === 0) return [];
    const buckets: Record<"HOY" | "ESTA SEMANA" | "ANTERIORES", FileData[]> = {
      HOY: [],
      "ESTA SEMANA": [],
      ANTERIORES: [],
    };
    for (const f of files) {
      buckets[getDayGroup(f.created_at)].push(f);
    }
    return (["HOY", "ESTA SEMANA", "ANTERIORES"] as const)
      .filter((k) => buckets[k].length > 0)
      .map((k) => ({ title: k, items: buckets[k] }));
  })();

  const renderRow = (file: FileData) => {
    const isSelected = selectedFileIds.has(file.id);
    const isInspectorActive = activeInspectorFileId === file.id;
    const isFocused = focusedFileId === file.id;
    const isRenaming = activeRenamingId === file.id;
    const isArmed = armedDeleteId === file.id;
    const isInBasket = dockedFileIds.has(file.id) || isSelected;
    const meta = getThumbAndBadgeMeta(file.filename);
    const originInfo = getOriginSummary(file);
    const folderLabel =
      (file.folder_id && folderNameById[file.folder_id]) ||
      file.drop_folder_name ||
      "Bóveda Principal";
    const shortSha = computeShortSha(file);
    const isPending = downloadingFileIds.has(file.id) || deletingFileIds.has(file.id);

    const pillLabel = originInfo.isDrop
      ? "DROP CLIENTE"
      : originInfo.isShared
        ? "ENLACE #KEY"
        : meta.typePillLabel;
    const pillVariantClass = originInfo.isDrop
      ? "is-drop"
      : originInfo.isShared
        ? "is-key"
        : "";

    return (
      <div
        key={file.id}
        id={`file-row-${file.id}`}
        data-file-id={file.id}
        data-file-row-id={file.id}
        style={{
          contentVisibility: "auto",
          containIntrinsicSize: "0 56px",
        }}
        onClick={(e) => {
          const target = e.target as HTMLElement;
          if (!target.closest("button, input, label, a, [data-prevent-row-click]")) {
            setArmedDeleteId(null);
            onPreviewClick(file);
          }
        }}
        onDoubleClick={(e) => {
          const target = e.target as HTMLElement;
          if (!target.closest("button, input, label, a, [data-prevent-row-click]")) {
            (onOpenCinemascope ?? onDoubleClickRow ?? onPreviewClick)(file);
          }
        }}
        onContextMenu={(event) => onContextMenu(event, file)}
        onMouseEnter={() => onRowHover?.(file)}
        className={`
          abrn-ingrid-row group flex flex-wrap md:flex-nowrap items-center gap-2.5 min-h-[56px] px-3 py-2 md:pl-3.5 rounded-[10px] border transition-all cursor-pointer select-none
          ${isSelected || isInspectorActive || isFocused ? "is-selected" : "bg-card border-border/70"}
          ${isFocused ? "ring-2 ring-primary/50" : ""}
          ${isPending ? "opacity-60" : ""}
        `}
      >
        {/* Accessible Checkbox styled as tactile Canasta Check */}
        <label
          htmlFor={`select-file-${file.id}`}
          className="min-h-[44px] min-w-[32px] -my-2 py-2 flex items-center justify-center cursor-pointer shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          <input
            id={`select-file-${file.id}`}
            type="checkbox"
            checked={isSelected}
            disabled={isPending}
            onChange={() => toggleFileSelection(file.id)}
            aria-label={t("drive:vault.selectFile", { filename: file.filename, defaultValue: "Select {{filename}}" })}
            className="sr-only"
          />
          <span
            style={{
              background: isSelected ? "var(--abrn-primary)" : "var(--abrn-bg)",
              borderColor: isSelected ? "var(--abrn-primary)" : "var(--abrn-border-strong)",
              color: isSelected ? "var(--abrn-primary-fg)" : "transparent",
            }}
            className="w-[18px] h-[18px] rounded-[5px] border-[1.7px] flex items-center justify-center transition-colors shrink-0"
          >
            <Check className="w-3 h-3 stroke-[3]" />
          </span>
        </label>

        {/* Rich 38x38 Visual Document Mini-Thumbnail */}
        {isPending ? (
          <div className="w-[38px] h-[38px] rounded-[8px] border border-border flex items-center justify-center shrink-0">
            <Loader2 className="w-4 h-4 text-primary animate-spin" />
          </div>
        ) : (
          <div className={`abrn-mini-thumb ${meta.thumbClass}`} aria-hidden="false">
            <div className="abrn-mini-thumb-bar" />
            <div className="abrn-mini-thumb-lines">
              <i style={{ width: "90%" }} />
              <i style={{ width: "66%" }} />
            </div>
            <div className="abrn-mini-thumb-ext">{meta.extLabel}</div>
            <File className="sr-only" />
          </div>
        )}

        {/* Filename + Star + Inline F2 Rename + Accountant Subtext */}
        <div className="flex-1 min-w-[120px] flex flex-col gap-0.5">
          <div className="flex items-center gap-1.5 min-w-0">
            {file.starred && (
              <span title="Fijado ★" style={{ color: "var(--abrn-gold)" }} className="inline-flex shrink-0">
                <Star className="w-3.5 h-3.5 fill-current" />
              </span>
            )}
            {isRenaming ? (
              <input
                ref={renameInputRef}
                type="text"
                data-testid={`inline-rename-input-${file.id}`}
                value={renameDraft}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => setRenameDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    e.stopPropagation();
                    void commitInlineRename(file);
                  } else if (e.key === "Escape") {
                    e.preventDefault();
                    e.stopPropagation();
                    setRenaming(null);
                  }
                }}
                onBlur={() => {
                  void commitInlineRename(file);
                }}
                style={{
                  borderColor: "var(--abrn-primary)",
                  background: "var(--abrn-card)",
                  color: "var(--abrn-fg-strong)",
                }}
                className="h-[27px] px-2 rounded-[6px] border-[1.5px] font-bold text-[12.5px] w-full max-w-[360px] focus:outline-none"
              />
            ) : (
              <span className="text-[13px] font-bold text-foreground truncate">
                {file.filename}
              </span>
            )}
          </div>

          <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-muted-foreground truncate">
            <span className="font-bold text-primary truncate">{originInfo.label}</span>
            <span>·</span>
            <span className="truncate">{folderLabel}</span>
            <span>·</span>
            <span className="abrn-mono text-[10px] opacity-85 shrink-0">SHA:{shortSha}</span>
          </div>
        </div>

        {/* Mobile Sub-line (<640px) */}
        <div className="order-last w-full sm:hidden flex items-center justify-between text-xs text-muted-foreground pt-1.5 border-t border-border/40 mt-0.5">
          <div className="flex items-center gap-2">
            <span className="abrn-mono font-medium text-foreground/80">{formatBytes(file.file_size)}</span>
            <span className="text-muted-foreground/60">•</span>
            <span>{formatDate(file.created_at)}</span>
          </div>
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
            <ShieldCheck className="w-3 h-3" />
            AES-256
          </span>
        </div>

        {/* Desktop Right Cluster + Zero-Reflow Floating In-Grid Action Capsule */}
        <div
          data-prevent-row-click="true"
          onClick={(e) => e.stopPropagation()}
          className="hidden md:flex items-center gap-1.5 shrink-0 relative ml-auto"
        >
          <span className={`abrn-type-pill hidden xl:inline-block ${pillVariantClass}`}>
            {pillLabel}
          </span>

          <div className="abrn-row-telemetry abrn-mono text-[11px] text-muted-foreground hidden lg:flex items-center justify-end gap-2 min-w-[106px] whitespace-nowrap">
            <span>{formatBytes(file.file_size)}</span>
            <span>{formatDate(file.created_at)}</span>
          </div>

          {/* FLOATING IN-GRID ACTION CAPSULE (Zero Layout Reflow!) */}
          {!isPending && (
            <div
              role="toolbar"
              data-testid={`ingrid-capsule-${file.id}`}
              aria-label={`Acciones rápidas para ${file.filename}`}
              className="abrn-ingrid-capsule"
            >
              {file.is_owner !== false && (
                <button
                  type="button"
                  onClick={() => onCreateShareLink(file)}
                  title="Crear o copiar Enlace #key"
                  className="abrn-cap-btn"
                >
                  <Link2 className="w-3.5 h-3.5" />
                </button>
              )}

              {file.is_owner !== false && (
                <button
                  type="button"
                  onClick={() => (onWhatsAppShare ?? onCreateShareLink)(file)}
                  title="Enviar por WhatsApp (#key)"
                  className="abrn-cap-btn"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                </button>
              )}

              {file.is_owner !== false && (
                <button
                  type="button"
                  onClick={() => onQuickShare(file.id)}
                  title={t("drive:vault.actions.quickShare")}
                  className="abrn-cap-btn"
                >
                  <Zap className="w-3.5 h-3.5" />
                </button>
              )}

              {file.is_owner !== false && (
                <button
                  type="button"
                  data-testid={`ingrid-rename-btn-${file.id}`}
                  onClick={() => setRenaming(file.id, file.filename)}
                  title="Renombrar aquí mismo (F2)"
                  className="abrn-cap-btn"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  if (onToggleStageFile) {
                    onToggleStageFile(file);
                  } else {
                    toggleFileSelection(file.id);
                  }
                }}
                title="Agregar o quitar de Canasta #key (Espacio)"
                className={`abrn-cap-btn ${isInBasket ? "in-basket" : ""}`}
              >
                <ShoppingBag className="w-3.5 h-3.5" />
              </button>

              {file.is_owner !== false && (
                <button
                  type="button"
                  onClick={() => onToggleStar(file.id)}
                  title={file.starred ? t("drive:vault.actions.unstar") : t("drive:vault.actions.star")}
                  className={`abrn-cap-btn ${file.starred ? "is-starred" : ""}`}
                >
                  <Star className={`w-3.5 h-3.5 ${file.starred ? "fill-current" : ""}`} />
                </button>
              )}

              {file.is_owner !== false && (
                <button
                  type="button"
                  onClick={() => onManageSharesClick({ id: file.id, filename: file.filename })}
                  title={t("drive:vault.actions.manageShares")}
                  className="abrn-cap-btn"
                >
                  <Users className="w-3.5 h-3.5" />
                </button>
              )}

              {file.is_owner !== false && (
                <>
                  <span style={{ background: "var(--abrn-border)" }} className="w-px h-3.5 mx-0.5" />
                  <button
                    type="button"
                    data-testid={`ingrid-delete-btn-${file.id}`}
                    onClick={() => {
                      if (!isArmed) {
                        setArmedDeleteId(file.id);
                        return;
                      }
                      setArmedDeleteId(null);
                      onDeleteClick({ id: file.id, filename: file.filename });
                    }}
                    title="Eliminar con seguro de 2 clics"
                    className={`abrn-cap-btn is-danger ${isArmed ? "is-armed" : ""}`}
                  >
                    {isArmed ? "¿Borrar?" : <Trash2 className="w-3.5 h-3.5" />}
                  </button>
                </>
              )}
            </div>
          )}

          {/* Persistent Download + "abrir" 94vw Buttons */}
          {!isPending && (
            <>
              <button
                type="button"
                onClick={() => onDownload(file)}
                title={t("drive:vault.actions.download")}
                style={{ background: "var(--abrn-bg)", borderColor: "var(--abrn-border)" }}
                className="w-8 h-[30px] rounded-[8px] border text-muted-foreground hover:text-foreground hover:border-primary/40 inline-flex items-center justify-center cursor-pointer transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                data-testid={`ingrid-open-94vw-${file.id}`}
                onClick={() => (onOpenCinemascope ?? onDoubleClickRow ?? onPreviewClick)(file)}
                title="Abrir en Visor Ejecutivo 94vw (Enter)"
                style={{
                  background: "var(--abrn-primary-tint)",
                  borderColor: "var(--abrn-border-strong)",
                  color: "var(--abrn-primary)",
                }}
                className="h-[30px] px-2.5 rounded-[8px] border text-[11.5px] font-bold inline-flex items-center gap-1 cursor-pointer hover:opacity-90 transition-opacity whitespace-nowrap"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>abrir</span>
              </button>
            </>
          )}
        </div>

        {/* Mobile 1-tap Quick Actions: Share (#key) + Inspect */}
        {!isPending && (
          <div className="flex md:hidden items-center gap-1 ml-auto shrink-0">
            {file.is_owner !== false && (
              <button
                type="button"
                data-prevent-row-click="true"
                data-testid={`mobile-file-share-${file.id}`}
                aria-label={`Compartir ${file.filename}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onCreateShareLink(file);
                }}
                className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/30 text-primary hover:bg-primary/20 inline-flex items-center justify-center cursor-pointer active:scale-95"
              >
                <Share2 className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              type="button"
              data-prevent-row-click="true"
              data-testid={`mobile-file-inspect-${file.id}`}
              aria-label={`Inspeccionar ${file.filename}`}
              onClick={(e) => {
                e.stopPropagation();
                (onMobileInspectClick ?? onPreviewClick)(file);
              }}
              className="w-8 h-8 rounded-lg bg-background border border-border text-foreground hover:bg-muted inline-flex items-center justify-center cursor-pointer active:scale-95"
            >
              <Eye className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Unified actions via RowActionMenu */}
        <div className="relative shrink-0" data-prevent-row-click="true" onClick={(e) => e.stopPropagation()}>
          {!isPending && (
            <RowActionMenu
              actions={[
                {
                  id: "download",
                  label: t("drive:vault.actions.download"),
                  icon: Download,
                  onSelect: () => onDownload(file),
                },
                ...(file.is_owner !== false
                  ? [
                      {
                        id: "rename-inline",
                        label: "Renombrar aquí mismo (F2)",
                        icon: Edit2,
                        onSelect: () => setRenaming(file.id, file.filename),
                      },
                      {
                        id: "link",
                        label: t("drive:vault.actions.createShareLink"),
                        icon: Link2,
                        onSelect: () => onCreateShareLink(file),
                      },
                      {
                        id: "share",
                        label: t("drive:vault.actions.share"),
                        icon: Share2,
                        onSelect: () =>
                          onShareClick(
                            file.id,
                            file.filename,
                            file.metadata,
                            file.pin_wrapped_key || undefined
                          ),
                      },
                      {
                        id: "quick-share",
                        label: t("drive:vault.actions.quickShare"),
                        icon: Zap,
                        onSelect: () => onQuickShare(file.id),
                      },
                      {
                        id: "manage",
                        label: t("drive:vault.actions.manageShares"),
                        icon: Users,
                        onSelect: () =>
                          onManageSharesClick({
                            id: file.id,
                            filename: file.filename,
                          }),
                      },
                      {
                        id: "privacy",
                        label: t("drive:vault.actions.accessControl"),
                        icon: Shield,
                        onSelect: () =>
                          onAccessPanel({
                            id: file.id,
                            filename: file.filename,
                          }),
                      },
                      {
                        id: "receipt",
                        label: t("drive:vault.actions.viewReceipt"),
                        icon: Clock,
                        onSelect: () => onOpenReceipt(file),
                      },
                      {
                        id: "move",
                        label: t("drive:vault.actions.moveToFolder"),
                        icon: FolderOpen,
                        onSelect: () => onMoveClick(file),
                      },
                      {
                        id: "star",
                        label: file.starred
                          ? t("drive:vault.actions.unstar")
                          : t("drive:vault.actions.star"),
                        icon: Star,
                        onSelect: () => onToggleStar(file.id),
                      },
                      {
                        id: "divider-destructive",
                        label: "",
                        kind: "divider" as const,
                      },
                      {
                        id: "delete",
                        label: t("drive:vault.actions.delete"),
                        icon: Trash2,
                        kind: "destructive" as const,
                        onSelect: () =>
                          onDeleteClick({
                            id: file.id,
                            filename: file.filename,
                          }),
                      },
                    ]
                  : []),
              ]}
              label={file.filename}
              density="compact"
              triggerAriaLabel={t("drive:vault.fileActions", { filename: file.filename, defaultValue: "File actions for {{filename}}" })}
              triggerTestId={`file-actions-${file.id}`}
            />
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-1">
      {/* Compact Sortable Header Strip */}
      <div className="flex items-center gap-3 px-3 py-1 text-[10px] font-extrabold text-muted-foreground uppercase tracking-[0.07em]">
        <div className="w-5 shrink-0 flex items-center justify-center">
          <input
            ref={headerCheckboxRef}
            type="checkbox"
            checked={allVisibleSelected}
            onChange={toggleSelectAllVisible}
            className="w-3.5 h-3.5 rounded border-border accent-primary cursor-pointer"
            aria-label={allVisibleSelected
              ? t("drive:vault.clearViewSelection", "Clear current view selection")
              : t("drive:vault.selectView", "Select current view")}
          />
        </div>
        <button
          type="button"
          onClick={() => onSort?.("name")}
          className="flex-1 text-left cursor-pointer select-none hover:text-foreground transition-colors inline-flex items-center gap-1 font-extrabold"
        >
          {t("drive:vault.columns.name")}
          {sortBy === "name" && (
            <span className="text-primary font-bold">{sortAsc ? "↑" : "↓"}</span>
          )}
        </button>
        <button
          type="button"
          onClick={() => onSort?.("size")}
          className="w-16 text-right cursor-pointer select-none hover:text-foreground transition-colors inline-flex items-center justify-end gap-1 font-extrabold hidden md:flex"
        >
          {t("drive:vault.columns.size")}
          {sortBy === "size" && (
            <span className="text-primary font-bold">{sortAsc ? "↑" : "↓"}</span>
          )}
        </button>
        <button
          type="button"
          onClick={() => onSort?.("date")}
          className="w-24 text-right cursor-pointer select-none hover:text-foreground transition-colors inline-flex items-center justify-end gap-1 font-extrabold hidden xl:flex"
        >
          {t("drive:vault.columns.date")}
          {sortBy === "date" && (
            <span className="text-primary font-bold">{sortAsc ? "↑" : "↓"}</span>
          )}
        </button>
        <div className="w-28 shrink-0 hidden md:block" />
      </div>

      {groupedSections.map((section) => (
        <div key={section.title} className="space-y-1">
          <div className="flex items-center justify-between px-2.5 pt-2 pb-1 text-[10px] font-extrabold uppercase tracking-[0.08em] text-muted-foreground">
            <span>{section.title}</span>
            <span className="abrn-mono">
              {section.items.length} {section.items.length === 1 ? "ÍTEM" : "ÍTEMS"}
            </span>
          </div>
          {section.items.map((file) => renderRow(file))}
        </div>
      ))}
    </div>
  );
};

import React from "react";
import { useTranslation } from "react-i18next";
import { File, Download, Link2, Star, StarOff, Shield, Share2, Users, FolderOpen, Trash2, Zap } from "lucide-react";
import { OriginBadge } from "./OriginBadge";
import type { FileOrigin } from "./OriginBadge";

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
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function fileOriginFromData(file: FileData): FileOrigin {
  if (file.drop_token && file.drop_folder_name) {
    return { type: "drop", linkName: file.drop_folder_name };
  }
  if (file.group_name) {
    return { type: "group", groupName: file.group_name };
  }
  if (file.shared_by) {
    return { type: "shared", sharedBy: file.shared_by };
  }
  return { type: "my-upload" };
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
  onToggleStar,
  onAccessPanel,
  onShareClick,
  onQuickShare,
  onManageSharesClick,
  onMoveClick,
  onDeleteClick,
  onPreviewClick,
  onContextMenu,
  setOpenActionMenu,
  openActionMenu,
}) => {
  const { t } = useTranslation(["drive"]);

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-3 px-3 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
        <div className="w-4 shrink-0 flex items-center justify-center">
          <input
            ref={headerCheckboxRef}
            type="checkbox"
            checked={allVisibleSelected}
            onChange={toggleSelectAllVisible}
            className="w-4 h-4 rounded border-border accent-primary cursor-pointer"
            aria-label={allVisibleSelected ? "Clear current view selection" : "Select current view"}
          />
        </div>
        <div className="flex-1">{t("drive:vault.columns.name")}</div>
        <div className="w-28 hidden sm:block">{t("drive:vault.columns.origin")}</div>
        <div className="w-16 text-right hidden md:block">{t("drive:vault.columns.size")}</div>
        <div className="w-24 text-right hidden lg:block">{t("drive:vault.columns.date")}</div>
        <div className="w-24 shrink-0" />
      </div>

      {files.map((file) => {
        const isSelected = selectedFileIds.has(file.id);
        const origin = fileOriginFromData(file);

        return (
          <div
            key={file.id}
            className={`
              group flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all cursor-default
              ${isSelected
                ? "bg-primary-foreground/60 border-primary/40"
                : "bg-background border-border/60 hover:border-border hover:shadow-sm"
              }
            `}
          >
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => toggleFileSelection(file.id)}
              className="w-4 h-4 rounded border-border accent-primary shrink-0 cursor-pointer"
            />

            <button
              type="button"
              className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer text-left"
              onContextMenu={(event) => onContextMenu(event, file)}
              onClick={() => onPreviewClick(file)}
            >
              <File className="w-4 h-4 text-muted-foreground shrink-0" />
              <span className="text-sm font-medium text-foreground truncate hover:text-primary transition-colors">
                {file.filename}
              </span>
            </button>

            <div className="w-28 hidden sm:block shrink-0">
              <OriginBadge origin={origin} />
            </div>

            <div className="w-16 text-right text-xs text-muted-foreground hidden md:block shrink-0">
              {formatBytes(file.file_size)}
            </div>

            <div className="w-24 text-right text-xs text-muted-foreground hidden lg:block shrink-0">
              {formatDate(file.created_at)}
            </div>

            <div className="hidden md:flex items-center justify-end gap-1 shrink-0">
              {/* Primary actions — always visible */}
              <button
                type="button"
                onClick={() => onDownload(file)}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary-foreground/60 transition-colors"
                title="Download"
              >
                <Download className="w-3.5 h-3.5" />
              </button>

              {file.is_owner !== false && (
                <button
                  type="button"
                  onClick={() => onCreateShareLink(file)}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors"
                  title="Create share link"
                >
                  <Link2 className="w-3.5 h-3.5" />
                </button>
              )}

              {file.is_owner !== false && (
                <button
                  type="button"
                  onClick={() => onToggleStar(file.id)}
                  className={`p-1.5 rounded-lg transition-colors ${
                    file.starred
                      ? "text-amber-400 hover:text-amber-500"
                      : "text-muted-foreground hover:text-amber-400 hover:bg-amber-500/10"
                  }`}
                  title={file.starred ? "Unstar" : "Star"}
                >
                  {file.starred ? (
                    <Star className="w-3.5 h-3.5 fill-current" />
                  ) : (
                    <StarOff className="w-3.5 h-3.5" />
                  )}
                </button>
              )}

              {file.is_owner !== false && (
                <button
                  type="button"
                  onClick={() => onAccessPanel({ id: file.id, filename: file.filename })}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary-foreground/40 transition-colors"
                  title="Who can access this file?"
                >
                  <Shield className="w-3.5 h-3.5" />
                </button>
              )}

              {/* Secondary actions — revealed on row hover */}
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                {file.is_owner !== false && (
                  <button
                    type="button"
                    onClick={() => onShareClick(file.id, file.filename, file.metadata, file.pin_wrapped_key || undefined)}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-blue-500 dark:hover:text-blue-400 hover:bg-blue-500/10 transition-colors"
                    title="Share with user"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                  </button>
                )}

                {file.is_owner !== false && (
                  <button
                    type="button"
                    onClick={() => onQuickShare(file.id)}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-violet-600 dark:hover:text-violet-400 hover:bg-violet-500/10 transition-colors"
                    title="Quick Share (7-day link, copied to clipboard)"
                  >
                    <Zap className="w-3.5 h-3.5" />
                  </button>
                )}

                {file.is_owner !== false && (
                  <button
                    type="button"
                    onClick={() => onManageSharesClick({ id: file.id, filename: file.filename })}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-purple-500 dark:hover:text-purple-400 hover:bg-purple-500/10 transition-colors"
                    title="Manage file shares"
                  >
                    <Users className="w-3.5 h-3.5" />
                  </button>
                )}

                {file.is_owner !== false && (
                  <button
                    type="button"
                    onClick={() => onMoveClick(file)}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-teal-600 dark:hover:text-teal-400 hover:bg-teal-500/10 transition-colors"
                    title="Move to folder"
                  >
                    <FolderOpen className="w-3.5 h-3.5" />
                  </button>
                )}

                {file.is_owner !== false && (
                  <button
                    type="button"
                    onClick={() => onDeleteClick({ id: file.id, filename: file.filename })}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    title="Delete file"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Mobile actions dropdown */}
            <div className="md:hidden relative shrink-0">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setOpenActionMenu(openActionMenu === file.id ? null : file.id);
                }}
                className="p-1 rounded-lg text-muted-foreground hover:bg-muted"
                aria-label="File actions"
              >
                <Users className="w-4 h-4" />
              </button>

              {openActionMenu === file.id && (
                <div className="absolute right-0 mt-1 z-30 min-w-[160px] rounded-lg border border-border bg-card shadow-lg py-1">
                  <button
                    type="button"
                    onClick={() => onDownload(file)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-muted text-left"
                  >
                    <Download className="w-3.5 h-3.5" /> {t("drive:vault.actions.download")}
                  </button>

                  {file.is_owner !== false && (
                    <>
                      <button
                        type="button"
                        onClick={() => onCreateShareLink(file)}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-muted text-left"
                      >
                        <Link2 className="w-3.5 h-3.5" /> Link
                      </button>
                      <button
                        type="button"
                        onClick={() => onShareClick(file.id, file.filename, file.metadata, file.pin_wrapped_key || undefined)}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-muted text-left"
                      >
                        <Share2 className="w-3.5 h-3.5" /> User
                      </button>
                      <button
                        type="button"
                        onClick={() => onQuickShare(file.id)}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-violet-700 hover:bg-violet-50 text-left"
                      >
                        <Zap className="w-3.5 h-3.5" /> Quick Share
                      </button>
                      <button
                        type="button"
                        onClick={() => onManageSharesClick({ id: file.id, filename: file.filename })}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-muted text-left"
                      >
                        <Users className="w-3.5 h-3.5" /> Manage
                      </button>
                      <button
                        type="button"
                        onClick={() => onAccessPanel({ id: file.id, filename: file.filename })}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-muted text-left"
                      >
                        <Shield className="w-3.5 h-3.5" /> Privacy
                      </button>
                      <button
                        type="button"
                        onClick={() => onMoveClick(file)}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-muted text-left"
                      >
                        <FolderOpen className="w-3.5 h-3.5" /> Move
                      </button>
                      <button
                        type="button"
                        onClick={() => onToggleStar(file.id)}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-muted text-left"
                      >
                        <Star className="w-3.5 h-3.5" /> {file.starred ? "Unstar" : "Star"}
                      </button>
                      <hr className="border-border/60 my-1" />
                      <button
                        type="button"
                        onClick={() => onDeleteClick({ id: file.id, filename: file.filename })}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-destructive/10 text-left font-medium"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Delete
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

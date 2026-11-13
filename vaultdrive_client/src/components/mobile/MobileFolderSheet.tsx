import { useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  Folder as FolderIcon,
  Home,
  Star,
  Share2,
  Plus,
  ChevronRight,
  CornerDownRight,
  Download,
  Link2,
  X,
} from "lucide-react";
import { cn } from "../../lib/utils";
import type { Folder } from "../files/FolderBreadcrumb";
import type { MobileFolderShareTab } from "./MobileFolderShareSheet";

export interface MobileFolderSheetProps {
  isOpen: boolean;
  onClose: () => void;
  folders: Folder[];
  currentFolderId?: string | null;
  fileCountsByFolderId?: Record<string, number>;
  allFilesCount?: number;
  starredCount?: number;
  sharedCount?: number;
  dropFolderIds?: Set<string> | string[];
  onSelectRoot: () => void;
  onSelectStarred: () => void;
  onSelectShared: () => void;
  onSelectFolder: (folderId: string, folderName: string) => void;
  onCreateFolder: () => void;
  onShareFolder?: (folderId: string, folderName: string, initialTab?: MobileFolderShareTab) => void;
}

interface OrderedFolderEntry {
  folder: Folder;
  depth: number;
}

export function MobileFolderSheet({
  isOpen,
  onClose,
  folders,
  currentFolderId,
  fileCountsByFolderId = {},
  allFilesCount = 0,
  starredCount = 0,
  sharedCount = 0,
  dropFolderIds,
  onSelectRoot,
  onSelectStarred,
  onSelectShared,
  onSelectFolder,
  onCreateFolder,
  onShareFolder,
}: MobileFolderSheetProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const activeDropSet = useMemo(() => {
    if (!dropFolderIds) return new Set<string>();
    return dropFolderIds instanceof Set ? dropFolderIds : new Set(dropFolderIds);
  }, [dropFolderIds]);

  const orderedEntries = useMemo<OrderedFolderEntry[]>(() => {
    const byId = new Map(folders.map((f) => [f.id, f]));
    const childrenMap = new Map<string, Folder[]>();
    const roots: Folder[] = [];

    for (const f of folders) {
      if (f.parentId && byId.has(f.parentId)) {
        const list = childrenMap.get(f.parentId) || [];
        list.push(f);
        childrenMap.set(f.parentId, list);
      } else {
        roots.push(f);
      }
    }

    const result: OrderedFolderEntry[] = [];
    const walk = (node: Folder, depth: number) => {
      result.push({ folder: node, depth });
      const kids = childrenMap.get(node.id) || [];
      for (const child of kids) {
        walk(child, Math.min(depth + 1, 2));
      }
    };

    for (const root of roots) {
      walk(root, 0);
    }
    return result;
  }, [folders]);

  if (!isOpen) return null;

  const dockTargetFolder =
    folders.find((f) => f.id === currentFolderId) || orderedEntries[0]?.folder || null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Explorador de Bóveda"
      data-testid="mobile-folder-explorer-sheet"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-xs animate-in fade-in-0 duration-150"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-t-[24px] border-t-[1.5px] border-x border-primary/30 bg-card text-card-foreground shadow-2xl max-h-[88dvh] flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 duration-200"
      >
        {/* ================================================================
            ZONE 1: FROZEN HERO HEADER
            ================================================================ */}
        <div className="px-4 pt-2.5 pb-3 border-b border-border bg-card shrink-0">
          <div className="w-10 h-1 rounded-full bg-primary/30 mx-auto mb-2" />
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-primary/12 border border-primary/30 text-primary flex items-center justify-center shrink-0">
                <FolderIcon className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h3
                  style={{ fontFamily: "var(--font-display)" }}
                  className="text-[15px] font-bold tracking-tight text-foreground truncate"
                >
                  Explorador de Bóveda
                </h3>
                <p className="text-[11px] text-muted-foreground truncate">
                  Navega o comparte cualquier carpeta en 1 toque
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar"
              className="w-8 h-8 rounded-full border border-border bg-background text-foreground hover:bg-muted flex items-center justify-center shrink-0 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ================================================================
            ZONE 2: QUICK NAV + HIERARCHICAL FOLDER TREE WITH 1-TAP SHARE
            ================================================================ */}
        <div className="px-4 py-3.5 overflow-y-auto flex-1 space-y-3.5">
          {/* Quick Nav 3-Grid */}
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => {
                onSelectRoot();
                onClose();
              }}
              className={cn(
                "flex flex-col items-center justify-center p-2.5 rounded-xl border text-center transition-all cursor-pointer min-h-[56px] active:scale-95",
                !currentFolderId
                  ? "bg-primary/12 border-primary text-primary font-bold shadow-xs"
                  : "bg-background border-border text-foreground hover:bg-muted"
              )}
            >
              <Home className="w-4 h-4 mb-1 text-primary" />
              <span className="text-xs font-semibold">Principal</span>
              <span className="text-[10px] text-muted-foreground mt-0.5">({allFilesCount})</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onSelectStarred();
                onClose();
              }}
              className="flex flex-col items-center justify-center p-2.5 rounded-xl border border-border bg-background text-foreground hover:bg-muted text-center transition-all cursor-pointer min-h-[56px] active:scale-95"
            >
              <Star className="w-4 h-4 mb-1 text-amber-500" />
              <span className="text-xs font-semibold">Destacados</span>
              <span className="text-[10px] text-muted-foreground mt-0.5">({starredCount})</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onSelectShared();
                onClose();
              }}
              className="flex flex-col items-center justify-center p-2.5 rounded-xl border border-border bg-background text-foreground hover:bg-muted text-center transition-all cursor-pointer min-h-[56px] active:scale-95"
            >
              <Share2 className="w-4 h-4 mb-1 text-primary" />
              <span className="text-xs font-semibold">Compartidos</span>
              <span className="text-[10px] text-muted-foreground mt-0.5">({sharedCount})</span>
            </button>
          </div>

          {/* Hierarchical Folders List */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10.5px] font-bold text-muted-foreground tracking-wider uppercase">
                Carpetas ({folders.length}) · Acción Directa
              </span>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onCreateFolder();
                }}
                className="text-xs text-primary font-bold flex items-center gap-1 hover:underline cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Nueva Carpeta</span>
              </button>
            </div>

            {orderedEntries.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground text-xs bg-background rounded-xl border border-dashed border-border p-4">
                <FolderIcon className="w-8 h-8 mx-auto mb-2 text-muted-foreground/60" />
                <p>No tienes carpetas creadas en tu bóveda todavía.</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {orderedEntries.map(({ folder, depth }) => {
                  const count = fileCountsByFolderId[folder.id] ?? 0;
                  const isCurrent = currentFolderId === folder.id;
                  const hasDrop = activeDropSet.has(folder.id);
                  const isSubfolder = depth > 0;

                  return (
                    <div
                      key={folder.id}
                      data-testid={`mobile-folder-row-${folder.id}`}
                      className={cn(
                        "flex items-center justify-between gap-2 p-2.5 rounded-xl border transition-all min-h-[54px]",
                        isSubfolder && "ml-4 border-dashed",
                        isCurrent
                          ? "bg-primary/12 border-primary/50 text-foreground"
                          : "bg-background border-border hover:bg-muted/60 text-foreground"
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          onSelectFolder(folder.id, folder.name);
                          onClose();
                        }}
                        className="flex-1 flex items-center gap-2.5 min-w-0 text-left cursor-pointer"
                      >
                        {isSubfolder ? (
                          <CornerDownRight
                            className={cn(
                              "w-4 h-4 shrink-0",
                              isCurrent ? "text-primary" : "text-muted-foreground"
                            )}
                          />
                        ) : (
                          <FolderIcon
                            className={cn(
                              "w-4 h-4 shrink-0",
                              isCurrent ? "text-primary" : "text-muted-foreground"
                            )}
                          />
                        )}
                        <div className="min-w-0 flex-1">
                          <p
                            className={cn(
                              "text-[12.5px] truncate",
                              isCurrent ? "font-bold" : "font-semibold"
                            )}
                          >
                            {folder.name}
                          </p>
                          <div className="flex items-center gap-1.5 text-[10.5px] text-muted-foreground font-mono truncate">
                            <span>{count === 1 ? "1 archivo" : `${count} archivos`}</span>
                            {hasDrop && (
                              <span className="text-[#2d8a6e] dark:text-[#3eb489] font-sans font-bold">
                                · Drop Activo
                              </span>
                            )}
                            {count === 0 && (
                              <span className="font-sans">· Vacía</span>
                            )}
                          </div>
                        </div>
                      </button>

                      {onShareFolder ? (
                        <div className="flex items-center gap-1 shrink-0">
                          {count > 0 ? (
                            <>
                              <button
                                type="button"
                                data-testid={`mobile-folder-row-share-${folder.id}`}
                                onClick={() => {
                                  onShareFolder(folder.id, folder.name, "link");
                                  onClose();
                                }}
                                className="min-h-[34px] px-2.5 rounded-lg bg-primary text-primary-foreground text-[10.5px] font-bold inline-flex items-center gap-1 shadow-xs cursor-pointer active:scale-95"
                              >
                                <Link2 className="w-3 h-3 shrink-0" />
                                <span>Compartir</span>
                              </button>
                              <button
                                type="button"
                                data-testid={`mobile-folder-row-drop-${folder.id}`}
                                aria-label={`Buzón Drop en ${folder.name}`}
                                onClick={() => {
                                  onShareFolder(folder.id, folder.name, "drop");
                                  onClose();
                                }}
                                className="min-h-[34px] w-[34px] rounded-lg border border-primary/30 bg-card text-foreground hover:bg-muted inline-flex items-center justify-center cursor-pointer active:scale-95"
                              >
                                <Download className="w-3.5 h-3.5 text-primary" />
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              data-testid={`mobile-folder-row-ask-drop-${folder.id}`}
                              onClick={() => {
                                onShareFolder(folder.id, folder.name, "drop");
                                onClose();
                              }}
                              className="min-h-[34px] px-2.5 rounded-lg border border-primary/35 bg-card text-primary text-[10.5px] font-bold inline-flex items-center gap-1 cursor-pointer active:scale-95"
                            >
                              <Download className="w-3 h-3 shrink-0" />
                              <span>Pedir Drop</span>
                            </button>
                          )}
                        </div>
                      ) : (
                        <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ================================================================
            ZONE 3: STICKY BOTTOM DOCK
            ================================================================ */}
        <div className="px-4 pt-2.5 pb-4 border-t border-border bg-card flex items-center gap-2 shrink-0 safe-area-bottom">
          <button
            type="button"
            data-testid="mobile-folder-dock-create"
            onClick={() => {
              onClose();
              onCreateFolder();
            }}
            className="shrink-0 px-3 min-h-[44px] rounded-xl border border-primary/30 bg-background text-foreground text-xs font-bold inline-flex items-center justify-center gap-1.5 whitespace-nowrap hover:bg-muted cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 text-primary shrink-0" />
            <span>Nueva Carpeta</span>
          </button>

          {onShareFolder && dockTargetFolder && (
            <button
              type="button"
              data-testid="mobile-folder-dock-share-current"
              onClick={() => {
                const targetCount = fileCountsByFolderId[dockTargetFolder.id] ?? 0;
                onShareFolder(
                  dockTargetFolder.id,
                  dockTargetFolder.name,
                  targetCount === 0 ? "drop" : "link"
                );
                onClose();
              }}
              className="flex-1 min-w-0 px-3 min-h-[44px] rounded-xl bg-primary text-primary-foreground text-xs font-bold inline-flex items-center justify-center gap-1.5 shadow-sm cursor-pointer active:scale-[0.99]"
            >
              <Share2 className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Compartir «{dockTargetFolder.name}»</span>
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

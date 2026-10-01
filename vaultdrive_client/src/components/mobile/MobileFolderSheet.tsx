import { Folder as FolderIcon, Home, Star, Share2, Plus, ChevronRight } from "lucide-react";
import { BottomSheet } from "./bottom-sheet";
import { cn } from "../../lib/utils";
import type { Folder } from "../files/FolderBreadcrumb";

export interface MobileFolderSheetProps {
  isOpen: boolean;
  onClose: () => void;
  folders: Folder[];
  currentFolderId?: string | null;
  fileCountsByFolderId?: Record<string, number>;
  allFilesCount?: number;
  starredCount?: number;
  sharedCount?: number;
  onSelectRoot: () => void;
  onSelectStarred: () => void;
  onSelectShared: () => void;
  onSelectFolder: (folderId: string, folderName: string) => void;
  onCreateFolder: () => void;
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
  onSelectRoot,
  onSelectStarred,
  onSelectShared,
  onSelectFolder,
  onCreateFolder,
}: MobileFolderSheetProps) {
  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Explorador de Bóveda"
      description="Navega por tus carpetas y archivos con un solo toque"
    >
      <div className="space-y-4 pt-1">
        {/* Quick Nav Section */}
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => {
              onSelectRoot();
              onClose();
            }}
            className={cn(
              "flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all cursor-pointer min-h-[56px] active:scale-95",
              !currentFolderId
                ? "bg-primary/10 border-primary text-primary font-semibold shadow-xs"
                : "bg-card border-border text-foreground hover:bg-muted"
            )}
          >
            <Home className="w-5 h-5 mb-1 text-primary" />
            <span className="text-xs">Principal</span>
            <span className="text-[10px] text-muted-foreground mt-0.5">({allFilesCount})</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onSelectStarred();
              onClose();
            }}
            className="flex flex-col items-center justify-center p-3 rounded-xl border border-border bg-card text-foreground hover:bg-muted text-center transition-all cursor-pointer min-h-[56px] active:scale-95"
          >
            <Star className="w-5 h-5 mb-1 text-amber-400" />
            <span className="text-xs">Destacados</span>
            <span className="text-[10px] text-muted-foreground mt-0.5">({starredCount})</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onSelectShared();
              onClose();
            }}
            className="flex flex-col items-center justify-center p-3 rounded-xl border border-border bg-card text-foreground hover:bg-muted text-center transition-all cursor-pointer min-h-[56px] active:scale-95"
          >
            <Share2 className="w-5 h-5 mb-1 text-blue-500" />
            <span className="text-xs">Compartidos</span>
            <span className="text-[10px] text-muted-foreground mt-0.5">({sharedCount})</span>
          </button>
        </div>

        {/* Folders List */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-muted-foreground tracking-wider uppercase">
              Carpetas ({folders.length})
            </span>
            <button
              type="button"
              onClick={() => {
                onClose();
                onCreateFolder();
              }}
              className="text-xs text-primary font-medium flex items-center gap-1 hover:underline cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Nueva Carpeta</span>
            </button>
          </div>

          {folders.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground text-xs bg-muted/30 rounded-xl border border-dashed border-border p-4">
              <FolderIcon className="w-8 h-8 mx-auto mb-2 text-muted-foreground/60" />
              <p>No tienes carpetas creadas en tu bóveda todavía.</p>
            </div>
          ) : (
            <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
              {folders.map((folder) => {
                const count = fileCountsByFolderId[folder.id] ?? 0;
                const isCurrent = currentFolderId === folder.id;
                return (
                  <button
                    key={folder.id}
                    type="button"
                    onClick={() => {
                      onSelectFolder(folder.id, folder.name);
                      onClose();
                    }}
                    className={cn(
                      "w-full flex items-center justify-between p-3.5 rounded-xl border transition-all cursor-pointer text-left min-h-[52px] active:scale-[0.99]",
                      isCurrent
                        ? "bg-primary/10 border-primary/50 text-foreground font-semibold"
                        : "bg-card border-border hover:bg-muted text-foreground"
                    )}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <FolderIcon className={cn("w-5 h-5 shrink-0", isCurrent ? "text-primary" : "text-muted-foreground")} />
                      <div className="truncate">
                        <p className="text-sm truncate">{folder.name}</p>
                        <p className="text-[11px] text-muted-foreground font-mono">
                          {count === 1 ? "1 archivo" : `${count} archivos`}
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </BottomSheet>
  );
}

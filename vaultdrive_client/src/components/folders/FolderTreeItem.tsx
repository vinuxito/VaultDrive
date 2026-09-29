import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { Button } from "../ui/button";
import {
  Folder,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  MoreVertical,
  FolderPlus,
  Edit2,
  Trash2,
  Share2,
  Link2,
  Upload,
  Users,
} from "lucide-react";
import type { FolderNode } from "./FolderTree";
import { playTumblerClick } from "../../utils/audioHaptics";

interface FolderTreeItemProps {
  folder: FolderNode;
  level: number;
  active?: boolean;
  showActions?: boolean;
  variant?: "default" | "sidebar";
  onToggleExpand: () => void;
  onNavigate: () => void;
  onRename: () => void;
  onDelete: () => void;
  onCreateSubfolder: () => void;
  onShare?: () => void;
  onCollectUploads?: () => void;
  onManageShares?: () => void;
  onCollaborate?: () => void;
  onContextMenu?: (e: React.MouseEvent, folder: FolderNode) => void;
}

export const FolderTreeItem: React.FC<FolderTreeItemProps> = ({
  folder,
  level,
  active = false,
  showActions = true,
  variant = "default",
  onToggleExpand,
  onNavigate,
  onRename,
  onDelete,
  onCreateSubfolder,
  onShare,
  onCollectUploads,
  onManageShares,
  onCollaborate,
  onContextMenu,
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const springTimerRef = useState<{ timer: NodeJS.Timeout | null }>({ timer: null })[0];
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuCoords, setMenuCoords] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  const updateMenuPosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const menuWidth = 192; // 12rem / w-48
    const estimatedHeight = 240;
    const spaceBelow = window.innerHeight - rect.bottom;
    const placeTop = spaceBelow < estimatedHeight && rect.top > estimatedHeight;

    const top = placeTop
      ? Math.max(8, rect.top - estimatedHeight - 4)
      : Math.min(window.innerHeight - estimatedHeight - 8, rect.bottom + 4);

    let left = rect.right - menuWidth;
    if (left < 8) left = 8;
    if (left + menuWidth > window.innerWidth - 8) {
      left = window.innerWidth - menuWidth - 8;
    }

    setMenuCoords({ top, left });
  }, []);

  const toggleMenu = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setShowMenu((prev) => {
      if (!prev) {
        updateMenuPosition();
        return true;
      }
      return false;
    });
  }, [updateMenuPosition]);

  useEffect(() => {
    if (!showMenu) return;

    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (
        menuRef.current?.contains(target) ||
        triggerRef.current?.contains(target)
      ) {
        return;
      }
      setShowMenu(false);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowMenu(false);
        triggerRef.current?.focus();
      }
    };

    const handleScrollOrResize = () => {
      setShowMenu(false);
    };

    window.addEventListener("pointerdown", handlePointerDown, true);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("scroll", handleScrollOrResize, true);
    window.addEventListener("resize", handleScrollOrResize);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown, true);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("scroll", handleScrollOrResize, true);
      window.removeEventListener("resize", handleScrollOrResize);
    };
  }, [showMenu]);

  const hasChildren = folder.children.length > 0;
  const indentPx = level * 18 + (variant === "sidebar" ? 8 : 12);
  const isSidebar = variant === "sidebar";

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);

    if (hasChildren && !folder.isExpanded && !springTimerRef.timer) {
      springTimerRef.timer = setTimeout(() => {
        onToggleExpand();
        playTumblerClick();
        springTimerRef.timer = null;
      }, 400);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (springTimerRef.timer) {
      clearTimeout(springTimerRef.timer);
      springTimerRef.timer = null;
    }
  };

  const handleDrop = (_e: React.DragEvent) => {
    setIsDragOver(false);
    if (springTimerRef.timer) {
      clearTimeout(springTimerRef.timer);
      springTimerRef.timer = null;
    }
  };

  return (
    <div
      onClick={(e) => {
        const target = e.target as HTMLElement;
        if (!target.closest("button, input, [data-prevent-folder-click]")) {
          onNavigate();
        }
      }}
      onContextMenu={(e) => {
        if (onContextMenu) {
          e.preventDefault();
          e.stopPropagation();
          onContextMenu(e, folder);
        }
      }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`group flex items-center gap-2 rounded-lg transition-all relative cursor-pointer select-none active:scale-[0.99] ${
        isDragOver
          ? "ring-2 ring-primary/80 bg-primary/20 scale-[1.01]"
          : active
            ? "bg-primary/10 text-foreground"
            : isSidebar
              ? "text-muted-foreground hover:bg-primary/8 hover:text-foreground"
              : "hover:bg-primary/5"
      } ${isSidebar ? "px-2.5 py-1.5" : "px-3 py-2"}`}
      style={{ paddingLeft: `${indentPx}px` }}
    >
      {hasChildren ? (
        <button
          type="button"
          onClick={onToggleExpand}
          className="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded transition-colors hover:bg-primary/10 cursor-pointer select-none"
          aria-label={folder.isExpanded ? "Collapse folder" : "Expand folder"}
        >
          {folder.isExpanded ? (
            <ChevronDown className={`w-4 h-4 ${active ? "text-foreground" : "text-muted-foreground"}`} />
          ) : (
            <ChevronRight className={`w-4 h-4 ${active ? "text-foreground" : "text-muted-foreground"}`} />
          )}
        </button>
      ) : (
        <div className="w-5 h-5" />
      )}

      <button
        type="button"
        onClick={onNavigate}
        className="flex-shrink-0 cursor-pointer select-none"
        aria-label={`Navigate to ${folder.name}`}
      >
        {folder.isExpanded ? (
          <FolderOpen className={`w-4 h-4 ${active ? "text-foreground" : "text-amber-500"}`} />
        ) : (
          <Folder className={`w-4 h-4 ${active ? "text-foreground" : "text-primary"}`} />
        )}
      </button>

      <button
        type="button"
        onClick={onNavigate}
        className={`flex-1 text-left truncate transition-colors cursor-pointer select-none vault-tree-node-label ${isSidebar ? "text-sm" : "text-sm"} ${
          active ? "font-medium text-foreground" : ""
        }`}
      >
        {folder.name}
      </button>

      {folder.fileCount !== undefined && folder.fileCount > 0 && (
        <span
          className={`flex-shrink-0 px-2 py-0.5 text-xs rounded-full ${
            active
              ? "bg-primary/15 text-foreground"
              : isSidebar
                ? "bg-muted text-muted-foreground"
                : "bg-primary/8 text-muted-foreground"
          }`}
        >
          {folder.fileCount}
        </span>
      )}

      {showActions && (
        <div
          data-prevent-folder-click
          className={`relative flex-shrink-0 transition-opacity ${
            active || showMenu ? "opacity-100" : "opacity-0 group-hover:opacity-100 focus-within:opacity-100"
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          <Button
            ref={triggerRef}
            variant="ghost"
            size="sm"
            onClick={toggleMenu}
            className={`h-7 w-7 p-0 cursor-pointer ${
              isSidebar ? "text-muted-foreground hover:text-foreground hover:bg-muted" : ""
            }`}
            aria-label={`Folder actions for ${folder.name}`}
            aria-expanded={showMenu}
          >
            <MoreVertical className="w-4 h-4" />
          </Button>

          {showMenu &&
            createPortal(
              <div
                ref={menuRef}
                role="menu"
                aria-label={`Actions for ${folder.name}`}
                style={{
                  position: "fixed",
                  top: `${menuCoords.top}px`,
                  left: `${menuCoords.left}px`,
                  zIndex: 9999,
                }}
                className="w-48 rounded-lg border border-border bg-popover text-popover-foreground shadow-xl overflow-hidden animate-in fade-in-0 zoom-in-95 duration-100 py-1"
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowMenu(false);
                    onCreateSubfolder();
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors text-left cursor-pointer"
                >
                  <FolderPlus className="w-4 h-4" />
                  Create Subfolder
                </button>

                {onCollectUploads && folder.fileCount === 0 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowMenu(false);
                      onCollectUploads();
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors text-left cursor-pointer"
                  >
                    <Upload className="w-4 h-4" />
                    Create Upload Link
                  </button>
                )}

                {onShare && folder.fileCount !== 0 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowMenu(false);
                      onShare();
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors text-left cursor-pointer"
                  >
                    <Share2 className="w-4 h-4" />
                    Share Folder
                  </button>
                )}

                {onManageShares && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowMenu(false);
                      onManageShares();
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors text-left cursor-pointer"
                  >
                    <Link2 className="w-4 h-4" />
                    Manage Shared Links
                  </button>
                )}

                {onCollaborate && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowMenu(false);
                      onCollaborate();
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors text-left cursor-pointer"
                  >
                    <Users className="w-4 h-4" />
                    Collaborators
                  </button>
                )}

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowMenu(false);
                    onRename();
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors text-left cursor-pointer"
                >
                  <Edit2 className="w-4 h-4" />
                  Rename
                </button>

                <div className="my-1 border-t border-border/60" />

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowMenu(false);
                    onDelete();
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-destructive/10 text-red-600 dark:text-red-400 transition-colors text-left cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              </div>,
              document.body
            )}
        </div>
      )}
    </div>
  );
};

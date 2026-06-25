import { useState } from "react";
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
} from "lucide-react";
import type { FolderNode } from "./FolderTree";

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
}) => {
  const [showMenu, setShowMenu] = useState(false);

  const hasChildren = folder.children.length > 0;
  const indentPx = level * 18 + (variant === "sidebar" ? 8 : 12);
  const isSidebar = variant === "sidebar";

  return (
    <div
      className={`group flex items-center gap-2 rounded-lg transition-colors relative ${
        active
          ? "bg-primary/10 text-primary/90"
          : isSidebar
            ? "text-muted-foreground hover:bg-primary/8 hover:text-primary"
            : "hover:bg-primary/5"
      } ${isSidebar ? "px-2.5 py-1.5" : "px-3 py-2"}`}
      style={{ paddingLeft: `${indentPx}px` }}
    >
      {hasChildren ? (
        <button
          type="button"
          onClick={onToggleExpand}
          className="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded transition-colors hover:bg-primary/10"
          aria-label={folder.isExpanded ? "Collapse folder" : "Expand folder"}
        >
          {folder.isExpanded ? (
            <ChevronDown className={`w-4 h-4 ${active ? "text-primary" : "text-muted-foreground"}`} />
          ) : (
            <ChevronRight className={`w-4 h-4 ${active ? "text-primary" : "text-muted-foreground"}`} />
          )}
        </button>
      ) : (
        <div className="w-5 h-5" />
      )}

      <button
        type="button"
        onClick={onNavigate}
        className="flex-shrink-0"
        aria-label={`Navigate to ${folder.name}`}
      >
        {folder.isExpanded ? (
          <FolderOpen className={`w-4 h-4 ${active ? "text-primary" : "text-amber-500"}`} />
        ) : (
          <Folder className={`w-4 h-4 ${active ? "text-primary" : "text-primary"}`} />
        )}
      </button>

      <button
        type="button"
        onClick={onNavigate}
        className={`flex-1 text-left truncate transition-colors ${isSidebar ? "text-sm" : "text-sm"} ${
          active ? "font-medium text-primary/90" : ""
        }`}
      >
        {folder.name}
      </button>

      {folder.fileCount !== undefined && folder.fileCount > 0 && (
        <span
          className={`flex-shrink-0 px-2 py-0.5 text-xs rounded-full ${
            active
              ? "bg-primary/15 text-primary"
              : isSidebar
                ? "bg-muted text-muted-foreground"
                : "bg-primary/8 text-muted-foreground"
          }`}
        >
          {folder.fileCount}
        </span>
      )}

      {showActions && (
        <div className={`relative flex-shrink-0 transition-opacity ${active || showMenu ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowMenu((prev) => !prev)}
            className={`h-7 w-7 p-0 ${isSidebar ? "text-muted-foreground hover:text-foreground hover:bg-muted" : ""}`}
            aria-label={`Folder actions for ${folder.name}`}
          >
            <MoreVertical className="w-4 h-4" />
          </Button>

          {showMenu && (
            <>
              <button
                type="button"
                aria-label="Close folder actions"
                className="fixed inset-0 z-10"
                onClick={() => setShowMenu(false)}
              />

              <div className="absolute right-0 top-full mt-1 w-48 rounded-lg border border-border bg-popover shadow-lg z-20 overflow-hidden">
                <button
                  type="button"
                  onClick={() => {
                    onCreateSubfolder();
                    setShowMenu(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors text-left"
                >
                  <FolderPlus className="w-4 h-4" />
                  Create Subfolder
                </button>
                {onCollectUploads && folder.fileCount === 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      onCollectUploads();
                      setShowMenu(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors text-left"
                  >
                    <Upload className="w-4 h-4" />
                    Create Upload Link
                  </button>
                )}
                {onShare && folder.fileCount !== 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      onShare();
                      setShowMenu(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors text-left"
                  >
                    <Share2 className="w-4 h-4" />
                    Share Folder
                  </button>
                )}
                {onManageShares && (
                  <button
                    type="button"
                    onClick={() => {
                      onManageShares();
                      setShowMenu(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors text-left"
                  >
                    <Link2 className="w-4 h-4" />
                    Manage Shared Links
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    onRename();
                    setShowMenu(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors text-left"
                >
                  <Edit2 className="w-4 h-4" />
                  Rename
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onDelete();
                    setShowMenu(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-destructive/10 text-red-600 dark:text-red-400 transition-colors text-left"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

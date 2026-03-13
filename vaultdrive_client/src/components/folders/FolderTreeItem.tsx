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
} from "lucide-react";
import type { FolderNode } from "./FolderTree";

interface FolderTreeItemProps {
  folder: FolderNode;
  level: number;
  onToggleExpand: () => void;
  onNavigate: () => void;
  onRename: () => void;
  onDelete: () => void;
  onCreateSubfolder: () => void;
}

export const FolderTreeItem: React.FC<FolderTreeItemProps> = ({
  folder,
  level,
  onToggleExpand,
  onNavigate,
  onRename,
  onDelete,
  onCreateSubfolder,
}) => {
  const [showMenu, setShowMenu] = useState(false);

  const hasChildren = folder.children.length > 0;
  const indentPx = level * 20 + 12;

  return (
    <div
      className="group flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-[#7d4f50]/5 transition-colors relative"
      style={{ paddingLeft: `${indentPx}px` }}
    >
      {/* Expand/collapse chevron */}
      {hasChildren ? (
        <button
          onClick={onToggleExpand}
          className="flex-shrink-0 w-5 h-5 flex items-center justify-center hover:bg-[#7d4f50]/10 rounded transition-colors"
          aria-label={folder.isExpanded ? "Collapse folder" : "Expand folder"}
        >
          {folder.isExpanded ? (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          )}
        </button>
      ) : (
        <div className="w-5 h-5" /> /* Spacer for alignment */
      )}

      {/* Folder icon */}
      <button
        onClick={onNavigate}
        className="flex-shrink-0 transition-transform hover:scale-110"
        aria-label={`Navigate to ${folder.name}`}
      >
        {folder.isExpanded ? (
          <FolderOpen className="w-5 h-5 text-yellow-500" />
        ) : (
          <Folder className="w-5 h-5 text-[#7d4f50]" />
        )}
      </button>

      {/* Folder name */}
      <button
        onClick={onNavigate}
        className="flex-1 text-left text-sm hover:text-[#c4999b] transition-colors truncate"
      >
        {folder.name}
      </button>

      {/* File count badge */}
      {folder.fileCount !== undefined && folder.fileCount > 0 && (
        <span className="flex-shrink-0 px-2 py-0.5 text-xs rounded-full bg-[#7d4f50]/8 text-muted-foreground">
          {folder.fileCount}
        </span>
      )}

      {/* Actions dropdown */}
      <div className="relative flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowMenu(!showMenu)}
          className="h-7 w-7 p-0"
        >
          <MoreVertical className="w-4 h-4" />
        </Button>

        {showMenu && (
          <>
            {/* Backdrop to close menu */}
            <div
              className="fixed inset-0 z-10"
              onClick={() => setShowMenu(false)}
            />

            {/* Dropdown menu */}
            <div className="absolute right-0 top-full mt-1 w-48 rounded-lg border bg-card shadow-lg z-20">
              <button
                onClick={() => {
                  onCreateSubfolder();
                  setShowMenu(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent transition-colors text-left"
              >
                <FolderPlus className="w-4 h-4" />
                Create Subfolder
              </button>
              <button
                onClick={() => {
                  onRename();
                  setShowMenu(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent transition-colors text-left"
              >
                <Edit2 className="w-4 h-4" />
                Rename
              </button>
              <button
                onClick={() => {
                  onDelete();
                  setShowMenu(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-destructive/10 text-destructive transition-colors text-left rounded-b-lg"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

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
  active?: boolean;
  showActions?: boolean;
  variant?: "default" | "sidebar";
  onToggleExpand: () => void;
  onNavigate: () => void;
  onRename: () => void;
  onDelete: () => void;
  onCreateSubfolder: () => void;
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
}) => {
  const [showMenu, setShowMenu] = useState(false);

  const hasChildren = folder.children.length > 0;
  const indentPx = level * 18 + (variant === "sidebar" ? 8 : 12);
  const isSidebar = variant === "sidebar";

  return (
    <div
      className={`group flex items-center gap-2 rounded-lg transition-colors relative ${
        active
          ? "bg-[#f2d7d8] text-[#6b4345]"
          : isSidebar
            ? "text-slate-600 hover:bg-[#7d4f50]/8 hover:text-[#7d4f50]"
            : "hover:bg-[#7d4f50]/5"
      } ${isSidebar ? "px-2.5 py-1.5" : "px-3 py-2"}`}
      style={{ paddingLeft: `${indentPx}px` }}
    >
      {hasChildren ? (
        <button
          onClick={onToggleExpand}
          className="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded transition-colors hover:bg-[#7d4f50]/10"
          aria-label={folder.isExpanded ? "Collapse folder" : "Expand folder"}
        >
          {folder.isExpanded ? (
            <ChevronDown className={`w-4 h-4 ${active ? "text-[#7d4f50]" : "text-slate-400"}`} />
          ) : (
            <ChevronRight className={`w-4 h-4 ${active ? "text-[#7d4f50]" : "text-slate-400"}`} />
          )}
        </button>
      ) : (
        <div className="w-5 h-5" />
      )}

      <button
        onClick={onNavigate}
        className="flex-shrink-0"
        aria-label={`Navigate to ${folder.name}`}
      >
        {folder.isExpanded ? (
          <FolderOpen className={`w-4 h-4 ${active ? "text-[#7d4f50]" : "text-amber-500"}`} />
        ) : (
          <Folder className={`w-4 h-4 ${active ? "text-[#7d4f50]" : "text-[#7d4f50]"}`} />
        )}
      </button>

      <button
        onClick={onNavigate}
        className={`flex-1 text-left truncate transition-colors ${isSidebar ? "text-sm" : "text-sm"} ${
          active ? "font-medium text-[#6b4345]" : ""
        }`}
      >
        {folder.name}
      </button>

      {folder.fileCount !== undefined && folder.fileCount > 0 && (
        <span
          className={`flex-shrink-0 px-2 py-0.5 text-xs rounded-full ${
            active
              ? "bg-[#7d4f50]/15 text-[#7d4f50]"
              : isSidebar
                ? "bg-slate-100 text-slate-500"
                : "bg-[#7d4f50]/8 text-muted-foreground"
          }`}
        >
          {folder.fileCount}
        </span>
      )}

      {showActions && (
        <div className={`relative flex-shrink-0 transition-opacity ${active ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowMenu((prev) => !prev)}
            className={`h-7 w-7 p-0 ${isSidebar ? "text-slate-400 hover:text-slate-700 hover:bg-slate-100" : ""}`}
          >
            <MoreVertical className="w-4 h-4" />
          </Button>

          {showMenu && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowMenu(false)}
              />

              <div className="absolute right-0 top-full mt-1 w-48 rounded-lg border border-slate-200 bg-white shadow-lg z-20 overflow-hidden">
                <button
                  onClick={() => {
                    onCreateSubfolder();
                    setShowMenu(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors text-left"
                >
                  <FolderPlus className="w-4 h-4" />
                  Create Subfolder
                </button>
                <button
                  onClick={() => {
                    onRename();
                    setShowMenu(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors text-left"
                >
                  <Edit2 className="w-4 h-4" />
                  Rename
                </button>
                <button
                  onClick={() => {
                    onDelete();
                    setShowMenu(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-red-50 text-red-600 transition-colors text-left"
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

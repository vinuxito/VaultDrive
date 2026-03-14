import { useMemo, useState } from "react";
import {
  Files,
  Star,
  Users,
  Link2,
  ChevronRight,
  ChevronDown,
  FolderPlus,
} from "lucide-react";
import type { Folder as FolderType } from "../files/FolderBreadcrumb";
import { FolderTree } from "../folders/FolderTree";

export type TreeNode =
  | { type: "all" }
  | { type: "starred" }
  | { type: "shared" }
  | { type: "folder"; folderId: string; folderName: string }
  | { type: "drop-link"; token: string; tokenId: string; linkName: string }
  | { type: "manage-drops" };

export interface DropTokenInfo {
  id: string;
  token: string;
  link_name?: string;
  expires_at?: { Time: string; Valid: boolean };
  used?: { Bool: boolean; Valid: boolean };
}

interface VaultTreeProps {
  selected: TreeNode;
  onSelect: (node: TreeNode) => void;
  folders: FolderType[];
  dropTokens: DropTokenInfo[];
  allFilesCount: number;
  starredCount: number;
  sharedCount: number;
  fileCountsByFolderId?: Record<string, number>;
  onCreateFolder?: () => void;
  onCreateSubfolder?: (parentId: string) => void;
  onRenameFolder?: (folderId: string, name: string) => void;
  onDeleteFolder?: (folderId: string, name: string) => void;
}

function isDropExpired(token: DropTokenInfo): boolean {
  if (!token.expires_at?.Valid) return false;
  return new Date(token.expires_at.Time) < new Date();
}

function isDropUsed(token: DropTokenInfo): boolean {
  return token.used?.Bool === true;
}

function nodeKey(node: TreeNode): string {
  if (node.type === "folder") return `folder-${node.folderId}`;
  if (node.type === "drop-link") return `drop-${node.token}`;
  return node.type;
}

function isSameNode(a: TreeNode, b: TreeNode): boolean {
  return nodeKey(a) === nodeKey(b);
}

function getDropLabel(token: DropTokenInfo): string {
  return token.link_name?.trim() || `${token.token.slice(0, 8)}...`;
}

interface TreeItemProps {
  icon: React.ReactNode;
  label: string;
  count?: number;
  depth?: number;
  active: boolean;
  onClick: () => void;
  badge?: React.ReactNode;
}

function TreeItem({ icon, label, count, depth = 0, active, onClick, badge }: TreeItemProps) {
  return (
    <button
      onClick={onClick}
      className={`
        w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-colors
        ${
          active
            ? "bg-[#f2d7d8] text-[#6b4345] font-medium"
            : "text-slate-600 hover:bg-[#7d4f50]/8 hover:text-[#7d4f50]"
        }
        ${depth > 0 ? "pl-7" : ""}
      `}
    >
      <span className={`shrink-0 ${active ? "text-[#7d4f50]" : "text-slate-400"}`}>{icon}</span>
      <span className="flex-1 text-sm truncate">{label}</span>
      {badge}
      {count !== undefined && (
        <span
          className={`text-xs font-medium px-1.5 py-0.5 rounded-full shrink-0 ${
            active ? "bg-[#7d4f50]/15 text-[#7d4f50]" : "bg-slate-100 text-slate-500"
          }`}
        >
          {count}
        </span>
      )}
    </button>
  );
}

interface SectionHeaderProps {
  label: string;
  open: boolean;
  onToggle: () => void;
  action?: React.ReactNode;
}

function SectionHeader({ label, open, onToggle, action }: SectionHeaderProps) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 group">
      <button onClick={onToggle} className="flex-1 flex items-center gap-1.5 text-left">
        <span className="text-slate-400 group-hover:text-slate-600 transition-colors">
          {open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        </span>
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 group-hover:text-slate-600 transition-colors">
          {label}
        </span>
      </button>
      {action}
    </div>
  );
}

export function VaultTree({
  selected,
  onSelect,
  folders,
  dropTokens,
  allFilesCount,
  starredCount,
  sharedCount,
  fileCountsByFolderId = {},
  onCreateFolder,
  onCreateSubfolder,
  onRenameFolder,
  onDeleteFolder,
}: VaultTreeProps) {
  const [foldersOpen, setFoldersOpen] = useState(true);
  const [linksOpen, setLinksOpen] = useState(true);

  const sortedDropTokens = useMemo(() => {
    return [...dropTokens].sort((a, b) => {
      const aInactive = isDropExpired(a) || isDropUsed(a);
      const bInactive = isDropExpired(b) || isDropUsed(b);

      if (aInactive !== bInactive) {
        return aInactive ? 1 : -1;
      }

      return getDropLabel(a).localeCompare(getDropLabel(b));
    });
  }, [dropTokens]);

  return (
    <nav className="h-full flex flex-col gap-0.5 py-3 px-2 overflow-y-auto">
      <div className="px-3 pb-2 mb-1">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Quick Access</p>
      </div>

      <TreeItem
        icon={<Files className="w-4 h-4" />}
        label="All Files"
        count={allFilesCount}
        active={isSameNode(selected, { type: "all" })}
        onClick={() => onSelect({ type: "all" })}
      />

      <TreeItem
        icon={<Star className="w-4 h-4" />}
        label="Starred"
        count={starredCount}
        active={isSameNode(selected, { type: "starred" })}
        onClick={() => onSelect({ type: "starred" })}
      />

      <div className="my-2 mx-3 border-t border-slate-200" />

      <SectionHeader
        label="My Folders"
        open={foldersOpen}
        onToggle={() => setFoldersOpen((open) => !open)}
        action={
          onCreateFolder ? (
            <button
              onClick={(event) => {
                event.stopPropagation();
                onCreateFolder();
              }}
              className="h-6 w-6 rounded-md inline-flex items-center justify-center text-slate-400 hover:text-[#7d4f50] hover:bg-[#7d4f50]/8 transition-colors"
              aria-label="Create folder"
              title="Create folder"
            >
              <FolderPlus className="w-3.5 h-3.5" />
            </button>
          ) : null
        }
      />

      {foldersOpen && folders.length === 0 && <p className="text-xs text-slate-400 px-7 py-1">No folders yet</p>}

      {foldersOpen && folders.length > 0 && onCreateSubfolder && onRenameFolder && onDeleteFolder && (
        <div className="px-1">
          <FolderTree
            folders={folders}
            activeFolderId={selected.type === "folder" ? selected.folderId : null}
            countsByFolderId={fileCountsByFolderId}
            showActions
            variant="sidebar"
            onNavigateToFolder={(folderId) => {
              const folder = folders.find((entry) => entry.id === folderId);
              if (!folder) return;
              onSelect({ type: "folder", folderId, folderName: folder.name });
            }}
            onRenameFolder={onRenameFolder}
            onDeleteFolder={onDeleteFolder}
            onCreateSubfolder={onCreateSubfolder}
          />
        </div>
      )}

      <div className="my-2 mx-3 border-t border-slate-200" />

      <TreeItem
        icon={<Users className="w-4 h-4" />}
        label="Shared with Me"
        count={sharedCount}
        active={isSameNode(selected, { type: "shared" })}
        onClick={() => onSelect({ type: "shared" })}
      />

      <div className="my-2 mx-3 border-t border-slate-200" />

      <SectionHeader
        label="Drop Links"
        open={linksOpen}
        onToggle={() => setLinksOpen((open) => !open)}
        action={
          <button
            onClick={() => onSelect({ type: "manage-drops" })}
            className={`text-xs px-1.5 py-0.5 rounded-md transition-colors ${
              isSameNode(selected, { type: "manage-drops" })
                ? "bg-[#7d4f50]/15 text-[#7d4f50] font-medium"
                : "text-slate-400 hover:text-[#7d4f50] hover:bg-[#7d4f50]/8"
            }`}
          >
            Manage
          </button>
        }
      />

      {linksOpen && sortedDropTokens.length === 0 && <p className="text-xs text-slate-400 px-7 py-1">No drop links</p>}

      {linksOpen &&
        sortedDropTokens.map((token) => {
          const expired = isDropExpired(token);
          const used = isDropUsed(token);
          const inactive = expired || used;
          const label = getDropLabel(token);

          return (
            <TreeItem
              key={token.id}
              icon={<Link2 className="w-4 h-4" />}
              label={label}
              depth={1}
              active={isSameNode(selected, {
                type: "drop-link",
                token: token.token,
                tokenId: token.id,
                linkName: label,
              })}
              onClick={() =>
                onSelect({
                  type: "drop-link",
                  token: token.token,
                  tokenId: token.id,
                  linkName: label,
                })
              }
              badge={
                inactive ? (
                  <span className="text-xs px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 shrink-0">
                    {used ? "used" : "expired"}
                  </span>
                ) : (
                  <span className="text-xs px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600 shrink-0">
                    active
                  </span>
                )
              }
            />
          );
        })}
    </nav>
  );
}

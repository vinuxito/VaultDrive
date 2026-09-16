import { useMemo, useState } from "react";
import {
  Files,
  Star,
  Users,
  Link2,
  ChevronRight,
  ChevronDown,
  FolderPlus,
  Inbox,
} from "lucide-react";
import type { Folder as FolderType } from "../files/FolderBreadcrumb";
import { FolderTree } from "../folders/FolderTree";
import { useTranslation } from "react-i18next";

export type TreeNode =
  | { type: "all" }
  | { type: "starred" }
  | { type: "shared" }
  | { type: "folder"; folderId: string; folderName: string }
  | { type: "manage-folder-shares"; folderId: string; folderName: string }
  | { type: "drop-link"; token: string; tokenId: string; linkName: string }
  | { type: "manage-drops" }
  | { type: "manage-requests" };

export interface DropTokenInfo {
  id: string;
  token: string;
  link_name?: string;
  expires_at?: { Time: string; Valid: boolean };
  used?: { Bool: boolean; Valid: boolean };
  files_uploaded?: { Int32: number; Valid: boolean };
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
  onShareFolder?: (folderId: string, name: string) => void;
  onCollectUploadsForFolder?: (folderId: string, name: string) => void;
  onManageShareFolder?: (folderId: string, name: string) => void;
  onCollaborateFolder?: (folderId: string, name: string) => void;
}

function isDropExpired(token: DropTokenInfo): boolean {
  if (!token.expires_at?.Valid) return false;
  return new Date(token.expires_at.Time) < new Date();
}

function isDropUsed(token: DropTokenInfo): boolean {
  return token.used?.Bool === true;
}

function isDropExpiringSoon(token: DropTokenInfo): boolean {
  if (!token.expires_at?.Valid) return false;
  const exp = new Date(token.expires_at.Time);
  const in48h = new Date(Date.now() + 48 * 60 * 60 * 1000);
  return exp > new Date() && exp < in48h;
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
      type="button"
      onClick={onClick}
      className={`
        w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-colors cursor-pointer select-none active:scale-[0.99]
        ${
          active
            ? "bg-primary/10 text-foreground font-medium"
            : "text-muted-foreground hover:bg-primary/8 hover:text-foreground"
        }
        ${depth > 0 ? "pl-7" : ""}
      `}
      aria-current={active ? "page" : undefined}
    >
      <span className={`shrink-0 ${active ? "text-foreground" : "text-muted-foreground"}`}>{icon}</span>
      <span className="flex-1 text-sm truncate">{label}</span>
      {badge}
      {count !== undefined && (
        <span
          className={`text-xs font-medium px-1.5 py-0.5 rounded-full shrink-0 ${
            active ? "bg-primary/15 text-foreground" : "bg-muted text-muted-foreground"
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
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex-1 flex items-center gap-1.5 text-left cursor-pointer select-none">
        <span className="text-muted-foreground group-hover:text-foreground transition-colors">
          {open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        </span>
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground group-hover:text-foreground transition-colors">
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
  onShareFolder,
  onCollectUploadsForFolder,
  onManageShareFolder,
  onCollaborateFolder,
}: VaultTreeProps) {
  const { t } = useTranslation(["drive"]);
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
    <nav aria-label={t("drive:vault.tree.navigation", "Vault navigation")} className="h-full flex flex-col gap-0.5 py-3 px-2 overflow-y-auto">
      <div className="px-3 pb-2 mb-1">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("drive:vault.tree.quickAccess", "Quick access")}</p>
      </div>

      <TreeItem
        icon={<Files className="w-4 h-4" />}
        label={t("drive:vault.filterAll", "All Files")}
        count={allFilesCount}
        active={isSameNode(selected, { type: "all" })}
        onClick={() => onSelect({ type: "all" })}
      />

      <TreeItem
        icon={<Star className="w-4 h-4" />}
        label={t("drive:vault.tree.starred", "Starred")}
        count={starredCount}
        active={isSameNode(selected, { type: "starred" })}
        onClick={() => onSelect({ type: "starred" })}
      />

      <div className="my-2 mx-3 border-t border-border" />

      <SectionHeader
        label={t("drive:vault.tree.myFolders", "My folders")}
        open={foldersOpen}
        onToggle={() => setFoldersOpen((open) => !open)}
        action={
          onCreateFolder ? (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onCreateFolder();
              }}
              className="h-6 w-6 rounded-md inline-flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/8 transition-colors cursor-pointer select-none"
              aria-label={t("drive:vault.tree.createFolder", "Create folder")}
              title={t("drive:vault.tree.createFolder", "Create folder")}
            >
              <FolderPlus className="w-3.5 h-3.5" />
            </button>
          ) : null
        }
      />

      {foldersOpen && folders.length === 0 && <p className="text-xs text-muted-foreground px-7 py-1">{t("drive:vault.tree.noFolders", "No folders yet")}</p>}

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
            onShareFolder={onShareFolder}
            onCollectUploadsForFolder={onCollectUploadsForFolder}
            onManageShareFolder={onManageShareFolder}
            onCollaborateFolder={onCollaborateFolder}
          />
        </div>
      )}

      <div className="my-2 mx-3 border-t border-border" />

      <TreeItem
        icon={<Users className="w-4 h-4" />}
        label={t("drive:vault.tree.shared", "Shared with me")}
        count={sharedCount}
        active={isSameNode(selected, { type: "shared" })}
        onClick={() => onSelect({ type: "shared" })}
      />

      <div className="my-2 mx-3 border-t border-border" />

      <SectionHeader
        label={t("drive:vault.tree.uploadLinks", "Client upload links")}
        open={linksOpen}
        onToggle={() => setLinksOpen((open) => !open)}
        action={
          <button
            type="button"
            onClick={() => onSelect({ type: "manage-drops" })}
            className={`text-xs px-1.5 py-0.5 rounded-md transition-colors cursor-pointer select-none ${
              isSameNode(selected, { type: "manage-drops" })
                ? "bg-primary/15 text-foreground font-medium"
                : "text-muted-foreground hover:text-foreground hover:bg-primary/8"
            }`}
          >
            {t("drive:vault.tree.manage", "Manage")}
          </button>
        }
      />

      {linksOpen && sortedDropTokens.length === 0 && <p className="text-xs text-muted-foreground px-7 py-1">{t("drive:vault.tree.noUploadLinks", "No upload links yet")}</p>}

      {linksOpen &&
        sortedDropTokens.map((token) => {
          const expired = isDropExpired(token);
          const used = isDropUsed(token);
          const expiringSoon = !expired && !used && isDropExpiringSoon(token);
          const inactive = expired || used;
          const label = getDropLabel(token);

          const badge = inactive ? (
            <span className="text-xs px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground shrink-0">
              {used ? t("drive:vault.tree.sealed", "sealed") : t("drive:vault.tree.expired", "expired")}
            </span>
          ) : expiringSoon ? (
            <span className="text-xs px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 shrink-0">
              {t("drive:vault.tree.expiring", "expiring")}
            </span>
          ) : (
            <span className="text-xs px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 shrink-0">
              {t("drive:vault.tree.active", "active")}
            </span>
          );

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
              badge={badge}
            />
          );
        })}

      <div className="my-2 mx-3 border-t border-border" />

      <SectionHeader
        label={t("drive:vault.tree.fileRequests", "File requests")}
        open={true}
        onToggle={() => undefined}
        action={
          <button
            type="button"
            onClick={() => onSelect({ type: "manage-requests" })}
            className={`text-xs px-1.5 py-0.5 rounded-md transition-colors ${
              isSameNode(selected, { type: "manage-requests" })
                ? "bg-primary/15 text-foreground font-medium"
                : "text-muted-foreground hover:text-foreground hover:bg-primary/8"
            }`}
          >
            {t("drive:vault.tree.manage", "Manage")}
          </button>
        }
      />
      <TreeItem
        icon={<Inbox className="w-4 h-4" />}
        label={t("drive:vault.tree.manageRequests", "Manage requests")}
        active={isSameNode(selected, { type: "manage-requests" })}
        onClick={() => onSelect({ type: "manage-requests" })}
        depth={1}
      />
    </nav>
  );
}

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
  Search,
  Folder as FolderIcon,
  ShieldCheck,
} from "lucide-react";
import type { Folder as FolderType } from "../files/FolderBreadcrumb";
import { FolderTree } from "../folders/FolderTree";
import { useTranslation } from "react-i18next";
import { formatBytes } from "../../utils/format";

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
  dropReceivedCount?: number;
  totalBytesUsed?: number;
  pinnedFolderIds?: string[];
  onFilterDropReceived?: () => void;
  isDropFilterActive?: boolean;
  fileCountsByFolderId?: Record<string, number>;
  onCreateFolder?: () => void;
  onCreateSubfolder?: (parentId: string) => void;
  onRenameFolder?: (folderId: string, name: string) => void;
  onDeleteFolder?: (folderId: string, name: string) => void;
  onShareFolder?: (folderId: string, name: string) => void;
  onCollectUploadsForFolder?: (folderId: string, name: string) => void;
  onManageShareFolder?: (folderId: string, name: string) => void;
  onCollaborateFolder?: (folderId: string, name: string) => void;
  onContextMenuFolder?: (e: React.MouseEvent, folderId: string, folderName: string) => void;
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
  onContextMenu?: (e: React.MouseEvent) => void;
  badge?: React.ReactNode;
}

function TreeItem({ icon, label, count, depth = 0, active, onClick, onContextMenu, badge }: TreeItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      onContextMenu={onContextMenu}
      className={`
        w-full flex items-center gap-2 rounded-[8px] px-2.5 py-[6.5px] text-left transition-colors cursor-pointer select-none border
        ${
          active
            ? "bg-primary/10 text-foreground font-bold border-primary/30"
            : "border-transparent text-muted-foreground hover:bg-primary/8 hover:text-foreground hover:border-border"
        }
        ${depth > 0 ? "pl-6" : ""}
      `}
      aria-current={active ? "page" : undefined}
    >
      <span className={`shrink-0 ${active ? "text-primary" : "text-muted-foreground"}`}>{icon}</span>
      <span className="flex-1 text-[12px] truncate">{label}</span>
      {badge}
      {count !== undefined && (
        <span
          className={`abrn-mono text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${
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
    <div className="flex items-center gap-2 px-2 py-1 group">
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex-1 flex items-center gap-1.5 text-left cursor-pointer select-none">
        <span className="text-muted-foreground group-hover:text-foreground transition-colors">
          {open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        </span>
        <span className="text-[10px] font-extrabold uppercase tracking-[0.07em] text-muted-foreground group-hover:text-foreground transition-colors">
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
  dropReceivedCount = 0,
  totalBytesUsed = 0,
  pinnedFolderIds = [],
  onFilterDropReceived,
  isDropFilterActive = false,
  fileCountsByFolderId = {},
  onCreateFolder,
  onCreateSubfolder,
  onRenameFolder,
  onDeleteFolder,
  onShareFolder,
  onCollectUploadsForFolder,
  onManageShareFolder,
  onCollaborateFolder,
  onContextMenuFolder,
}: VaultTreeProps) {
  const { t } = useTranslation(["drive"]);
  const [foldersOpen, setFoldersOpen] = useState(true);
  const [linksOpen, setLinksOpen] = useState(true);
  const [folderQuery, setFolderQuery] = useState("");

  const filteredFolders = useMemo(() => {
    const q = folderQuery.trim().toLowerCase();
    if (!q) return folders;
    const matchingIds = new Set<string>();
    for (const f of folders) {
      if (f.name.toLowerCase().includes(q)) {
        matchingIds.add(f.id);
        let pid = f.parentId;
        while (pid) {
          matchingIds.add(pid);
          const parent = folders.find((x) => x.id === pid);
          pid = parent?.parentId ?? null;
        }
      }
    }
    return folders.filter((f) => matchingIds.has(f.id));
  }, [folders, folderQuery]);

  const pinnedFolders = useMemo(() => {
    if (!pinnedFolderIds.length) return [];
    const set = new Set(pinnedFolderIds);
    return filteredFolders.filter((f) => set.has(f.id));
  }, [filteredFolders, pinnedFolderIds]);

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

  const quotaBytes = 100 * 1024 * 1024 * 1024;
  const usedPercent = Math.min(100, Math.max(2, Math.round((totalBytesUsed / quotaBytes) * 100)));

  return (
    <nav
      aria-label={t("drive:vault.tree.navigation", "Vault navigation")}
      style={{ background: "var(--abrn-card)" }}
      className="h-full flex flex-col min-h-0"
    >
      {/* Top Kicker + "+ Carpeta" + Instant Client/Folder Filter */}
      <div
        style={{ borderColor: "var(--abrn-border)" }}
        className="p-2.5 pb-2 border-b flex flex-col gap-1.5 shrink-0"
      >
        <div className="flex items-center justify-between gap-2">
          <span
            style={{ color: "var(--abrn-primary-soft)" }}
            className="text-[10px] font-extrabold uppercase tracking-[0.07em]"
          >
            Clientes y Carpetas
          </span>
          {onCreateFolder && (
            <button
              type="button"
              data-testid="tree-new-folder-btn"
              onClick={(event) => {
                event.stopPropagation();
                onCreateFolder();
              }}
              aria-label={t("drive:vault.tree.createFolder", "Create folder")}
              title="Crear cliente o carpeta con 5 subcarpetas base"
              className="abrn-btn abrn-btn-soft !h-6 !px-2 !text-[10.5px] !rounded-[6px]"
            >
              <FolderPlus className="w-3 h-3" />
              <span>+ Carpeta</span>
            </button>
          )}
        </div>

        <div className="relative flex items-center">
          <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-2.5 pointer-events-none" />
          <input
            type="text"
            value={folderQuery}
            onChange={(e) => setFolderQuery(e.target.value)}
            placeholder="Ir rápido a carpeta o cliente…"
            aria-label="Filtrar carpetas o clientes"
            style={{ background: "var(--abrn-bg)", borderColor: "var(--abrn-border)" }}
            className="w-full h-[31px] pl-8 pr-2.5 rounded-[7px] border text-[11.5px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
          />
        </div>
      </div>

      {/* Scrollable Tree Sections */}
      <div className="flex-1 overflow-y-auto [scrollbar-width:thin] px-2 py-2 flex flex-col gap-1 min-h-0">
        {pinnedFolders.length > 0 && (
          <div className="mb-1.5">
            <div className="flex items-center justify-between px-2 pb-1 text-[9.5px] font-extrabold uppercase tracking-[0.07em] text-muted-foreground">
              <span>Fijados ★</span>
              <span>{pinnedFolders.length}</span>
            </div>
            <div className="flex flex-col gap-0.5">
              {pinnedFolders.map((folder) => {
                const isActive = selected.type === "folder" && selected.folderId === folder.id;
                return (
                  <TreeItem
                    key={`pin-${folder.id}`}
                    icon={<FolderIcon className="w-3.5 h-3.5" style={{ color: "var(--abrn-gold)" }} />}
                    label={folder.name}
                    count={fileCountsByFolderId[folder.id] ?? 0}
                    active={isActive}
                    onClick={() => onSelect({ type: "folder", folderId: folder.id, folderName: folder.name })}
                    onContextMenu={(e) => onContextMenuFolder?.(e, folder.id, folder.name)}
                  />
                );
              })}
            </div>
          </div>
        )}

        <SectionHeader
          label={t("drive:vault.tree.myFolders", "My folders")}
          open={foldersOpen}
          onToggle={() => setFoldersOpen((open) => !open)}
        />

        {foldersOpen && filteredFolders.length === 0 && (
          <p className="text-xs text-muted-foreground px-4 py-1">
            {folderQuery ? "Sin coincidencias" : t("drive:vault.tree.noFolders", "No folders yet")}
          </p>
        )}

        {foldersOpen && filteredFolders.length > 0 && onCreateSubfolder && onRenameFolder && onDeleteFolder && (
          <div className="px-0.5">
            <FolderTree
              folders={filteredFolders}
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
              onContextMenuFolder={onContextMenuFolder}
            />
          </div>
        )}

        <div className="my-1.5 mx-2 border-t border-border" />

        <div className="px-2 pb-0.5 text-[9.5px] font-extrabold uppercase tracking-[0.07em] text-muted-foreground">
          {t("drive:vault.tree.quickAccess", "Quick access")}
        </div>

        <TreeItem
          icon={<Files className="w-4 h-4" />}
          label={t("drive:vault.filterAll", "All Files")}
          count={allFilesCount}
          active={isSameNode(selected, { type: "all" }) && !isDropFilterActive}
          onClick={() => onSelect({ type: "all" })}
        />

        <TreeItem
          icon={<Star className="w-4 h-4" style={{ color: "var(--abrn-gold)" }} />}
          label={t("drive:vault.tree.starred", "Starred")}
          count={starredCount}
          active={isSameNode(selected, { type: "starred" })}
          onClick={() => onSelect({ type: "starred" })}
        />

        {onFilterDropReceived && (
          <TreeItem
            icon={<Inbox className="w-4 h-4" style={{ color: "var(--abrn-emerald)" }} />}
            label="Recibidos vía Drop"
            active={isDropFilterActive}
            onClick={onFilterDropReceived}
            badge={
              <span
                style={{
                  background: "var(--abrn-emerald-bg)",
                  color: "var(--abrn-emerald)",
                  borderColor: "var(--abrn-emerald-bd)",
                }}
                className="text-[9.5px] font-extrabold px-1.5 py-0.5 rounded-full border shrink-0"
              >
                {dropReceivedCount}
              </span>
            }
          />
        )}

        <TreeItem
          icon={<Users className="w-4 h-4" />}
          label={t("drive:vault.tree.shared", "Shared with me")}
          count={sharedCount}
          active={isSameNode(selected, { type: "shared" })}
          onClick={() => onSelect({ type: "shared" })}
        />

        <div className="my-1.5 mx-2 border-t border-border" />

        <SectionHeader
          label={t("drive:vault.tree.uploadLinks", "Client upload links")}
          open={linksOpen}
          onToggle={() => setLinksOpen((open) => !open)}
          action={
            <button
              type="button"
              onClick={() => onSelect({ type: "manage-drops" })}
              className={`text-[10.5px] px-1.5 py-0.5 rounded-md transition-colors cursor-pointer select-none ${
                isSameNode(selected, { type: "manage-drops" })
                  ? "bg-primary/15 text-foreground font-semibold"
                  : "text-muted-foreground hover:text-foreground hover:bg-primary/8"
              }`}
            >
              {t("drive:vault.tree.manage", "Manage")}
            </button>
          }
        />

        {linksOpen && sortedDropTokens.length === 0 && (
          <p className="text-[11px] text-muted-foreground px-4 py-1">
            {t("drive:vault.tree.noUploadLinks", "No upload links yet")}
          </p>
        )}

        {linksOpen &&
          sortedDropTokens.map((token) => {
            const expired = isDropExpired(token);
            const used = isDropUsed(token);
            const expiringSoon = !expired && !used && isDropExpiringSoon(token);
            const inactive = expired || used;
            const label = getDropLabel(token);

            const badge = inactive ? (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground shrink-0">
                {used ? t("drive:vault.tree.sealed", "sealed") : t("drive:vault.tree.expired", "expired")}
              </span>
            ) : expiringSoon ? (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 shrink-0">
                {t("drive:vault.tree.expiring", "expiring")}
              </span>
            ) : (
              <span
                style={{
                  background: "var(--abrn-emerald-bg)",
                  color: "var(--abrn-emerald)",
                  borderColor: "var(--abrn-emerald-bd)",
                }}
                className="text-[9.5px] font-bold px-1.5 py-0.5 rounded-full border shrink-0"
              >
                {t("drive:vault.tree.active", "active")}
              </span>
            );

            return (
              <TreeItem
                key={token.id}
                icon={<Link2 className="w-3.5 h-3.5" />}
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

        <div className="my-1.5 mx-2 border-t border-border" />

        <SectionHeader
          label={t("drive:vault.tree.fileRequests", "File requests")}
          open={true}
          onToggle={() => undefined}
          action={
            <button
              type="button"
              onClick={() => onSelect({ type: "manage-requests" })}
              className={`text-[10.5px] px-1.5 py-0.5 rounded-md transition-colors cursor-pointer ${
                isSameNode(selected, { type: "manage-requests" })
                  ? "bg-primary/15 text-foreground font-semibold"
                  : "text-muted-foreground hover:text-foreground hover:bg-primary/8"
              }`}
            >
              {t("drive:vault.tree.manage", "Manage")}
            </button>
          }
        />
        <TreeItem
          icon={<Inbox className="w-3.5 h-3.5" />}
          label={t("drive:vault.tree.manageRequests", "Manage requests")}
          active={isSameNode(selected, { type: "manage-requests" })}
          onClick={() => onSelect({ type: "manage-requests" })}
          depth={1}
        />
      </div>

      {/* Encrypted Vault Footer */}
      <div
        style={{ background: "var(--abrn-bg-elevated)", borderColor: "var(--abrn-border)" }}
        className="px-2.5 py-2 border-t text-[10.5px] text-muted-foreground flex flex-col gap-1 shrink-0"
      >
        <div className="flex items-center justify-between gap-2">
          <span>Espacio cifrado</span>
          <strong className="abrn-mono text-foreground font-bold">
            {formatBytes(totalBytesUsed)} / 100 GB
          </strong>
        </div>
        <div className="h-[5px] rounded-full bg-muted overflow-hidden">
          <div
            style={{ width: `${usedPercent}%`, background: "var(--abrn-primary)" }}
            className="h-full rounded-full transition-all"
          />
        </div>
        <div className="flex items-center gap-1.5 pt-0.5">
          <ShieldCheck className="w-3 h-3 shrink-0" style={{ color: "var(--abrn-emerald)" }} />
          <span className="truncate">Clic derecho en carpeta para opciones</span>
        </div>
      </div>
    </nav>
  );
}

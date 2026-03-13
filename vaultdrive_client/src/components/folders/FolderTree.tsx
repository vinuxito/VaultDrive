import { useMemo, useState } from "react";
import { FolderTreeItem } from "./FolderTreeItem";
import type { Folder } from "../files/FolderBreadcrumb";

export interface FolderNode {
  id: string;
  name: string;
  parentId: string | null;
  children: FolderNode[];
  fileCount?: number;
  isExpanded: boolean;
}

interface FolderTreeProps {
  folders: Folder[];
  activeFolderId?: string | null;
  countsByFolderId?: Record<string, number>;
  showActions?: boolean;
  variant?: "default" | "sidebar";
  onNavigateToFolder: (folderId: string) => void;
  onRenameFolder: (folderId: string, name: string) => void;
  onDeleteFolder: (folderId: string, name: string) => void;
  onCreateSubfolder: (parentId: string) => void;
}

function getActivePathIds(folders: Folder[], activeFolderId?: string | null): Set<string> {
  if (!activeFolderId) return new Set();

  const folderById = new Map(folders.map((folder) => [folder.id, folder]));
  const activePathIds = new Set<string>();
  let currentId: string | null | undefined = activeFolderId;

  while (currentId) {
    activePathIds.add(currentId);
    currentId = folderById.get(currentId)?.parentId;
  }

  return activePathIds;
}

function aggregateFileCounts(node: FolderNode): number {
  const childCount = node.children.reduce((sum, child) => sum + aggregateFileCounts(child), 0);
  const ownCount = node.fileCount ?? 0;
  node.fileCount = ownCount + childCount;
  return node.fileCount;
}

export const FolderTree: React.FC<FolderTreeProps> = ({
  folders,
  activeFolderId,
  countsByFolderId = {},
  showActions = true,
  variant = "default",
  onNavigateToFolder,
  onRenameFolder,
  onDeleteFolder,
  onCreateSubfolder,
}) => {
  const [expandedFolders, setExpandedFolders] = useState<Set<string> | null>(null);

  const initialExpandedFolders = useMemo(
    () => new Set(folders.filter((folder) => !folder.parentId).map((folder) => folder.id)),
    [folders]
  );
  const effectiveExpandedFolders = expandedFolders ?? initialExpandedFolders;

  const activePathIds = useMemo(
    () => getActivePathIds(folders, activeFolderId),
    [folders, activeFolderId]
  );

  const tree = useMemo(() => {
    const folderMap = new Map<string, FolderNode>();
    const rootFolders: FolderNode[] = [];

    folders.forEach((folder) => {
      folderMap.set(folder.id, {
        id: folder.id,
        name: folder.name,
        parentId: folder.parentId,
        children: [],
        fileCount: countsByFolderId[folder.id] ?? 0,
        isExpanded: effectiveExpandedFolders.has(folder.id) || activePathIds.has(folder.id),
      });
    });

    folders.forEach((folder) => {
      const node = folderMap.get(folder.id);
      if (!node) return;

      if (folder.parentId) {
        const parent = folderMap.get(folder.parentId);
        if (parent) {
          parent.children.push(node);
        } else {
          rootFolders.push(node);
        }
      } else {
        rootFolders.push(node);
      }
    });

    const sortNodes = (nodes: FolderNode[]) => {
      nodes.sort((a, b) => a.name.localeCompare(b.name));
      nodes.forEach((node) => {
        sortNodes(node.children);
        aggregateFileCounts(node);
      });
    };

    sortNodes(rootFolders);
    return rootFolders;
  }, [activePathIds, countsByFolderId, effectiveExpandedFolders, folders]);

  const toggleExpand = (folderId: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev ?? initialExpandedFolders);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  };

  const renderFolderNode = (node: FolderNode, level = 0) => (
    <div key={node.id}>
      <FolderTreeItem
        folder={node}
        level={level}
        active={activeFolderId === node.id}
        showActions={showActions}
        variant={variant}
        onToggleExpand={() => toggleExpand(node.id)}
        onNavigate={() => onNavigateToFolder(node.id)}
        onRename={() => onRenameFolder(node.id, node.name)}
        onDelete={() => onDeleteFolder(node.id, node.name)}
        onCreateSubfolder={() => onCreateSubfolder(node.id)}
      />
      {node.isExpanded && node.children.map((child) => renderFolderNode(child, level + 1))}
    </div>
  );

  return <div className="space-y-1">{tree.map((node) => renderFolderNode(node))}</div>;
};

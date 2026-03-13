import { useState } from "react";
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
  onNavigateToFolder: (folderId: string) => void;
  onRenameFolder: (folderId: string, name: string) => void;
  onDeleteFolder: (folderId: string, name: string) => void;
  onCreateSubfolder: (parentId: string) => void;
}

export const FolderTree: React.FC<FolderTreeProps> = ({
  folders,
  onNavigateToFolder,
  onRenameFolder,
  onDeleteFolder,
  onCreateSubfolder,
}) => {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    new Set()
  );

  // Build folder tree from flat list
  const buildFolderTree = (folders: Folder[]): FolderNode[] => {
    const folderMap = new Map<string, FolderNode>();
    const rootFolders: FolderNode[] = [];

    // Create nodes
    folders.forEach((folder) => {
      folderMap.set(folder.id, {
        id: folder.id,
        name: folder.name,
        parentId: folder.parentId,
        children: [],
        fileCount: 0, // TODO: Calculate from files
        isExpanded: expandedFolders.has(folder.id),
      });
    });

    // Build hierarchy
    folders.forEach((folder) => {
      const node = folderMap.get(folder.id)!;
      if (folder.parentId) {
        const parent = folderMap.get(folder.parentId);
        if (parent) {
          parent.children.push(node);
        } else {
          // Parent not found, treat as root
          rootFolders.push(node);
        }
      } else {
        rootFolders.push(node);
      }
    });

    // Sort by name
    const sortNodes = (nodes: FolderNode[]) => {
      nodes.sort((a, b) => a.name.localeCompare(b.name));
      nodes.forEach((node) => sortNodes(node.children));
    };
    sortNodes(rootFolders);

    return rootFolders;
  };

  const toggleExpand = (folderId: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  };

  const renderFolderNode = (node: FolderNode, level: number = 0) => {
    return (
      <div key={node.id}>
        <FolderTreeItem
          folder={node}
          level={level}
          onToggleExpand={() => toggleExpand(node.id)}
          onNavigate={() => onNavigateToFolder(node.id)}
          onRename={() => onRenameFolder(node.id, node.name)}
          onDelete={() => onDeleteFolder(node.id, node.name)}
          onCreateSubfolder={() => onCreateSubfolder(node.id)}
        />
        {node.isExpanded &&
          node.children.map((child) => renderFolderNode(child, level + 1))}
      </div>
    );
  };

  const tree = buildFolderTree(folders);

  return (
    <div className="space-y-1">
      {tree.map((node) => renderFolderNode(node))}
    </div>
  );
};

import type { Folder } from "../components/files/FolderBreadcrumb";

export interface MoveTargetOption {
  id: string;
  name: string;
  depth: number;
}

export function buildMoveTargetOptions(folders: Folder[], currentFolderId?: string | null): MoveTargetOption[] {
  const childrenByParent = new Map<string | null, Folder[]>();
  for (const folder of folders) {
    const parentKey = folder.parentId ? folder.parentId : null;
    const siblings = childrenByParent.get(parentKey) ?? [];
    siblings.push(folder);
    childrenByParent.set(parentKey, siblings);
  }

  for (const siblings of childrenByParent.values()) {
    siblings.sort((a, b) => a.name.localeCompare(b.name));
  }

  const result: MoveTargetOption[] = [];
  const visit = (parentId: string | null, depth: number) => {
    const children = childrenByParent.get(parentId) ?? [];
    for (const child of children) {
      if (child.id !== currentFolderId) {
        result.push({ id: child.id, name: child.name, depth });
      }
      visit(child.id, depth + 1);
    }
  };

  visit(null, 0);
  return result;
}

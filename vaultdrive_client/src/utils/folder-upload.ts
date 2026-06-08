import { API_URL } from "./api";

interface FolderInfo {
  id: string;
  name: string;
  parentId: string | null;
}

/**
 * Given a list of files with webkitRelativePath set, creates any missing
 * folders in the vault and returns a map from directory path to folder ID.
 *
 * Example: file with webkitRelativePath "ProjectX/src/index.ts"
 *  - ensures folders "ProjectX" and "ProjectX/src" exist
 *  - maps "ProjectX/src" → <folder-id>
 *
 * @param files       Files with webkitRelativePath populated
 * @param rootFolderId  If uploading into a specific folder, its ID; null for vault root
 * @param existingFolders  Current user folders (avoids re-fetching)
 * @returns Map<string, string> from relative dir path → folder UUID
 */
export async function ensureFolderStructure(
  files: File[],
  rootFolderId: string | null,
  existingFolders: FolderInfo[]
): Promise<Map<string, string>> {
  const token = localStorage.getItem("token");
  if (!token) throw new Error("Not authenticated");

  // Collect unique directory paths from all files
  const dirPaths = new Set<string>();
  for (const file of files) {
    const rel =
      (file as File & { webkitRelativePath?: string }).webkitRelativePath || "";
    if (!rel) continue;
    // e.g. "ProjectX/src/index.ts" → dir = "ProjectX/src"
    const parts = rel.split("/");
    // Build each ancestor path
    for (let i = 1; i < parts.length; i++) {
      dirPaths.add(parts.slice(0, i).join("/"));
    }
  }

  if (dirPaths.size === 0) return new Map();

  // Sort paths by depth so parents are created before children
  const sortedPaths = Array.from(dirPaths).sort(
    (a, b) => a.split("/").length - b.split("/").length
  );

  // Build a lookup of existing folders by (parentId, name) for dedup
  const existingByKey = new Map<string, string>();
  for (const f of existingFolders) {
    const key = `${f.parentId ?? "root"}/${f.name}`;
    existingByKey.set(key, f.id);
  }

  // pathToId maps "ProjectX" → folder-id, "ProjectX/src" → folder-id
  const pathToId = new Map<string, string>();

  for (const dirPath of sortedPaths) {
    const segments = dirPath.split("/");
    const folderName = segments[segments.length - 1];
    const parentPath =
      segments.length > 1 ? segments.slice(0, -1).join("/") : null;

    // Determine parent folder ID
    let parentId: string | null;
    if (parentPath) {
      parentId = pathToId.get(parentPath) ?? null;
    } else {
      parentId = rootFolderId;
    }

    // Check if folder already exists
    const lookupKey = `${parentId ?? "root"}/${folderName}`;
    const existingId = existingByKey.get(lookupKey);
    if (existingId) {
      pathToId.set(dirPath, existingId);
      continue;
    }

    // Create the folder
    const response = await fetch(`${API_URL}/folders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        name: folderName,
        parentId: parentId || undefined,
      }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(
        (errData as { error?: string }).error ||
          `Failed to create folder "${folderName}"`
      );
    }

    const created = (await response.json()) as { id: string; name: string };
    pathToId.set(dirPath, created.id);
    // Register in existing map so sibling detection works
    existingByKey.set(lookupKey, created.id);
  }

  return pathToId;
}

/**
 * For a file with webkitRelativePath, returns the folder ID it should be
 * uploaded into, based on the pathToId map from ensureFolderStructure.
 */
export function getFolderIdForFile(
  file: File,
  pathToId: Map<string, string>,
  fallbackFolderId: string | null
): string | null {
  const rel =
    (file as File & { webkitRelativePath?: string }).webkitRelativePath || "";
  if (!rel) return fallbackFolderId;

  const parts = rel.split("/");
  if (parts.length <= 1) return fallbackFolderId;

  const dirPath = parts.slice(0, -1).join("/");
  return pathToId.get(dirPath) ?? fallbackFolderId;
}

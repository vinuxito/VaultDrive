import type { CachedCredential } from "../context/SessionVaultContext";
import type { SyncableFolderShareLink } from "./folder-share-sync";

export function findOwnedFolderShareLink(
  links: SyncableFolderShareLink[],
  token: string | undefined,
): SyncableFolderShareLink | null {
  if (!token) {
    return null;
  }

  return links.find((link) => link.token === token) ?? null;
}

export function canRepairFolderShareLink(
  link: SyncableFolderShareLink | null,
  credential: CachedCredential | null,
): boolean {
  return Boolean(link && credential);
}

export function getFolderShareRepairLabel(link: SyncableFolderShareLink | null): string {
  if (!link) {
    return "Repair this link";
  }

  return link.owner_wrapped_folder_key ? "Update this link" : "Repair this link";
}

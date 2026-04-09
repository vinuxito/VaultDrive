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

export function getFolderShareOwnerCredentialType(user: { pin_set?: boolean } | null): "pin" | "password" {
  return user?.pin_set ? "pin" : "password";
}

export function resolveFolderSharePanelCredential(
  cachedCredential: CachedCredential | null,
  inputValue: string,
  user: { pin_set?: boolean } | null,
): CachedCredential | null {
  const expectedType = getFolderShareOwnerCredentialType(user);

  if (cachedCredential && cachedCredential.type === expectedType) {
    return cachedCredential;
  }

  const trimmed = inputValue.trim();
  if (!trimmed) {
    return null;
  }

  return {
    value: trimmed,
    type: expectedType,
  };
}

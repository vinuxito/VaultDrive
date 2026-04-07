import type { CachedCredential } from "../context/SessionVaultContext";
import { API_URL } from "./api";
import {
  base64ToArrayBuffer,
  importRSAPublicKey,
  unwrapKeyWithRSA,
  wrapKeyWithAES,
  wrapKeyWithRSA,
} from "./crypto";
import { resolveFolderShareFileKey } from "./folder-share";
import { resolveOwnerPrivateKeyFromSession } from "./owner-private-key";

export interface SyncableFolderShareLink {
  id: string;
  token: string;
  folder_id: string;
  is_active: boolean;
  access_count?: number;
  last_accessed_at?: string | null;
  expires_at?: string | null;
  created_at: string;
  owner_wrapped_folder_key?: string;
}

interface SyncableFolderFile {
  id: string;
  encrypted_metadata: string;
}

interface FolderNode {
  id: string;
  parentId: string | null;
}

interface StoredUserKeyState {
  private_key_encrypted?: string | null;
  private_key_pin_encrypted?: string | null;
  public_key?: string | null;
}

interface SyncFolderShareLinksParams {
  authToken: string;
  credential: CachedCredential | null;
  cachedPrivateKey: CryptoKey | null;
  currentUser: StoredUserKeyState | null;
  links: SyncableFolderShareLink[];
}

interface SyncFolderShareLinksForFolderParams extends SyncFolderShareLinksParams {
  folderId: string;
  folders: FolderNode[];
}

interface SyncResult {
  syncedLinks: number;
  syncedFiles: number;
  skippedLinks: number;
}

export interface SyncSingleFolderShareResult {
  syncedFiles: number;
  skipped: boolean;
  upgraded: boolean;
}

export interface SyncFolderShareLinkByIdParams {
  link: SyncableFolderShareLink;
  authToken: string;
  credential: CachedCredential | null;
  cachedPrivateKey: CryptoKey | null;
  currentUser: StoredUserKeyState | null;
  providedShareUrl?: string;
}

function isLinkCurrentlyActive(link: SyncableFolderShareLink): boolean {
  if (!link.is_active) {
    return false;
  }
  if (!link.expires_at) {
    return true;
  }
  return new Date(link.expires_at).getTime() > Date.now();
}

export function getAncestorFolderIds(folderId: string, folders: FolderNode[]): string[] {
  const foldersById = new Map(folders.map((folder) => [folder.id, folder]));
  const ancestors: string[] = [];
  let currentId: string | null = folderId;

  while (currentId) {
    ancestors.push(currentId);
    currentId = foldersById.get(currentId)?.parentId ?? null;
  }

  return ancestors;
}

export function filterSyncableLinksForFolder(
  folderId: string,
  folders: FolderNode[],
  links: SyncableFolderShareLink[],
): SyncableFolderShareLink[] {
  const ancestorIds = new Set(getAncestorFolderIds(folderId, folders));
  return links.filter((link) => ancestorIds.has(link.folder_id));
}

async function fetchExistingFolderShareKeys(token: string): Promise<Record<string, string>> {
  const response = await fetch(`${API_URL}/folder-share/${token}/keys`);
  if (!response.ok) {
    throw new Error("Failed to fetch existing folder share keys");
  }
  return response.json() as Promise<Record<string, string>>;
}

export function extractFolderShareKeyFromUrl(
  shareUrl: string,
  expectedToken?: string,
): { token: string; keyB64: string } {
  const trimmed = shareUrl.trim();
  const normalized = trimmed.startsWith("http") ? trimmed : `https://placeholder.invalid${trimmed.startsWith("/") ? "" : "/"}${trimmed}`;
  const parsed = new URL(normalized);
  const token = parsed.pathname.split("/").filter(Boolean).pop() ?? "";
  const keyB64 = parsed.hash.startsWith("#") ? parsed.hash.slice(1) : parsed.hash;

  if (!token || !keyB64) {
    throw new Error("Paste the full existing share URL so the browser can recover its key.");
  }
  if (expectedToken && token !== expectedToken) {
    throw new Error("That URL belongs to a different shared link.");
  }

  return { token, keyB64 };
}

async function importFolderShareKey(keyB64: string): Promise<CryptoKey> {
  return window.crypto.subtle.importKey(
    "raw",
    base64ToArrayBuffer(keyB64),
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"],
  );
}

async function fetchFolderSubtreeFiles(folderId: string, authToken: string): Promise<SyncableFolderFile[]> {
  const response = await fetch(`${API_URL}/folders/${folderId}/files-recursive`, {
    headers: { Authorization: `Bearer ${authToken}` },
  });
  if (!response.ok) {
    throw new Error("Failed to fetch folder subtree files");
  }
  const data = (await response.json()) as { files: SyncableFolderFile[] };
  return data.files;
}

async function fetchWrappedKeysForFiles(fileIds: string[], authToken: string): Promise<Record<string, string>> {
  const response = await fetch(`${API_URL}/files/access-keys-batch`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify({ file_ids: fileIds }),
  });

  if (!response.ok) {
    throw new Error("Failed to fetch file access keys");
  }

  return response.json() as Promise<Record<string, string>>;
}

async function syncSingleFolderShareLink(
  link: SyncableFolderShareLink,
  authToken: string,
  credential: CachedCredential,
  rsaPrivateKey: CryptoKey,
  folderShareKey: CryptoKey,
): Promise<SyncSingleFolderShareResult> {
  const [files, existingKeys] = await Promise.all([
    fetchFolderSubtreeFiles(link.folder_id, authToken),
    fetchExistingFolderShareKeys(link.token),
  ]);

  const missingFiles = files.filter((file) => !existingKeys[file.id]);
  if (missingFiles.length === 0) {
    return { syncedFiles: 0, skipped: false, upgraded: false };
  }

  const wrappedKeysMap = await fetchWrappedKeysForFiles(missingFiles.map((file) => file.id), authToken);

  const wrappedKeys: Record<string, string> = {};
  for (const file of missingFiles) {
    const wrappedKey = wrappedKeysMap[file.id];
    if (!wrappedKey) {
      continue;
    }

    try {
      const fileKey = await resolveFolderShareFileKey({
        wrappedKey,
        encryptedMetadata: file.encrypted_metadata,
        credential: credential.value,
        credentialType: credential.type,
        rsaPrivateKey,
      });
      wrappedKeys[file.id] = await wrapKeyWithAES(folderShareKey, fileKey);
    } catch {
      continue;
    }
  }

  if (Object.keys(wrappedKeys).length === 0) {
    return { syncedFiles: 0, skipped: false, upgraded: false };
  }

  const response = await fetch(`${API_URL}/folder-share-links/${link.id}/sync`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify({ wrapped_keys: wrappedKeys }),
  });
  if (!response.ok) {
    throw new Error("Failed to sync folder share link");
  }

  const data = (await response.json()) as { synced?: number };
  return { syncedFiles: data.synced ?? Object.keys(wrappedKeys).length, skipped: false, upgraded: false };
}

export async function syncFolderShareLinkById({
  link,
  authToken,
  credential,
  cachedPrivateKey,
  currentUser,
  providedShareUrl,
}: SyncFolderShareLinkByIdParams): Promise<SyncSingleFolderShareResult> {
  if (!credential) {
    return { syncedFiles: 0, skipped: true, upgraded: false };
  }

  const rsaPrivateKey = await resolveOwnerPrivateKeyFromSession(cachedPrivateKey, credential, currentUser);
  if (!rsaPrivateKey) {
    return { syncedFiles: 0, skipped: true, upgraded: false };
  }

  let folderShareKey: CryptoKey;
  let ownerWrappedFolderKey: string | undefined;
  let upgraded = false;
  if (providedShareUrl) {
    const { keyB64 } = extractFolderShareKeyFromUrl(providedShareUrl, link.token);
    folderShareKey = await importFolderShareKey(keyB64);
    if (currentUser?.public_key) {
      const ownerPublicKey = await importRSAPublicKey(currentUser.public_key);
      ownerWrappedFolderKey = await wrapKeyWithRSA(ownerPublicKey, folderShareKey);
    }
  } else if (link.owner_wrapped_folder_key) {
    folderShareKey = await unwrapKeyWithRSA(rsaPrivateKey, link.owner_wrapped_folder_key);
  } else {
    throw new Error("Paste the original share URL so the browser can recover this older link.");
  }

  if (ownerWrappedFolderKey) {
    const response = await fetch(`${API_URL}/folder-share-links/${link.id}/sync`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ wrapped_keys: {}, owner_wrapped_folder_key: ownerWrappedFolderKey }),
    });
    if (!response.ok) {
      throw new Error("Failed to upgrade this older shared link.");
    }
    upgraded = true;
  }

  const result = await syncSingleFolderShareLink(link, authToken, credential, rsaPrivateKey, folderShareKey);
  return { ...result, upgraded };
}

async function syncFolderShareLinksInternal({
  authToken,
  credential,
  cachedPrivateKey,
  currentUser,
  links,
}: SyncFolderShareLinksParams): Promise<SyncResult> {
  if (!credential) {
    return { syncedLinks: 0, syncedFiles: 0, skippedLinks: links.length };
  }

  const activeLinks = links.filter(isLinkCurrentlyActive);
  if (activeLinks.length === 0) {
    return { syncedLinks: 0, syncedFiles: 0, skippedLinks: 0 };
  }

  const rsaPrivateKey = await resolveOwnerPrivateKeyFromSession(cachedPrivateKey, credential, currentUser);
  if (!rsaPrivateKey) {
    return { syncedLinks: 0, syncedFiles: 0, skippedLinks: activeLinks.length };
  }

  let syncedLinks = 0;
  let syncedFiles = 0;
  let skippedLinks = 0;

  for (const link of activeLinks) {
    try {
      if (!link.owner_wrapped_folder_key) {
        skippedLinks += 1;
        continue;
      }
      const folderShareKey = await unwrapKeyWithRSA(rsaPrivateKey, link.owner_wrapped_folder_key);
      const result = await syncSingleFolderShareLink(link, authToken, credential, rsaPrivateKey, folderShareKey);
      if (result.skipped) {
        skippedLinks += 1;
        continue;
      }
      if (result.syncedFiles > 0) {
        syncedLinks += 1;
        syncedFiles += result.syncedFiles;
      }
    } catch {
      skippedLinks += 1;
    }
  }

  return { syncedLinks, syncedFiles, skippedLinks };
}

export async function syncFolderShareLinksForFolder({
  folderId,
  folders,
  ...rest
}: SyncFolderShareLinksForFolderParams): Promise<SyncResult> {
  const links = filterSyncableLinksForFolder(folderId, folders, rest.links);
  return syncFolderShareLinksInternal({ ...rest, links });
}

export async function syncAllFolderShareLinks(params: SyncFolderShareLinksParams): Promise<SyncResult> {
  return syncFolderShareLinksInternal(params);
}

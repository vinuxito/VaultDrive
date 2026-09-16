import {
  arrayBufferToBase64,
  base64ToArrayBuffer,
  decryptFile,
  deriveKeyFromPassword,
  hexToBytes,
  unwrapKey,
  unwrapKeyWithAES,
} from "./crypto";
import { legacyFileRequestSalt } from "./file-request-credential";

export interface RecoverableOwnerFile {
  id: string;
  metadata: string;
  pin_wrapped_key?: string | null;
  folder_id?: string | null;
}

interface RecoverVerifiedOwnerFileKeyOptions {
  file: RecoverableOwnerFile;
  credential: string;
  encryptedData: ArrayBuffer;
  wrappedKey?: string | null;
  cachedFileKey?: CryptoKey | null;
  folderKey?: CryptoKey | null;
}

interface RecoveredOwnerFileKey {
  key: CryptoKey;
  fragment: string;
}

export async function recoverVerifiedOwnerFileKey({
  file,
  credential,
  encryptedData,
  wrappedKey,
  cachedFileKey,
  folderKey,
}: RecoverVerifiedOwnerFileKeyOptions): Promise<RecoveredOwnerFileKey> {
  let metadata: { iv?: string; salt?: string; credential_scheme?: string };
  try {
    metadata = JSON.parse(file.metadata) as typeof metadata;
  } catch {
    throw new Error("This file has invalid encryption metadata. Manage or recreate the link from Files.");
  }

  if (!metadata.iv) {
    throw new Error("This file is missing its encryption IV. Manage or recreate the link from Files.");
  }
  metadata.salt ||= legacyFileRequestSalt(metadata, wrappedKey);

  // A credential prompt must validate the credential for PIN/password files.
  // Cached keys are only a recovery path for folder-managed files, whose file
  // key is unlocked by the already-authenticated folder session.
  let key = metadata.credential_scheme === "folder" ? cachedFileKey ?? null : null;
  try {
    if (!key && file.pin_wrapped_key) {
      const rawHex = await unwrapKey(credential, file.pin_wrapped_key);
      key = await crypto.subtle.importKey(
        "raw",
        new Uint8Array(hexToBytes(rawHex)),
        { name: "AES-GCM", length: 256 },
        true,
        ["decrypt"],
      );
    } else if (!key && metadata.credential_scheme === "folder") {
      if (!folderKey || !wrappedKey) {
        throw new Error("Open this folder in Files first, then manage or recreate the link there.");
      }
      key = await unwrapKeyWithAES(folderKey, wrappedKey);
    } else if (!key) {
      if (!metadata.salt) {
        throw new Error("This older file cannot be recovered here. Manage or recreate the link from Files.");
      }
      key = await deriveKeyFromPassword(
        credential,
        new Uint8Array(base64ToArrayBuffer(metadata.salt)),
        100000,
      );
    }

    await decryptFile(
      encryptedData,
      key,
      new Uint8Array(base64ToArrayBuffer(metadata.iv)),
    );
  } catch (error) {
    if (error instanceof Error && /manage|older file|folder/i.test(error.message)) {
      throw error;
    }
    throw new Error("That credential didn't unlock this file. Check it and try again.");
  }

  const rawKey = await crypto.subtle.exportKey("raw", key);
  return { key, fragment: arrayBufferToBase64(rawKey) };
}

import {
  base64ToArrayBuffer,
  deriveKeyFromPassword,
  unwrapKeyWithRSA,
} from "./crypto";

export interface ResolveFolderShareFileKeyParams {
  wrappedKey: string;
  encryptedMetadata: string;
  credential: string;
  credentialType: "pin" | "password";
  rsaPrivateKey: CryptoKey;
}

interface FolderShareMetadata {
  salt?: string;
  credential_scheme?: string;
}

function parseFolderShareMetadata(encryptedMetadata: string): FolderShareMetadata {
  if (!encryptedMetadata) {
    return {};
  }

  try {
    return JSON.parse(encryptedMetadata) as FolderShareMetadata;
  } catch {
    throw new Error("File metadata is invalid. Refresh the vault and try again.");
  }
}

export async function resolveFolderShareFileKey({
  wrappedKey,
  encryptedMetadata,
  credential,
  credentialType,
  rsaPrivateKey,
}: ResolveFolderShareFileKeyParams): Promise<CryptoKey> {
  if (!wrappedKey.includes(":")) {
    return unwrapKeyWithRSA(rsaPrivateKey, wrappedKey);
  }

  const metadata = parseFolderShareMetadata(encryptedMetadata);
  const requiredCredentialType = metadata.credential_scheme === "pin" ? "pin" : "password";

  if (requiredCredentialType !== credentialType) {
    throw new Error(
      requiredCredentialType === "password"
        ? "This folder contains files encrypted with your account password. Share it from a password-authenticated session first."
        : "This folder contains files encrypted with your PIN. Open sharing from a trusted PIN session first.",
    );
  }

  if (!metadata.salt) {
    throw new Error("File metadata is missing the salt required to share this folder.");
  }

  const salt = new Uint8Array(base64ToArrayBuffer(metadata.salt));
  return deriveKeyFromPassword(credential, salt, 100000);
}

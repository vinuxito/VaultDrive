import {
  importRSAPublicKey,
  wrapKeyWithRSA,
} from "./crypto";

/**
 * Wrap a symmetric AES-GCM folder key with the recipient's RSA public key (RSA-OAEP).
 * Returns the base64-encoded wrapped folder key.
 */
export async function wrapFolderKeyForRecipient(
  folderKey: CryptoKey,
  recipientPublicKeyPem: string
): Promise<string> {
  const publicKey = await importRSAPublicKey(recipientPublicKeyPem);
  return await wrapKeyWithRSA(publicKey, folderKey);
}

import type { CachedCredential } from "../context/SessionVaultContext";
import { decryptPrivateKeyWithPIN, importRSAPrivateKey } from "./crypto";
import { getCachedPinValue } from "./pin-trust";

interface RestorePrivateKeyFromSessionPinParams {
  credential: CachedCredential | null;
  privateKeyPinEncrypted: string | null | undefined;
}

export async function restorePrivateKeyFromSessionPin({
  credential,
  privateKeyPinEncrypted,
}: RestorePrivateKeyFromSessionPinParams): Promise<CryptoKey | null> {
  const pin = getCachedPinValue(credential);
  if (!pin || !privateKeyPinEncrypted) {
    return null;
  }

  const privateKeyPem = await decryptPrivateKeyWithPIN(pin, privateKeyPinEncrypted);
  return importRSAPrivateKey(privateKeyPem);
}

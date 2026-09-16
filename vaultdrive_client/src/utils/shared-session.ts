import type { CachedCredential } from "../context/SessionVaultContext";
import { decryptPrivateKeyWithPIN, importRSAPrivateKey } from "./crypto";
import { getCachedPinValue } from "./pin-trust";

interface RestorePrivateKeyFromSessionPinParams {
  credential: CachedCredential | null;
  privateKeyPinEncrypted: string | null | undefined;
  kekEnvelopeVersion?: number;
}

export async function restorePrivateKeyFromSessionPin({
  credential,
  privateKeyPinEncrypted,
  kekEnvelopeVersion,
}: RestorePrivateKeyFromSessionPinParams): Promise<CryptoKey | null> {
  const pin = getCachedPinValue(credential);
  if (!pin || !privateKeyPinEncrypted) {
    return null;
  }

  const privateKeyPem = await decryptPrivateKeyWithPIN(pin, privateKeyPinEncrypted, kekEnvelopeVersion);
  return importRSAPrivateKey(privateKeyPem);
}

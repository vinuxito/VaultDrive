import type { CachedCredential } from "../context/SessionVaultContext";
import {
  decryptPrivateKeyWithPassword,
  decryptPrivateKeyWithPIN,
  importRSAPrivateKey,
} from "./crypto";

interface StoredOwnerKeyState {
  private_key_encrypted?: string | null;
  private_key_pin_encrypted?: string | null;
  kek_envelope_version?: number;
}

export async function resolveOwnerPrivateKeyFromSession(
  cachedPrivateKey: CryptoKey | null,
  credential: CachedCredential | null,
  user: StoredOwnerKeyState | null,
): Promise<CryptoKey | null> {
  if (cachedPrivateKey) {
    return cachedPrivateKey;
  }

  if (!credential || !user) {
    return null;
  }

  if (credential.type === "pin" && user.private_key_pin_encrypted) {
    const pem = await decryptPrivateKeyWithPIN(credential.value, user.private_key_pin_encrypted, user.kek_envelope_version);
    return importRSAPrivateKey(pem);
  }

  if (credential.type === "password" && user.private_key_encrypted) {
    const pem = await decryptPrivateKeyWithPassword(credential.value, user.private_key_encrypted, user.kek_envelope_version);
    return importRSAPrivateKey(pem);
  }

  return null;
}

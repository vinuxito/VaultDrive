import type { CachedCredential } from "../context/SessionVaultContext";

export interface StoredUserPinState {
  pin_set?: boolean;
  private_key_encrypted?: string | null;
  private_key_pin_encrypted?: string | null;
  [key: string]: unknown;
}

export function getCachedPinValue(
  credential: CachedCredential | null | undefined,
): string | null {
  if (credential?.type !== "pin") {
    return null;
  }

  return /^\d{4}$/.test(credential.value) ? credential.value : null;
}

export function requiresPinSetup(
  user: Pick<StoredUserPinState, "pin_set"> | null | undefined,
): boolean {
  return user?.pin_set !== true;
}

export function mergeUserPinState<T extends StoredUserPinState | null | undefined>(
  user: T,
  privateKeyPinEncrypted?: string,
): StoredUserPinState {
  return {
    ...(user ?? {}),
    pin_set: true,
    private_key_pin_encrypted:
      privateKeyPinEncrypted ?? user?.private_key_pin_encrypted ?? null,
  };
}

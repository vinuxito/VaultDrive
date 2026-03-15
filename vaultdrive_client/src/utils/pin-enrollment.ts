import {
  decryptPrivateKeyWithPassword,
  encryptPrivateKeyWithPIN,
} from "./crypto";

interface CreatePinProtectedPrivateKeyParams {
  privateKeyEncrypted: string | null;
  password: string;
  pin: string;
}

export async function createPinProtectedPrivateKey({
  privateKeyEncrypted,
  password,
  pin,
}: CreatePinProtectedPrivateKeyParams): Promise<string | undefined> {
  if (!privateKeyEncrypted) {
    return undefined;
  }

  const privateKeyPem = await decryptPrivateKeyWithPassword(
    password,
    privateKeyEncrypted,
  );

  return encryptPrivateKeyWithPIN(pin, privateKeyPem);
}

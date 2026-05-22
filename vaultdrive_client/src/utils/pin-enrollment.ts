import {
  decryptPrivateKeyWithPassword,
  encryptPrivateKeyWithPIN,
  encryptPrivateKeyWithPassword,
} from "./crypto";

interface CreatePinProtectedPrivateKeyParams {
  privateKeyEncrypted: string | null;
  password: string;
  pin: string;
  previousPassword?: string;
}

export interface PinEnrollmentResult {
  privateKeyPinEncrypted: string;
  reEncryptedPrivateKey?: string;
}

const MISSING_PRIVATE_KEY_ERROR =
  "We couldn't load your encrypted private key. Sign out and sign back in, then try setting your PIN again.";

const INCORRECT_PASSWORD_ERROR =
  "Incorrect password — enter your account login password.";

export function getPinEnrollmentErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    const message = error.message.trim();
    const normalized = message.toLowerCase();

    if (!message) {
      return INCORRECT_PASSWORD_ERROR;
    }

    if (normalized.includes("decryption failed") || normalized.includes("decrypt")) {
      return INCORRECT_PASSWORD_ERROR;
    }

    return message;
  }

  return "Failed to set PIN. Please try again.";
}

export async function createPinProtectedPrivateKey({
  privateKeyEncrypted,
  password,
  pin,
  previousPassword,
}: CreatePinProtectedPrivateKeyParams): Promise<PinEnrollmentResult> {
  if (!privateKeyEncrypted) {
    throw new Error(MISSING_PRIVATE_KEY_ERROR);
  }

  let privateKeyPem: string;
  let usedRecovery = false;
  
  let kekEnvelopeVersion = 1;
  try {
    const userJson = localStorage.getItem("user");
    console.log("pin-enrollment userJson:", userJson);
    if (userJson) {
      const userObj = JSON.parse(userJson);
      if (userObj && userObj.kek_envelope_version) {
        kekEnvelopeVersion = userObj.kek_envelope_version;
      }
    }
  } catch(e) {}
  console.log("pin-enrollment using kekEnvelopeVersion:", kekEnvelopeVersion);

  try {
    privateKeyPem = await decryptPrivateKeyWithPassword(
      password,
      privateKeyEncrypted,
      kekEnvelopeVersion
    );
    console.log("pin-enrollment decryption SUCCESS");
  } catch (error: unknown) {
    console.log("pin-enrollment decryption FAILED with password", error);
    if (previousPassword) {
      try {
        privateKeyPem = await decryptPrivateKeyWithPassword(
          previousPassword,
          privateKeyEncrypted,
          kekEnvelopeVersion
        );
        usedRecovery = true;
      } catch (secondError: unknown) {
        throw new Error(getPinEnrollmentErrorMessage(secondError));
      }
    } else {
      throw new Error(getPinEnrollmentErrorMessage(error));
    }
  }

  const privateKeyPinEncrypted = await encryptPrivateKeyWithPIN(pin, privateKeyPem, kekEnvelopeVersion);
  const result: PinEnrollmentResult = { privateKeyPinEncrypted };

  if (usedRecovery) {
    result.reEncryptedPrivateKey = await encryptPrivateKeyWithPassword(password, privateKeyPem);
  }

  return result;
}

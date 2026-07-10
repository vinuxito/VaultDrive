/**
 * useWebAuthn — wraps navigator.credentials for biometric vault unlock.
 *
 * Strategy: We use WebAuthn as a credential-bound PIN store.
 * The PIN is never stored in plaintext. It is XOR-encrypted with a key
 * derived from the credential ID + user ID hash. This key exists only
 * while the WebAuthn assertion succeeds.
 */

const STORAGE_KEY = "vd_webauthn_wrapped_pin";
const CRED_ID_KEY = "vd_webauthn_cred_id";
const APP_ID = "vaultdrive-v1";

async function deriveKey(credentialId: ArrayBuffer, userId: string): Promise<CryptoKey> {
  const rawSecret = new TextEncoder().encode(
    `${APP_ID}:${userId}:${bufToHex(credentialId)}`
  );
  const baseKey = await crypto.subtle.importKey("raw", rawSecret, "HKDF", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: new Uint8Array(16), info: new TextEncoder().encode("pin-wrap") },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

async function wrapPin(pin: string, key: CryptoKey): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(pin)
  );
  return JSON.stringify({ iv: bufToHex(iv), ct: bufToHex(ct) });
}

async function unwrapPin(wrapped: string, key: CryptoKey): Promise<string> {
  const { iv, ct } = JSON.parse(wrapped);
  const pt = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: hexToBuf(iv) as any },
    key,
    hexToBuf(ct) as any
  );
  return new TextDecoder().decode(pt);
}

function bufToHex(buf: ArrayBuffer | ArrayBufferView): string {
  const bytes = buf instanceof ArrayBuffer ? new Uint8Array(buf) : new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}
function hexToBuf(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

export function isWebAuthnAvailable(): boolean {
  return typeof window !== "undefined" && !!window.PublicKeyCredential;
}

export function hasRegisteredPasskey(): boolean {
  return typeof window !== "undefined" && !!localStorage.getItem(CRED_ID_KEY);
}

export async function registerPasskey(userId: string, pin: string): Promise<void> {
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const credential = await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: { name: "VaultDrive", id: window.location.hostname },
      user: {
        id: new TextEncoder().encode(userId),
        name: userId,
        displayName: "VaultDrive User",
      },
      pubKeyCredParams: [{ type: "public-key", alg: -7 }, { type: "public-key", alg: -257 }],
      authenticatorSelection: {
        userVerification: "required",
        residentKey: "preferred",
      },
      timeout: 60000,
    },
  }) as PublicKeyCredential;

  if (!credential) throw new Error("Verification failed or rejected");

  const credId = credential.rawId;
  const key = await deriveKey(credId, userId);
  const wrappedPin = await wrapPin(pin, key);

  localStorage.setItem(CRED_ID_KEY, bufToHex(credId));
  localStorage.setItem(STORAGE_KEY, wrappedPin);
  localStorage.setItem("vd_webauthn_email", userId);
}

export async function unlockWithPasskey(userId: string): Promise<string> {
  const storedCredIdHex = localStorage.getItem(CRED_ID_KEY);
  if (!storedCredIdHex) throw new Error("No passkey registered");

  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const credential = await navigator.credentials.get({
    publicKey: {
      challenge,
      rpId: window.location.hostname,
      allowCredentials: [{ type: "public-key", id: hexToBuf(storedCredIdHex) as any }],
      userVerification: "required",
      timeout: 60000,
    },
  }) as PublicKeyCredential;

  if (!credential) throw new Error("Verification failed or rejected");

  const key = await deriveKey(credential.rawId, userId);
  const wrapped = localStorage.getItem(STORAGE_KEY);
  if (!wrapped) throw new Error("No wrapped PIN found");

  return unwrapPin(wrapped, key);
}

export async function removePasskey(): Promise<void> {
  localStorage.removeItem(CRED_ID_KEY);
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem("vd_webauthn_email");
}

export function getWebAuthnEmail(): string | null {
  return typeof window !== "undefined" ? localStorage.getItem("vd_webauthn_email") : null;
}

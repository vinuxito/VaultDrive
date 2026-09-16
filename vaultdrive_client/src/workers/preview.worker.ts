// preview.worker.ts — off-thread decryption for previewing files
import { mapDownloadHttpError } from "../utils/download-error";
import { legacyFileRequestSalt } from "../utils/file-request-credential";

interface PreviewFile {
  id: string;
  metadata: string;
  pin_wrapped_key?: string | null;
  is_owner?: boolean;
}

interface PreviewRequest {
  file: PreviewFile;
  credential: string;
  rawPrivateKeyPem?: string;
  authToken: string;
  API_URL: string;
}

interface EncryptionMetadata {
  iv: string;
  salt?: string | null;
  credential_scheme?: string;
}

interface PreviewWorkerScope {
  onmessage: ((event: MessageEvent<PreviewRequest>) => void) | null;
  postMessage(message: object, transfer?: Transferable[]): void;
}

const workerScope = self as unknown as PreviewWorkerScope;

export function isEncryptionMetadata(value: unknown): value is EncryptionMetadata {
  return typeof value === "object"
    && value !== null
    && "iv" in value
    && typeof (value as Record<string, unknown>).iv === "string"
    && (!("salt" in value)
      || (value as Record<string, unknown>).salt === null
      || typeof (value as Record<string, unknown>).salt === "string");
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

function hexToBytes(hex: string): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(new ArrayBuffer(hex.length / 2));
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function concatBytes(...arrays: Uint8Array[]): Uint8Array<ArrayBuffer> {
  const result = new Uint8Array(new ArrayBuffer(arrays.reduce((total, array) => total + array.length, 0)));
  let offset = 0;
  for (const array of arrays) {
    result.set(array, offset);
    offset += array.length;
  }
  return result;
}

function encodeDerLength(length: number): Uint8Array<ArrayBuffer> {
  if (length < 0x80) return Uint8Array.of(length);
  const bytes: number[] = [];
  let remaining = length;
  while (remaining > 0) {
    bytes.unshift(remaining & 0xff);
    remaining >>= 8;
  }
  return Uint8Array.of(0x80 | bytes.length, ...bytes);
}

function encodeDer(tag: number, value: Uint8Array): Uint8Array<ArrayBuffer> {
  return concatBytes(Uint8Array.of(tag), encodeDerLength(value.length), value);
}

function wrapPkcs1PrivateKeyAsPkcs8(pkcs1Key: Uint8Array): Uint8Array<ArrayBuffer> {
  const version = Uint8Array.of(0x02, 0x01, 0x00);
  const rsaEncryptionAlgorithm = Uint8Array.of(
    0x30, 0x0d,
    0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01,
    0x05, 0x00,
  );
  return encodeDer(
    0x30,
    concatBytes(version, rsaEncryptionAlgorithm, encodeDer(0x04, pkcs1Key)),
  );
}

async function decryptFile(
  encryptedData: ArrayBuffer,
  key: CryptoKey,
  iv: Uint8Array<ArrayBuffer>
): Promise<ArrayBuffer> {
  return crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    encryptedData
  );
}

async function unwrapKey(credential: string, wrappedKeyHex: string): Promise<string> {
  const wrapped = hexToBytes(wrappedKeyHex);
  if (wrapped.length < 16 + 12 + 16) throw new Error("Invalid wrapped key length");
  const salt = wrapped.slice(0, 16);
  const iv = wrapped.slice(16, 28);
  const encryptedKey = wrapped.slice(28);
  const baseKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(credential.normalize("NFC")),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  const derivedKey = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"]
  );
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    derivedKey,
    encryptedKey
  );
  return new TextDecoder().decode(decrypted);
}

async function importRSAPrivateKey(pem: string): Promise<CryptoKey> {
  const isPkcs1 = pem.includes("-----BEGIN RSA PRIVATE KEY-----");
  const pemContents = pem
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace("-----BEGIN RSA PRIVATE KEY-----", "")
    .replace("-----END RSA PRIVATE KEY-----", "")
    .replace(/\s+/g, "");
  const binaryDerString = atob(pemContents);
  const binaryDer = new Uint8Array(new ArrayBuffer(binaryDerString.length));
  for (let i = 0; i < binaryDerString.length; i++) {
    binaryDer[i] = binaryDerString.charCodeAt(i);
  }
  const pkcs8 = isPkcs1 ? wrapPkcs1PrivateKeyAsPkcs8(binaryDer) : binaryDer;
  return crypto.subtle.importKey(
    "pkcs8",
    pkcs8,
    { name: "RSA-OAEP", hash: "SHA-256" },
    false,
    ["unwrapKey"]
  );
}

async function unwrapKeyWithRSA(
  privateKey: CryptoKey,
  wrappedKeyB64: string
): Promise<CryptoKey> {
  const wrappedKeyBuffer = base64ToArrayBuffer(wrappedKeyB64);
  return crypto.subtle.unwrapKey(
    "raw",
    wrappedKeyBuffer,
    privateKey,
    { name: "RSA-OAEP" },
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"]
  );
}

async function deriveKeyFromPassword(password: string, salt: Uint8Array<ArrayBuffer>, iterations = 100000): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password.normalize("NFC")),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"]
  );
}

workerScope.onmessage = async (e: MessageEvent<PreviewRequest>) => {
  const { file, credential, rawPrivateKeyPem, authToken, API_URL } = e.data;
  let failureKind: "credential" | "auth" | "storage" | "metadata" | "unknown" = "storage";
  try {
    // 1. Fetch encrypted file
    const response = await fetch(`${API_URL}/files/${file.id}/download`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    if (!response.ok) {
      failureKind = response.status === 401
        ? "auth"
        : response.status >= 500
          ? "storage"
          : "unknown";
      throw new Error(mapDownloadHttpError(response.status));
    }

    failureKind = "metadata";
    const metaStr = response.headers.get("X-File-Metadata") ?? file.metadata;
    const parsedMetadata: unknown = JSON.parse(metaStr);
    if (!isEncryptionMetadata(parsedMetadata)) throw new Error("Missing encryption IV");
    const metaObj = parsedMetadata;

    const iv = new Uint8Array(base64ToArrayBuffer(metaObj.iv));
    const wrappedKeyB64 = response.headers.get("X-Wrapped-Key");
    metaObj.salt ||= legacyFileRequestSalt(metaObj, wrappedKeyB64);
    const isDropUpload = !metaObj.salt;
    const pinWrappedKey = file.pin_wrapped_key || (file.is_owner !== false ? wrappedKeyB64 : null);
    let encryptionKey: CryptoKey;
    let finalDecryptVerifiesCredential = false;

    failureKind = "unknown";
    if (isDropUpload && pinWrappedKey) {
      failureKind = "credential";
      const rawKey = await unwrapKey(credential, pinWrappedKey);
      const keyBytes = hexToBytes(rawKey);
      encryptionKey = await crypto.subtle.importKey(
        "raw",
        keyBytes,
        { name: "AES-GCM", length: 256 },
        false,
        ["decrypt"]
      );
      failureKind = "unknown";
    } else if (wrappedKeyB64 && file.is_owner === false) {
      if (!rawPrivateKeyPem) throw new Error("Private key PEM required for decryption");
      const rsaKey = await importRSAPrivateKey(rawPrivateKeyPem);
      encryptionKey = await unwrapKeyWithRSA(rsaKey, wrappedKeyB64);
    } else {
      if (!metaObj.salt) throw new Error("Missing encryption salt");
      finalDecryptVerifiesCredential = true;
      failureKind = "credential";
      const salt = new Uint8Array(base64ToArrayBuffer(metaObj.salt));
      encryptionKey = await deriveKeyFromPassword(credential, salt, 100000);
    }

    failureKind = finalDecryptVerifiesCredential ? "credential" : "unknown";
    const encryptedBlob = await response.blob();
    const encryptedData = await encryptedBlob.arrayBuffer();
    const decryptedData = await decryptFile(encryptedData, encryptionKey, iv);

    // Send back decrypted array buffer via Transferable list
    workerScope.postMessage(
      { success: true, decryptedBuffer: decryptedData },
      [decryptedData]
    );
  } catch (err) {
    workerScope.postMessage({
      success: false,
      error: err instanceof Error ? err.message : "Decryption failed",
      failureKind,
    });
  }
};

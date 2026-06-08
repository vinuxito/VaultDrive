import { arrayBufferToBase64, base64ToArrayBuffer } from "./crypto";

export interface WrappedEnvelope {
  ciphertext: string;
  iv: string;
}

// Generate ephemeral ECDH key pair for room key exchanges
export async function generateECDHKeyPair(): Promise<CryptoKeyPair> {
  return await window.crypto.subtle.generateKey(
    {
      name: "ECDH",
      namedCurve: "P-256",
    },
    true, // extractable
    ["deriveKey", "deriveBits"]
  );
}

// Export ECDH public key to JWK for transport
export async function exportECDHPublicKey(publicKey: CryptoKey): Promise<JsonWebKey> {
  return await window.crypto.subtle.exportKey("jwk", publicKey);
}

// Import ECDH public key from JWK
export async function importECDHPublicKey(jwk: JsonWebKey): Promise<CryptoKey> {
  return await window.crypto.subtle.importKey(
    "jwk",
    jwk,
    {
      name: "ECDH",
      namedCurve: "P-256",
    },
    true,
    [] // No usages needed directly on the public key itself
  );
}

// Derive AES-GCM symmetric key using our private key and peer's public key
export async function deriveSharedSecret(
  ourPrivateKey: CryptoKey,
  peerPublicKey: CryptoKey
): Promise<CryptoKey> {
  return await window.crypto.subtle.deriveKey(
    {
      name: "ECDH",
      public: peerPublicKey,
    },
    ourPrivateKey,
    {
      name: "AES-GCM",
      length: 256,
    },
    true,
    ["encrypt", "decrypt"]
  );
}

// Generate a random symmetric RoomKey
export async function generateRoomKey(): Promise<CryptoKey> {
  return await window.crypto.subtle.generateKey(
    {
      name: "AES-GCM",
      length: 256,
    },
    true,
    ["encrypt", "decrypt"]
  );
}

// Export RoomKey to raw bytes base64
export async function exportRoomKey(key: CryptoKey): Promise<string> {
  const exported = await window.crypto.subtle.exportKey("raw", key);
  return arrayBufferToBase64(new Uint8Array(exported));
}

// Import RoomKey from raw bytes base64
export async function importRoomKey(keyB64: string): Promise<CryptoKey> {
  const buffer = base64ToArrayBuffer(keyB64);
  return await window.crypto.subtle.importKey(
    "raw",
    buffer,
    {
      name: "AES-GCM",
      length: 256,
    },
    true,
    ["encrypt", "decrypt"]
  );
}

// Encrypt the RoomKey raw bytes with the ECDH derived shared secret
export async function encryptRoomKeyEnvelope(
  sharedSecret: CryptoKey,
  roomKey: CryptoKey
): Promise<WrappedEnvelope> {
  const rawRoomKey = await window.crypto.subtle.exportKey("raw", roomKey);
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  
  const ciphertext = await window.crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
    },
    sharedSecret,
    rawRoomKey
  );

  return {
    ciphertext: arrayBufferToBase64(new Uint8Array(ciphertext)),
    iv: arrayBufferToBase64(iv),
  };
}

// Decrypt the RoomKey raw bytes with the ECDH derived shared secret
export async function decryptRoomKeyEnvelope(
  sharedSecret: CryptoKey,
  wrapped: WrappedEnvelope
): Promise<CryptoKey> {
  const cipherBuffer = base64ToArrayBuffer(wrapped.ciphertext);
  const ivBuffer = base64ToArrayBuffer(wrapped.iv);

  const decryptedRaw = await window.crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: new Uint8Array(ivBuffer),
    },
    sharedSecret,
    cipherBuffer
  );

  return await window.crypto.subtle.importKey(
    "raw",
    decryptedRaw,
    {
      name: "AES-GCM",
      length: 256,
    },
    true,
    ["encrypt", "decrypt"]
  );
}

// Encrypt room text or json string with the RoomKey
export async function encryptRoomData(
  roomKey: CryptoKey,
  plaintext: string
): Promise<WrappedEnvelope> {
  const encoder = new TextEncoder();
  const encodedData = encoder.encode(plaintext);
  const iv = window.crypto.getRandomValues(new Uint8Array(12));

  const ciphertext = await window.crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
    },
    roomKey,
    encodedData
  );

  return {
    ciphertext: arrayBufferToBase64(new Uint8Array(ciphertext)),
    iv: arrayBufferToBase64(iv),
  };
}

// Decrypt room text or json string with the RoomKey
export async function decryptRoomData(
  roomKey: CryptoKey,
  wrapped: WrappedEnvelope
): Promise<string> {
  const cipherBuffer = base64ToArrayBuffer(wrapped.ciphertext);
  const ivBuffer = base64ToArrayBuffer(wrapped.iv);

  const decryptedBytes = await window.crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: new Uint8Array(ivBuffer),
    },
    roomKey,
    cipherBuffer
  );

  return new TextDecoder().decode(decryptedBytes);
}

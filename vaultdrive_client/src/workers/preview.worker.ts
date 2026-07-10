// preview.worker.ts — off-thread decryption for previewing files

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

async function decryptFile(
  encryptedData: ArrayBuffer,
  key: CryptoKey,
  iv: Uint8Array
): Promise<ArrayBuffer> {
  return crypto.subtle.decrypt(
    { name: "AES-GCM", iv: iv as any },
    key,
    encryptedData
  );
}

async function unwrapKey(credential: string, wrappedKeyHex: string): Promise<string> {
  const keyBytes = hexToBytes(wrappedKeyHex);
  const salt = new Uint8Array(16); // zero salt used for PIN wrapping
  const baseKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(credential),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  const derivedKey = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt as any, iterations: 100000, hash: "SHA-256" },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"]
  );
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: new Uint8Array(12) },
    derivedKey,
    keyBytes as any
  );
  return new TextDecoder().decode(decrypted);
}

async function importRSAPrivateKey(pem: string): Promise<CryptoKey> {
  const pemHeader = "-----BEGIN PRIVATE KEY-----";
  const pemFooter = "-----END PRIVATE KEY-----";
  const pemContents = pem
    .replace(pemHeader, "")
    .replace(pemFooter, "")
    .replace(/\s+/g, "");
  const binaryDerString = atob(pemContents);
  const binaryDer = new Uint8Array(binaryDerString.length);
  for (let i = 0; i < binaryDerString.length; i++) {
    binaryDer[i] = binaryDerString.charCodeAt(i);
  }
  return crypto.subtle.importKey(
    "pkcs8",
    binaryDer.buffer,
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
    { name: "RSA-OAEP", hash: "SHA-256" } as any,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"]
  );
}

async function deriveKeyFromPassword(password: string, salt: Uint8Array, iterations = 100000): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt as any, iterations, hash: "SHA-256" },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"]
  );
}

self.onmessage = async (e: MessageEvent) => {
  const { file, credential, rawPrivateKeyPem, authToken, API_URL } = e.data;
  try {
    // 1. Fetch encrypted file
    const response = await fetch(`${API_URL}/files/${file.id}/download`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    if (!response.ok) throw new Error("Failed to download file from controller");

    const metaStr = response.headers.get("X-File-Metadata") ?? file.metadata;
    const metaObj = JSON.parse(metaStr);
    if (!metaObj.iv) throw new Error("Missing encryption IV");

    const iv = new Uint8Array(base64ToArrayBuffer(metaObj.iv));
    const isDropUpload = !metaObj.salt || metaObj.salt === "";
    const wrappedKeyB64 = response.headers.get("X-Wrapped-Key");
    let encryptionKey: CryptoKey;

    if (isDropUpload && file.pin_wrapped_key) {
      const rawKey = await unwrapKey(credential, file.pin_wrapped_key);
      const keyBytes = hexToBytes(rawKey);
      encryptionKey = await crypto.subtle.importKey(
        "raw",
        keyBytes as any,
        { name: "AES-GCM", length: 256 },
        false,
        ["decrypt"]
      );
    } else if (wrappedKeyB64 && file.is_owner === false) {
      if (!rawPrivateKeyPem) throw new Error("Private key PEM required for decryption");
      const rsaKey = await importRSAPrivateKey(rawPrivateKeyPem);
      encryptionKey = await unwrapKeyWithRSA(rsaKey, wrappedKeyB64);
    } else {
      if (!metaObj.salt) throw new Error("Missing encryption salt");
      const salt = new Uint8Array(base64ToArrayBuffer(metaObj.salt));
      encryptionKey = await deriveKeyFromPassword(credential, salt, 100000);
    }

    const encryptedBlob = await response.blob();
    const encryptedData = await encryptedBlob.arrayBuffer();
    const decryptedData = await decryptFile(encryptedData, encryptionKey, iv);

    // Send back decrypted array buffer via Transferable list
    (self as any).postMessage(
      { success: true, decryptedBuffer: decryptedData },
      [decryptedData]
    );
  } catch (err) {
    self.postMessage({
      success: false,
      error: err instanceof Error ? err.message : "Decryption failed",
    });
  }
};

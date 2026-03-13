/**
 * Client-Side Encryption Utilities
 * Uses Web Crypto API for AES-256-GCM encryption
 */

// Generate a random AES-256-GCM encryption key
export async function generateFileKey(): Promise<CryptoKey> {
  return await window.crypto.subtle.generateKey(
    {
      name: "AES-GCM",
      length: 256,
    },
    true, // extractable
    ["encrypt", "decrypt"]
  );
}

// Generate a random Initialization Vector (IV)
function generateIV(): Uint8Array {
  return window.crypto.getRandomValues(new Uint8Array(12)); // 96 bits for GCM
}

// Encrypt a file using AES-256-GCM
export async function encryptFile(
  file: File,
  key: CryptoKey
): Promise<{
  encryptedData: ArrayBuffer;
  iv: Uint8Array;
  metadata: {
    originalName: string;
    originalSize: number;
    mimeType: string;
  };
}> {
  // Read file as ArrayBuffer
  const fileBuffer = await file.arrayBuffer();

  // Generate random IV for this encryption
  const iv = generateIV();

  // Encrypt the file data
  const encryptedData = await window.crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: iv as any,
    },
    key,
    fileBuffer as ArrayBuffer
  );

  return {
    encryptedData,
    iv,
    metadata: {
      originalName: file.name,
      originalSize: file.size,
      mimeType: file.type,
    },
  };
}

// Decrypt a file using AES-256-GCM
export async function decryptFile(
  encryptedData: ArrayBuffer,
  key: CryptoKey,
  iv: Uint8Array
): Promise<ArrayBuffer> {
  try {
    const decryptedData = await window.crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: iv as any,
      },
      key,
      encryptedData
    );

    return decryptedData;
  } catch (error) {
    throw new Error("Decryption failed. Invalid key or corrupted data.");
  }
}

// Export key to base64 string for storage
export async function exportKey(key: CryptoKey): Promise<string> {
  const exported = await window.crypto.subtle.exportKey("raw", key);
  const exportedKeyBuffer = new Uint8Array(exported);
  return arrayBufferToBase64(exportedKeyBuffer);
}

// Import key from base64 string
export async function importKey(keyString: string): Promise<CryptoKey> {
  const keyBuffer = base64ToArrayBuffer(keyString);
  return await window.crypto.subtle.importKey(
    "raw",
    keyBuffer,
    {
      name: "AES-GCM",
      length: 256,
    },
    true,
    ["encrypt", "decrypt"]
  );
}

// Derive a key from a password using PBKDF2
export async function deriveKeyFromPassword(
  password: string,
  salt: Uint8Array,
  iterations: number = 100000
): Promise<CryptoKey> {
  // Normalize password to NFC form to handle special characters consistently
  // This ensures that accented characters, composed characters, etc. are
  // encoded the same way regardless of how they were entered
  const normalizedPassword = password.normalize('NFC');

  // Import password as key material
  const encoder = new TextEncoder();
  const passwordBuffer = encoder.encode(normalizedPassword);

  const keyMaterial = await window.crypto.subtle.importKey(
    "raw",
    passwordBuffer,
    { name: "PBKDF2" },
    false,
    ["deriveBits", "deriveKey"]
  );

  // Derive AES key from password
  return await window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt as any,
      iterations: iterations,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
}

// Generate a random salt for password-based key derivation
export function generateSalt(): Uint8Array {
  return window.crypto.getRandomValues(new Uint8Array(16)); // 128 bits
}

// Helper: Convert ArrayBuffer to Base64
export function arrayBufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Helper: Convert Base64 to ArrayBuffer
export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer as ArrayBuffer;
}

// Helper: Convert hex string to bytes
export function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) {
    throw new Error("Hex string must have even length");
  }
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

// Helper: Convert bytes to hex string
export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// Unwrap encryption key using password
// Wrapped key format: [16 bytes salt][12 bytes IV][encrypted key data]
// This reverses the WrapKey operation from the backend
export async function unwrapKey(password: string, wrappedKeyHex: string): Promise<string> {
  // Normalize password to NFC form to handle special characters consistently
  // This ensures compatibility with passwords containing accents, diacritics, etc.
  // Note: deriveKeyFromPassword also normalizes, but we do it here too for clarity
  const normalizedPassword = password.normalize('NFC');

  // 1. Decode hex to bytes
  const data = hexToBytes(wrappedKeyHex);

  if (data.length < 16 + 12 + 16) {
    throw new Error("Invalid wrapped key length");
  }

  // 2. Extract components (same format as backend)
  const salt = data.slice(0, 16);
  const iv = data.slice(16, 28);
  const encryptedKey = data.slice(28);

  // 3. Derive key from password using PBKDF2 (100k iterations, SHA-256)
  const derivedKey = await deriveKeyFromPassword(normalizedPassword, salt, 100000);

  // 4. Decrypt the encrypted key using AES-256-GCM
  const decryptedKeyBytes = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    derivedKey,
    encryptedKey
  );

  // 5. Convert decrypted bytes to string (the raw encryption key in hex)
  const rawKey = new TextDecoder().decode(decryptedKeyBytes);
  return rawKey;
}

// Helper: Create a Blob from decrypted data
export function createBlobFromDecrypted(
  decryptedData: ArrayBuffer,
  mimeType: string = "application/octet-stream"
): Blob {
  return new Blob([decryptedData], { type: mimeType });
}

// Helper: Trigger file download in browser
export function downloadFile(blob: Blob, filename: string): void {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

// Store encryption key in localStorage (for demo purposes)
// In production, consider more secure storage or never storing keys
export function storeKeyLocally(fileId: string, key: string): void {
  const keys = getStoredKeys();
  keys[fileId] = key;
  localStorage.setItem("file_encryption_keys", JSON.stringify(keys));
}

// Retrieve encryption key from localStorage
export function getStoredKey(fileId: string): string | null {
  const keys = getStoredKeys();
  return keys[fileId] || null;
}

// Get all stored keys
export function getStoredKeys(): Record<string, string> {
  const stored = localStorage.getItem("file_encryption_keys");
  return stored ? JSON.parse(stored) : {};
}

// Remove a stored key
export function removeStoredKey(fileId: string): void {
  const keys = getStoredKeys();
  delete keys[fileId];
  localStorage.setItem("file_encryption_keys", JSON.stringify(keys));
}

// Clear all stored keys (on logout)
export function clearAllStoredKeys(): void {
  localStorage.removeItem("file_encryption_keys");
}

/**
 * Encrypt metadata for storage
 * This encrypts sensitive file metadata before sending to server
 */
export async function encryptMetadata(
  metadata: object,
  key: CryptoKey
): Promise<{ encryptedMetadata: string; iv: string }> {
  const metadataString = JSON.stringify(metadata);
  const encoder = new TextEncoder();
  const metadataBuffer = encoder.encode(metadataString);

  const iv = generateIV();

  const encrypted = await window.crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: iv as any,
    },
    key,
    metadataBuffer
  );

  return {
    encryptedMetadata: arrayBufferToBase64(encrypted),
    iv: arrayBufferToBase64(iv),
  };
}

/**
 * Decrypt metadata retrieved from server
 */
export async function decryptMetadata(
  encryptedMetadata: string,
  key: CryptoKey,
  iv: string
): Promise<object> {
  const encryptedBuffer = base64ToArrayBuffer(encryptedMetadata);
  const ivBuffer = base64ToArrayBuffer(iv);

  const decrypted = await window.crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: new Uint8Array(ivBuffer) as any,
    },
    key,
    encryptedBuffer
  );

  const decoder = new TextDecoder();
  const metadataString = decoder.decode(decrypted);
  return JSON.parse(metadataString);
}

// Hash function for file integrity verification
export async function hashFile(data: ArrayBuffer): Promise<string> {
  const hashBuffer = await window.crypto.subtle.digest("SHA-256", data);
  return arrayBufferToBase64(hashBuffer);
}

// Verify file integrity
export async function verifyFileIntegrity(
  data: ArrayBuffer,
  expectedHash: string
): Promise<boolean> {
  const actualHash = await hashFile(data);
  return actualHash === expectedHash;
}

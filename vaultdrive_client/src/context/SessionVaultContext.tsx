import { createContext, useContext, useRef, useCallback, useEffect, type ReactNode } from "react";
import { arrayBufferToBase64, base64ToArrayBuffer, importRSAPrivateKey } from "../utils/crypto";

export interface CachedCredential {
  value: string;
  type: "pin" | "password";
}

interface SessionVaultContextType {
  getPrivateKey: () => CryptoKey | null;
  setPrivateKey: (key: CryptoKey, rawPem?: string) => void;
  getPrivateKeyPem: () => Promise<string | null>;
  getFileKey: (fileId: string) => CryptoKey | null;
  setFileKey: (fileId: string, key: CryptoKey) => void;
  getFolderKey: (folderId: string) => CryptoKey | null;
  setFolderKey: (folderId: string, key: CryptoKey) => void;
  getCredential: () => CachedCredential | null;
  setCredential: (value: string, type: "pin" | "password") => void;
  getAutoCredential: () => CachedCredential | null;
  clearVault: () => void;
}

const SessionVaultContext = createContext<SessionVaultContextType | null>(null);

// Ephemeral page-load key generated synchronously once when JS module loads
const EPHEMERAL_KEY = Array.from(
  window.crypto?.getRandomValues(new Uint8Array(16)) ?? [],
  (b) => b.toString(16).padStart(2, "0")
).join("") || "fallback-static-key-if-no-crypto";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

async function getEphemeralCryptoKey(rawKey: string): Promise<CryptoKey> {
  const keyMaterial = encoder.encode(rawKey);
  const hash = await window.crypto.subtle.digest("SHA-256", keyMaterial);
  return await window.crypto.subtle.importKey(
    "raw",
    hash,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"]
  );
}

async function encryptData(rawData: string, rawKey: string): Promise<string> {
  const key = await getEphemeralCryptoKey(rawKey);
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoder.encode(rawData)
  );
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);
  return arrayBufferToBase64(combined.buffer);
}

async function decryptData(encryptedB64: string, rawKey: string): Promise<string> {
  const key = await getEphemeralCryptoKey(rawKey);
  const combined = new Uint8Array(base64ToArrayBuffer(encryptedB64));
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);
  const decrypted = await window.crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext
  );
  return decoder.decode(decrypted);
}

export function SessionVaultProvider({ children }: { children: ReactNode }) {
  const privateKeyRef = useRef<CryptoKey | null>(null);
  const fileKeyMap = useRef<Map<string, CryptoKey>>(new Map());
  const folderKeyMap = useRef<Map<string, CryptoKey>>(new Map());
  const credentialRef = useRef<CachedCredential | null>(null);

  const getPrivateKey = useCallback(() => privateKeyRef.current, []);
  
  const setPrivateKey = useCallback((key: CryptoKey, rawPem?: string) => {
    privateKeyRef.current = key;
    if (rawPem) {
      encryptData(rawPem, EPHEMERAL_KEY)
        .then((ciphertext) => {
          sessionStorage.setItem("vault_cached_private_key", ciphertext);
        })
        .catch((err) => console.error("Failed to cache private key in sessionStorage:", err));
    }
  }, []);

  const getPrivateKeyPem = useCallback(async () => {
    const cached = sessionStorage.getItem("vault_cached_private_key");
    if (!cached) return null;
    try {
      return await decryptData(cached, EPHEMERAL_KEY);
    } catch {
      return null;
    }
  }, []);

  const getFileKey = useCallback((fileId: string) => fileKeyMap.current.get(fileId) ?? null, []);
  const setFileKey = useCallback((fileId: string, key: CryptoKey) => {
    fileKeyMap.current.set(fileId, key);
  }, []);

  const getFolderKey = useCallback((folderId: string) => folderKeyMap.current.get(folderId) ?? null, []);
  const setFolderKey = useCallback((folderId: string, key: CryptoKey) => {
    folderKeyMap.current.set(folderId, key);
  }, []);

  const getCredential = useCallback(() => credentialRef.current, []);
  
  const setCredential = useCallback((value: string, type: "pin" | "password") => {
    credentialRef.current = { value, type };
    encryptData(JSON.stringify({ value, type }), EPHEMERAL_KEY)
      .then((ciphertext) => {
        sessionStorage.setItem("vault_cached_credential", ciphertext);
      })
      .catch((err) => console.error("Failed to cache credential in sessionStorage:", err));
  }, []);

  const getAutoCredential = useCallback(() => {
    return credentialRef.current;
  }, []);

  const clearVault = useCallback(() => {
    privateKeyRef.current = null;
    fileKeyMap.current.clear();
    folderKeyMap.current.clear();
    credentialRef.current = null;
    sessionStorage.removeItem("vault_cached_private_key");
    sessionStorage.removeItem("vault_cached_credential");
  }, []);

  // Background async restore on mount
  useEffect(() => {
    async function restoreSession() {
      try {
        const storedKey = sessionStorage.getItem("vault_cached_private_key");
        if (storedKey) {
          const rawPem = await decryptData(storedKey, EPHEMERAL_KEY);
          const cryptoKey = await importRSAPrivateKey(rawPem);
          privateKeyRef.current = cryptoKey;
        }
      } catch (e) {
        // Ephemeral key mismatch or empty storage, expected on reload/expired session
      }
      try {
        const storedCred = sessionStorage.getItem("vault_cached_credential");
        if (storedCred) {
          const decryptedJson = await decryptData(storedCred, EPHEMERAL_KEY);
          credentialRef.current = JSON.parse(decryptedJson);
        }
      } catch (e) {
        // Ephemeral key mismatch or empty storage, expected on reload/expired session
      }
    }
    void restoreSession();
  }, []);

  return (
    <SessionVaultContext.Provider
      value={{
        getPrivateKey,
        setPrivateKey,
        getPrivateKeyPem,
        getFileKey,
        setFileKey,
        getFolderKey,
        setFolderKey,
        getCredential,
        setCredential,
        getAutoCredential,
        clearVault,
      }}
    >
      {children}
    </SessionVaultContext.Provider>
  );
}

export function useSessionVault() {
  const ctx = useContext(SessionVaultContext);
  if (!ctx) throw new Error("useSessionVault must be used inside SessionVaultProvider");
  return ctx;
}

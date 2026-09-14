import { createContext, useContext } from "react";

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
  clearCredential: () => void;
  getAutoCredential: () => CachedCredential | null;
  clearVault: () => void;
}

export const SessionVaultContext = createContext<SessionVaultContextType | null>(null);

export function parseCachedCredential(value: unknown): CachedCredential | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = value as Partial<CachedCredential>;
  if (candidate.type !== "pin" && candidate.type !== "password") return null;
  if (typeof candidate.value !== "string") return null;
  if (candidate.type === "pin" && !/^\d{4}$/.test(candidate.value)) return null;
  if (candidate.type === "password" && candidate.value.trim().length === 0) return null;
  return { value: candidate.value, type: candidate.type };
}

export function useSessionVault() {
  const ctx = useContext(SessionVaultContext);
  if (!ctx) throw new Error("useSessionVault must be used inside SessionVaultProvider");
  return ctx;
}

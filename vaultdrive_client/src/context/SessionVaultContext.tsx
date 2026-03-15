import { createContext, useContext, useRef, useCallback, type ReactNode } from "react";

export interface CachedCredential {
  value: string;
  type: "pin" | "password";
}

interface SessionVaultContextType {
  getPrivateKey: () => CryptoKey | null;
  setPrivateKey: (key: CryptoKey) => void;
  getFileKey: (fileId: string) => CryptoKey | null;
  setFileKey: (fileId: string, key: CryptoKey) => void;
  getCredential: () => CachedCredential | null;
  setCredential: (value: string, type: "pin" | "password") => void;
  clearVault: () => void;
}

const SessionVaultContext = createContext<SessionVaultContextType | null>(null);

export function SessionVaultProvider({ children }: { children: ReactNode }) {
  const privateKeyRef = useRef<CryptoKey | null>(null);
  const fileKeyMap = useRef<Map<string, CryptoKey>>(new Map());
  const credentialRef = useRef<CachedCredential | null>(null);

  const getPrivateKey = useCallback(() => privateKeyRef.current, []);
  const setPrivateKey = useCallback((key: CryptoKey) => { privateKeyRef.current = key; }, []);

  const getFileKey = useCallback((fileId: string) => fileKeyMap.current.get(fileId) ?? null, []);
  const setFileKey = useCallback((fileId: string, key: CryptoKey) => {
    fileKeyMap.current.set(fileId, key);
  }, []);

  const getCredential = useCallback(() => credentialRef.current, []);
  const setCredential = useCallback((value: string, type: "pin" | "password") => {
    credentialRef.current = { value, type };
  }, []);

  const clearVault = useCallback(() => {
    privateKeyRef.current = null;
    fileKeyMap.current.clear();
    credentialRef.current = null;
  }, []);

  return (
    <SessionVaultContext.Provider value={{ getPrivateKey, setPrivateKey, getFileKey, setFileKey, getCredential, setCredential, clearVault }}>
      {children}
    </SessionVaultContext.Provider>
  );
}

export function useSessionVault() {
  const ctx = useContext(SessionVaultContext);
  if (!ctx) throw new Error("useSessionVault must be used inside SessionVaultProvider");
  return ctx;
}

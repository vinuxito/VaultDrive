import { createContext, useContext, useRef, useCallback, type ReactNode } from "react";

interface SessionVaultContextType {
  getPrivateKey: () => CryptoKey | null;
  setPrivateKey: (key: CryptoKey) => void;
  getFileKey: (fileId: string) => CryptoKey | null;
  setFileKey: (fileId: string, key: CryptoKey) => void;
  clearVault: () => void;
}

const SessionVaultContext = createContext<SessionVaultContextType | null>(null);

export function SessionVaultProvider({ children }: { children: ReactNode }) {
  const privateKeyRef = useRef<CryptoKey | null>(null);
  const fileKeyMap = useRef<Map<string, CryptoKey>>(new Map());

  const getPrivateKey = useCallback(() => privateKeyRef.current, []);
  const setPrivateKey = useCallback((key: CryptoKey) => { privateKeyRef.current = key; }, []);

  const getFileKey = useCallback((fileId: string) => fileKeyMap.current.get(fileId) ?? null, []);
  const setFileKey = useCallback((fileId: string, key: CryptoKey) => {
    fileKeyMap.current.set(fileId, key);
  }, []);

  const clearVault = useCallback(() => {
    privateKeyRef.current = null;
    fileKeyMap.current.clear();
  }, []);

  return (
    <SessionVaultContext.Provider value={{ getPrivateKey, setPrivateKey, getFileKey, setFileKey, clearVault }}>
      {children}
    </SessionVaultContext.Provider>
  );
}

export function useSessionVault() {
  const ctx = useContext(SessionVaultContext);
  if (!ctx) throw new Error("useSessionVault must be used inside SessionVaultProvider");
  return ctx;
}

import { createContext, useContext, useRef, useCallback, type ReactNode } from "react";

interface SessionVaultContextType {
  getPrivateKey: () => CryptoKey | null;
  setPrivateKey: (key: CryptoKey) => void;
  clearVault: () => void;
}

const SessionVaultContext = createContext<SessionVaultContextType | null>(null);

export function SessionVaultProvider({ children }: { children: ReactNode }) {
  const keyRef = useRef<CryptoKey | null>(null);
  const getPrivateKey = useCallback(() => keyRef.current, []);
  const setPrivateKey = useCallback((key: CryptoKey) => { keyRef.current = key; }, []);
  const clearVault = useCallback(() => { keyRef.current = null; }, []);
  return (
    <SessionVaultContext.Provider value={{ getPrivateKey, setPrivateKey, clearVault }}>
      {children}
    </SessionVaultContext.Provider>
  );
}

export function useSessionVault() {
  const ctx = useContext(SessionVaultContext);
  if (!ctx) throw new Error("useSessionVault must be used inside SessionVaultProvider");
  return ctx;
}

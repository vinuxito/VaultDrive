import { useCallback } from "react";

import { useSessionVault } from "../context/SessionVaultContext";
import { useTransitionNavigate } from "./useTransitionNavigate";

const AUTH_STORAGE_KEYS = ["token", "refresh_token", "user"] as const;

export function useLogout() {
  const { clearVault } = useSessionVault();
  const navigate = useTransitionNavigate();

  return useCallback(() => {
    clearVault();
    AUTH_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
    window.dispatchEvent(new Event("auth-change"));
    navigate("/login", { replace: true });
  }, [clearVault, navigate]);
}

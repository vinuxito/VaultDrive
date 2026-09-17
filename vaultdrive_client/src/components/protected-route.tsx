import { useEffect } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useSessionVault } from "../context/SessionVaultContext";
import { clearAuthSessionStorage, getSafeLoginIntent } from "../utils/auth-session";
import { DashboardLayout } from "./layout/dashboard-layout";

/**
 * Decode a JWT and return the payload without verifying the signature.
 * Signature verification happens server-side; this is only used to check
 * the exp claim client-side so we can redirect before making any API call.
 */
function decodeJWTPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3 || !parts[1]) return null;
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const decoded: unknown = JSON.parse(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "=")));
    return decoded !== null && typeof decoded === "object" && !Array.isArray(decoded)
      ? decoded as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}

function readAuthState() {
  const token = localStorage.getItem("token");
  const rawUser = localStorage.getItem("user");
  let user: Record<string, unknown> | null = null;
  try {
    const parsed: unknown = rawUser ? JSON.parse(rawUser) : null;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) user = parsed as Record<string, unknown>;
  } catch { user = null; }

  const payload = token ? decodeJWTPayload(token) : null;
  const validToken = Boolean(token) && (
    typeof payload?.exp === "number" && Number.isFinite(payload.exp)
    && payload.exp * 1000 > Date.now() + 10_000
  );
  const authenticated = validToken && user !== null;
  return {
    authenticated,
    forcePasswordChange: authenticated && user?.force_password_change === true,
    needsClear: !authenticated && Boolean(token || rawUser || localStorage.getItem("refresh_token")),
  };
}

export const ProtectedRoute = () => {
  const location = useLocation();
  const { clearVault } = useSessionVault();
  const { authenticated, forcePasswordChange, needsClear } = readAuthState();

  useEffect(() => {
    if (!needsClear) return;
    clearAuthSessionStorage();
    clearVault();
  }, [clearVault, needsClear]);

  if (!authenticated) {
    const from = getSafeLoginIntent({ pathname: location.pathname, search: location.search });
    return <Navigate to="/login" replace state={from ? { from } : null} />;
  }

  if (forcePasswordChange) {
    return <Navigate to="/force-password-change" replace />;
  }

  return (
    <DashboardLayout>
      <Outlet />
    </DashboardLayout>
  );
};

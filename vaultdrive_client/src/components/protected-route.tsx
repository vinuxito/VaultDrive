import { Navigate, Outlet } from 'react-router-dom';
import { DashboardLayout } from './layout/dashboard-layout';

/**
 * Decode a JWT and return the payload without verifying the signature.
 * Signature verification happens server-side; this is only used to check
 * the exp claim client-side so we can redirect before making any API call.
 */
function decodeJWTPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    // Base64url → base64 → decode
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '=='.slice((base64.length % 4 === 0) ? 4 : base64.length % 4);
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}

function isTokenExpired(token: string): boolean {
  const payload = decodeJWTPayload(token);
  if (!payload || typeof payload.exp !== 'number') return false;
  // exp is seconds since epoch; add 10s buffer for clock skew
  return payload.exp * 1000 < Date.now() - 10_000;
}

const useAuth = () => {
  const token = localStorage.getItem('token');
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  const expired = token ? isTokenExpired(token) : false;
  if (expired) {
    // Clear stale session material immediately
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  }

  return {
    isAuthenticated: !!token && !expired,
    forcePasswordChange: !!user.force_password_change,
  };
};

export const ProtectedRoute = () => {
  const { isAuthenticated, forcePasswordChange } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
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

/**
 * Call this from any fetch wrapper when the server returns 401.
 * Clears localStorage and reloads to the login page.
 */
export function handleUnauthorized(): void {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = '/login';
}

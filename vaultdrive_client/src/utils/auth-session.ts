import { buildAppUrl, getBasePathForLocation } from "./base-path";

const AUTH_STORAGE_KEYS = ["token", "refresh_token", "user"] as const;
const VAULT_SESSION_KEYS = ["vault_cached_private_key", "vault_cached_credential"] as const;

export interface LoginIntent {
  pathname: string;
  search?: string;
}

const PROTECTED_ROUTES = new Set([
  "/dashboard", "/files", "/shared", "/profile", "/settings", "/groups",
  "/admin", "/admin/tests", "/access-center", "/help",
]);
const HELP_SECTIONS = new Set([
  "getting_started", "vault_pin", "uploads_shares", "drop_portals", "workspaces",
  "user_management", "agent_keys", "audit_logs", "system_settings",
]);
const UUID_ROUTE = /^\/(groups|room)\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function clearAuthSessionStorage(): void {
  AUTH_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
  VAULT_SESSION_KEYS.forEach((key) => sessionStorage.removeItem(key));
}

export function getSafeLoginIntent(value: unknown): LoginIntent | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as { pathname?: unknown; search?: unknown };
  if (
    typeof candidate.pathname !== "string"
    || !candidate.pathname.startsWith("/")
    || candidate.pathname.startsWith("//")
    || candidate.pathname.includes("\\")
    || candidate.pathname === "/login"
    || (!PROTECTED_ROUTES.has(candidate.pathname) && !UUID_ROUTE.test(candidate.pathname))
  ) return null;

  let search: string | undefined;
  if (candidate.pathname === "/help" && typeof candidate.search === "string") {
    const params = new URLSearchParams(candidate.search);
    const section = params.get("section");
    if (params.size === 1 && section && HELP_SECTIONS.has(section)) search = `?section=${encodeURIComponent(section)}`;
  }
  return { pathname: candidate.pathname, ...(search ? { search } : {}) };
}

export function getLoginUrl(location: Pick<Location, "origin" | "hostname" | "pathname"> = window.location): string {
  const basePath = getBasePathForLocation(location.hostname, location.pathname);
  return buildAppUrl(location.origin, basePath, "/login");
}

export function handleUnauthorized(): void {
  clearAuthSessionStorage();
  window.location.replace(getLoginUrl());
}

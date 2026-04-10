import { branding } from "../config/branding";

/**
 * Determine the SPA base path for a given hostname + pathname combination.
 *
 * Rules:
 *   1. If the hostname is listed in `rootHostedHosts`, the app is served at
 *      the site root. Use the configured base path only if the pathname
 *      still contains it (legacy routes).
 *   2. Otherwise, always use the configured base path.
 *
 * `configuredBasePath` and `rootHostedHosts` default to the branding config
 * values but can be overridden for tests.
 */
export function getBasePathForLocation(
  hostname: string,
  pathname: string,
  configuredBasePath: string = branding.basePath,
  rootHostedHosts: string[] = branding.rootHostedHosts,
): string {
  const base = configuredBasePath.replace(/\/$/, "");
  const isRootHosted = rootHostedHosts.includes(hostname);

  if (!isRootHosted) {
    return base;
  }

  const prefix = `${base}/`;
  if (pathname === base || pathname.startsWith(prefix)) {
    return base;
  }
  return "";
}

export function buildAppUrl(origin: string, basePath: string, path: string): string {
  const normalizedOrigin = origin.endsWith("/") ? origin.slice(0, -1) : origin;
  const normalizedBasePath = basePath === "/" ? "" : basePath.replace(/\/$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${normalizedOrigin}${normalizedBasePath}${normalizedPath}`;
}

export const BASE_PATH = getBasePathForLocation(
  window.location.hostname,
  window.location.pathname,
);

export function getBasePathForLocation(hostname: string, pathname: string): string {
  if (hostname !== "abrndrive.filemonprime.net") {
    return "/abrn";
  }

  return pathname === "/abrn" || pathname.startsWith("/abrn/") ? "/abrn" : "";
}

export function buildAppUrl(origin: string, basePath: string, path: string): string {
  const normalizedOrigin = origin.endsWith("/") ? origin.slice(0, -1) : origin;
  const normalizedBasePath = basePath === "/" ? "" : basePath.replace(/\/$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${normalizedOrigin}${normalizedBasePath}${normalizedPath}`;
}

export const BASE_PATH = getBasePathForLocation(window.location.hostname, window.location.pathname);

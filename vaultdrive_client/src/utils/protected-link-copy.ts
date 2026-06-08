export type ProtectedLinkKind = "upload-link" | "folder-share";

interface ValidateProtectedLinkOptions {
  expectedPath: string;
  kind: ProtectedLinkKind;
}

type ValidateProtectedLinkResult =
  | { ok: true; url: string }
  | { ok: false; error: string };

function normalizePath(path: string): string {
  if (!path) return "/";

  const withLeadingSlash = path.startsWith("/") ? path : `/${path}`;
  return withLeadingSlash.replace(/\/+$/, "") || "/";
}

function getUnavailableMessage(kind: ProtectedLinkKind): string {
  return kind === "upload-link"
    ? "The full upload link is unavailable. Recover the link again and retry."
    : "The folder share route is incomplete. Generate it again before copying.";
}

function getMissingFragmentMessage(kind: ProtectedLinkKind): string {
  return kind === "upload-link"
    ? "The full upload link is unavailable. Recover the link again and retry."
    : "The folder share key is missing. Generate it again before copying.";
}

export function validateProtectedLinkForCopy(
  rawUrl: string,
  { expectedPath, kind }: ValidateProtectedLinkOptions,
): ValidateProtectedLinkResult {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return { ok: false, error: getUnavailableMessage(kind) };
  }

  try {
    const parsed = new URL(trimmed, "https://quantix-drive.local");
    if (normalizePath(parsed.pathname) !== normalizePath(expectedPath)) {
      return { ok: false, error: getUnavailableMessage(kind) };
    }

    const fragment = parsed.hash.replace(/^#/, "").trim();
    if (!fragment) {
      return { ok: false, error: getMissingFragmentMessage(kind) };
    }

    if (kind === "upload-link") {
      const params = new URLSearchParams(fragment);
      if (!params.get("key")) {
        return { ok: false, error: getMissingFragmentMessage(kind) };
      }
    }

    return { ok: true, url: trimmed };
  } catch {
    return { ok: false, error: getUnavailableMessage(kind) };
  }
}

export function validateUploadLinkForCopy(
  rawUrl: string,
  token: string,
  basePath: string,
): ValidateProtectedLinkResult {
  const normalizedBasePath = normalizePath(basePath) === "/" ? "" : normalizePath(basePath);
  return validateProtectedLinkForCopy(rawUrl, {
    expectedPath: `${normalizedBasePath}/drop/${token}`,
    kind: "upload-link",
  });
}

export function validateFolderShareLinkForCopy(
  rawUrl: string,
  token: string,
  basePath: string,
): ValidateProtectedLinkResult {
  const normalizedBasePath = normalizePath(basePath) === "/" ? "" : normalizePath(basePath);
  return validateProtectedLinkForCopy(rawUrl, {
    expectedPath: `${normalizedBasePath}/folder-share/${token}`,
    kind: "folder-share",
  });
}

export function buildMaskedProtectedLink(rawUrl: string, kind: ProtectedLinkKind): string {
  const trimmed = rawUrl.trim();
  const base = trimmed.includes("#") ? trimmed.split("#")[0] ?? trimmed : trimmed;
  if (!base) {
    return kind === "upload-link"
      ? "URL available after PIN verification"
      : "Folder share available after PIN verification";
  }

  return kind === "upload-link" ? `${base}#key=••••••••` : `${base}#••••••••`;
}

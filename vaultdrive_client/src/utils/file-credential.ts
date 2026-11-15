export type FileCredentialScheme = "drop-pin" | "pin" | "password" | "folder";

export interface FileCredentialDescriptor {
  pin_wrapped_key?: string | null;
  metadata?: string;
  is_owner?: boolean;
}

function parseFileMetadataScheme(metadata?: string): string | undefined {
  if (!metadata) return undefined;
  try {
    const parsed = JSON.parse(metadata) as { credential_scheme?: string };
    return parsed.credential_scheme;
  } catch {
    // Older records can contain malformed metadata; ownership remains the fallback.
    return undefined;
  }
}

export function isRsaKeyWrappedFile(
  file: FileCredentialDescriptor & { folder_id?: string | null },
): boolean {
  const scheme = parseFileMetadataScheme(file.metadata);
  if (scheme === "rsa") return true;
  if (scheme === "folder" && (file.is_owner !== false || Boolean(file.folder_id))) {
    return false;
  }
  return file.is_owner === false && !file.pin_wrapped_key;
}

export function getFileCredentialScheme(
  file: FileCredentialDescriptor,
): FileCredentialScheme {
  if (file.pin_wrapped_key) return "drop-pin";

  const scheme = parseFileMetadataScheme(file.metadata);
  if (scheme === "folder") return "folder";
  if (scheme === "pin" || scheme === "rsa") return "pin";

  // Shared files use the recipient's PIN to unlock their RSA private key.
  if (file.is_owner === false) return "pin";
  return "password";
}

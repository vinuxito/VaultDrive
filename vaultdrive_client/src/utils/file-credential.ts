export type FileCredentialScheme = "drop-pin" | "pin" | "password" | "folder";

export interface FileCredentialDescriptor {
  pin_wrapped_key?: string | null;
  metadata?: string;
  is_owner?: boolean;
}

export function getFileCredentialScheme(
  file: FileCredentialDescriptor,
): FileCredentialScheme {
  if (file.pin_wrapped_key) return "drop-pin";

  if (file.metadata) {
    try {
      const metadata = JSON.parse(file.metadata) as { credential_scheme?: string };
      if (metadata.credential_scheme === "folder") return "folder";
      if (metadata.credential_scheme === "pin") return "pin";
    } catch {
      // Older records can contain malformed metadata; ownership remains the fallback.
    }
  }

  // Shared files use the recipient's PIN to unlock their RSA private key.
  if (file.is_owner === false) return "pin";
  return "password";
}

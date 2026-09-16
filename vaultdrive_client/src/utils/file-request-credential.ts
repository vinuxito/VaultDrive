/** Older File Request uploads store a 16-byte PBKDF2 salt in the owner
 * access-key column. This is not a PIN envelope or an RSA-wrapped key. */
export function legacyFileRequestSalt(
  metadata: { credential_scheme?: string },
  wrappedKey: string | null | undefined,
): string | undefined {
  if (metadata.credential_scheme && metadata.credential_scheme !== "password") return undefined;
  if (!wrappedKey || !/^[A-Za-z0-9+/]{22}==$/.test(wrappedKey)) return undefined;
  try {
    const bytes = atob(wrappedKey);
    return bytes.length === 16 && btoa(bytes) === wrappedKey ? wrappedKey : undefined;
  } catch {
    return undefined;
  }
}

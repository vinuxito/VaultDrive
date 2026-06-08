import { beforeEach, describe, expect, it, vi } from "vitest";

const cryptoMocks = vi.hoisted(() => ({
  deriveKeyFromPassword: vi.fn(),
  unwrapKeyWithRSA: vi.fn(),
  unwrapKey: vi.fn(),
  hexToBytes: vi.fn(),
}));

vi.mock("./crypto", async () => {
  const actual = await vi.importActual<typeof import("./crypto")>("./crypto");
  return {
    ...actual,
    deriveKeyFromPassword: cryptoMocks.deriveKeyFromPassword,
    unwrapKeyWithRSA: cryptoMocks.unwrapKeyWithRSA,
    unwrapKey: cryptoMocks.unwrapKey,
    hexToBytes: cryptoMocks.hexToBytes,
  };
});

import { resolveFolderShareFileKey } from "./folder-share";

describe("resolveFolderShareFileKey", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("derives the file key for owner-style wrapped keys instead of treating them as RSA ciphertext", async () => {
    const derivedKey = { kind: "derived" } as unknown as CryptoKey;
    cryptoMocks.deriveKeyFromPassword.mockResolvedValue(derivedKey);

    const result = await resolveFolderShareFileKey({
      wrappedKey: "c2FsdA==:aXY=",
      encryptedMetadata: JSON.stringify({
        salt: "YWJjZGVmZ2hpamtsbW5vcA==",
        credential_scheme: "pin",
      }),
      credential: "2468",
      credentialType: "pin",
      rsaPrivateKey: { kind: "rsa" } as unknown as CryptoKey,
    });

    expect(result).toBe(derivedKey);
    expect(cryptoMocks.deriveKeyFromPassword).toHaveBeenCalledTimes(1);
    expect(cryptoMocks.unwrapKeyWithRSA).not.toHaveBeenCalled();
  });

  it("still unwraps RSA-wrapped keys for non-owner entries", async () => {
    const rsaKey = { kind: "rsa-unwrapped" } as unknown as CryptoKey;
    cryptoMocks.unwrapKeyWithRSA.mockResolvedValue(rsaKey);

    const result = await resolveFolderShareFileKey({
      wrappedKey: "cmVhbC1yc2EtY2lwaGVydGV4dA==",
      encryptedMetadata: JSON.stringify({ credential_scheme: "pin" }),
      credential: "2468",
      credentialType: "pin",
      rsaPrivateKey: { kind: "rsa" } as unknown as CryptoKey,
    });

    expect(result).toBe(rsaKey);
    expect(cryptoMocks.unwrapKeyWithRSA).toHaveBeenCalledWith(
      expect.anything(),
      "cmVhbC1yc2EtY2lwaGVydGV4dA==",
    );
    expect(cryptoMocks.deriveKeyFromPassword).not.toHaveBeenCalled();
  });

  it("unwraps secure-drop PIN keys stored as hex instead of treating them as RSA ciphertext", async () => {
    const importedKey = { kind: "drop-pin" } as unknown as CryptoKey;
    cryptoMocks.unwrapKey.mockResolvedValue("00112233");
    cryptoMocks.hexToBytes.mockReturnValue(new Uint8Array([0, 17, 34, 51]));

    const importKeySpy = vi.spyOn(window.crypto.subtle, "importKey").mockResolvedValue(importedKey);

    const result = await resolveFolderShareFileKey({
      wrappedKey: "abcdef0123456789",
      encryptedMetadata: JSON.stringify({ algorithm: "AES-256-GCM" }),
      credential: "2468",
      credentialType: "pin",
      rsaPrivateKey: { kind: "rsa" } as unknown as CryptoKey,
    });

    expect(result).toBe(importedKey);
    expect(cryptoMocks.unwrapKey).toHaveBeenCalledWith("2468", "abcdef0123456789");
    expect(cryptoMocks.unwrapKeyWithRSA).not.toHaveBeenCalled();
    expect(importKeySpy).toHaveBeenCalled();
    importKeySpy.mockRestore();
  });

  it("fails clearly when a password-encrypted owner file is shared from a PIN-only flow", async () => {
    await expect(
      resolveFolderShareFileKey({
        wrappedKey: "c2FsdA==:aXY=",
        encryptedMetadata: JSON.stringify({
          salt: "YWJjZGVmZ2hpamtsbW5vcA==",
          credential_scheme: "password",
        }),
        credential: "2468",
        credentialType: "pin",
        rsaPrivateKey: { kind: "rsa" } as unknown as CryptoKey,
      }),
    ).rejects.toThrow(
      "This folder contains files encrypted with your account password. Share it from a password-authenticated session first.",
    );
  });
});

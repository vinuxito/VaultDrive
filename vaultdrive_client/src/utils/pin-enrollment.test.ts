import { beforeEach, describe, expect, it, vi } from "vitest";

const cryptoMocks = vi.hoisted(() => ({
  decryptPrivateKeyWithPassword: vi.fn(),
  encryptPrivateKeyWithPIN: vi.fn(),
}));

vi.mock("./crypto", () => ({
  decryptPrivateKeyWithPassword: cryptoMocks.decryptPrivateKeyWithPassword,
  encryptPrivateKeyWithPIN: cryptoMocks.encryptPrivateKeyWithPIN,
}));

import { createPinProtectedPrivateKey } from "./pin-enrollment";

describe("createPinProtectedPrivateKey", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("re-encrypts the stored private key with the chosen pin", async () => {
    cryptoMocks.decryptPrivateKeyWithPassword.mockResolvedValue("PRIVATE KEY PEM");
    cryptoMocks.encryptPrivateKeyWithPIN.mockResolvedValue("pin-wrapped-private-key");

    await expect(
      createPinProtectedPrivateKey({
        privateKeyEncrypted: "password-wrapped-private-key",
        password: "correct horse battery staple",
        pin: "1234",
      }),
    ).resolves.toBe("pin-wrapped-private-key");

    expect(cryptoMocks.decryptPrivateKeyWithPassword).toHaveBeenCalledWith(
      "correct horse battery staple",
      "password-wrapped-private-key",
    );
    expect(cryptoMocks.encryptPrivateKeyWithPIN).toHaveBeenCalledWith("1234", "PRIVATE KEY PEM");
  });

  it("skips pin private-key enrollment when no encrypted private key exists", async () => {
    await expect(
      createPinProtectedPrivateKey({
        privateKeyEncrypted: null,
        password: "correct horse battery staple",
        pin: "1234",
      }),
    ).resolves.toBeUndefined();

    expect(cryptoMocks.decryptPrivateKeyWithPassword).not.toHaveBeenCalled();
    expect(cryptoMocks.encryptPrivateKeyWithPIN).not.toHaveBeenCalled();
  });
});

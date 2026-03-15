import { beforeEach, describe, expect, it, vi } from "vitest";

const cryptoMocks = vi.hoisted(() => ({
  decryptPrivateKeyWithPIN: vi.fn(),
  importRSAPrivateKey: vi.fn(),
}));

vi.mock("./crypto", () => ({
  decryptPrivateKeyWithPIN: cryptoMocks.decryptPrivateKeyWithPIN,
  importRSAPrivateKey: cryptoMocks.importRSAPrivateKey,
}));

import { restorePrivateKeyFromSessionPin } from "./shared-session";

describe("restorePrivateKeyFromSessionPin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("restores a private key from the cached session pin", async () => {
    const cryptoKey = { id: "rsa-key" } as unknown as CryptoKey;
    cryptoMocks.decryptPrivateKeyWithPIN.mockResolvedValue("PRIVATE KEY PEM");
    cryptoMocks.importRSAPrivateKey.mockResolvedValue(cryptoKey);

    await expect(
      restorePrivateKeyFromSessionPin({
        credential: { type: "pin", value: "1234" },
        privateKeyPinEncrypted: "pin-wrapped-private-key",
      }),
    ).resolves.toBe(cryptoKey);

    expect(cryptoMocks.decryptPrivateKeyWithPIN).toHaveBeenCalledWith("1234", "pin-wrapped-private-key");
    expect(cryptoMocks.importRSAPrivateKey).toHaveBeenCalledWith("PRIVATE KEY PEM");
  });

  it("returns null when the session has no reusable pin", async () => {
    await expect(
      restorePrivateKeyFromSessionPin({
        credential: { type: "password", value: "secret" },
        privateKeyPinEncrypted: "pin-wrapped-private-key",
      }),
    ).resolves.toBeNull();

    expect(cryptoMocks.decryptPrivateKeyWithPIN).not.toHaveBeenCalled();
    expect(cryptoMocks.importRSAPrivateKey).not.toHaveBeenCalled();
  });
});

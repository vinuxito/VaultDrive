import { beforeEach, describe, expect, it, vi } from "vitest";

const cryptoMocks = vi.hoisted(() => ({
  decryptPrivateKeyWithPassword: vi.fn(),
  encryptPrivateKeyWithPIN: vi.fn(),
  encryptPrivateKeyWithPassword: vi.fn(),
}));

vi.mock("./crypto", () => ({
  decryptPrivateKeyWithPassword: cryptoMocks.decryptPrivateKeyWithPassword,
  encryptPrivateKeyWithPIN: cryptoMocks.encryptPrivateKeyWithPIN,
  encryptPrivateKeyWithPassword: cryptoMocks.encryptPrivateKeyWithPassword,
}));

import {
  createPinProtectedPrivateKey,
  getPinEnrollmentErrorMessage,
} from "./pin-enrollment";

describe("createPinProtectedPrivateKey", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("re-encrypts the stored private key with the chosen pin", async () => {
    cryptoMocks.decryptPrivateKeyWithPassword.mockResolvedValue("PRIVATE KEY PEM");
    cryptoMocks.encryptPrivateKeyWithPIN.mockResolvedValue("pin-wrapped-private-key");

    const result = await createPinProtectedPrivateKey({
      privateKeyEncrypted: "password-wrapped-private-key",
      password: "correct horse battery staple",
      pin: "1234",
    });

    expect(result).toEqual({
      privateKeyPinEncrypted: "pin-wrapped-private-key",
    });

    expect(cryptoMocks.decryptPrivateKeyWithPassword).toHaveBeenCalledWith(
      "correct horse battery staple",
      "password-wrapped-private-key",
      1
    );
    expect(cryptoMocks.encryptPrivateKeyWithPIN).toHaveBeenCalledWith("1234", "PRIVATE KEY PEM", 1);
  });

  it("fails loudly when the encrypted private key is missing", async () => {
    await expect(
      createPinProtectedPrivateKey({
        privateKeyEncrypted: null,
        password: "correct horse battery staple",
        pin: "1234",
      }),
    ).rejects.toThrow(
      "We couldn't load your encrypted private key. Sign out and sign back in, then try setting your PIN again.",
    );

    expect(cryptoMocks.decryptPrivateKeyWithPassword).not.toHaveBeenCalled();
    expect(cryptoMocks.encryptPrivateKeyWithPIN).not.toHaveBeenCalled();
  });

  it("normalizes empty crypto failures into a visible password error", async () => {
    cryptoMocks.decryptPrivateKeyWithPassword.mockRejectedValue(new Error(""));

    await expect(
      createPinProtectedPrivateKey({
        privateKeyEncrypted: "password-wrapped-private-key",
        password: "correct horse battery staple",
        pin: "1234",
      }),
    ).rejects.toThrow("Incorrect password — enter your account login password.");

    expect(cryptoMocks.encryptPrivateKeyWithPIN).not.toHaveBeenCalled();
  });

  it("supports recovery using a previous password", async () => {
    cryptoMocks.decryptPrivateKeyWithPassword.mockRejectedValueOnce(new Error("decryption failed"));
    cryptoMocks.decryptPrivateKeyWithPassword.mockResolvedValueOnce("PRIVATE KEY PEM");
    cryptoMocks.encryptPrivateKeyWithPIN.mockResolvedValue("pin-wrapped-private-key");
    cryptoMocks.encryptPrivateKeyWithPassword.mockResolvedValue("new-password-wrapped-private-key");

    const result = await createPinProtectedPrivateKey({
      privateKeyEncrypted: "old-password-wrapped-private-key",
      password: "new-password",
      pin: "1234",
      previousPassword: "old-password",
    });

    expect(result).toEqual({
      privateKeyPinEncrypted: "pin-wrapped-private-key",
      reEncryptedPrivateKey: "new-password-wrapped-private-key",
    });
    expect(cryptoMocks.decryptPrivateKeyWithPassword).toHaveBeenCalledTimes(2);
    expect(cryptoMocks.decryptPrivateKeyWithPassword).toHaveBeenNthCalledWith(
      1,
      "new-password",
      "old-password-wrapped-private-key",
      1
    );
    expect(cryptoMocks.decryptPrivateKeyWithPassword).toHaveBeenNthCalledWith(
      2,
      "old-password",
      "old-password-wrapped-private-key",
      1
    );
    expect(cryptoMocks.encryptPrivateKeyWithPIN).toHaveBeenCalledWith("1234", "PRIVATE KEY PEM", 1);
    expect(cryptoMocks.encryptPrivateKeyWithPassword).toHaveBeenCalledWith("new-password", "PRIVATE KEY PEM");
  });

  it("fails if both current and previous passwords are wrong", async () => {
    cryptoMocks.decryptPrivateKeyWithPassword.mockRejectedValue(new Error("decryption failed"));

    await expect(
      createPinProtectedPrivateKey({
        privateKeyEncrypted: "some-wrapped-key",
        password: "wrong-new",
        pin: "1234",
        previousPassword: "wrong-old",
      }),
    ).rejects.toThrow("Incorrect password — enter your account login password.");

    expect(cryptoMocks.decryptPrivateKeyWithPassword).toHaveBeenCalledTimes(2);
    expect(cryptoMocks.encryptPrivateKeyWithPIN).not.toHaveBeenCalled();
  });
});

describe("getPinEnrollmentErrorMessage", () => {
  it("falls back to a generic message for non-Error failures", () => {
    expect(getPinEnrollmentErrorMessage(null)).toBe("Failed to set PIN. Please try again.");
  });

  it("keeps explicit messages that are already user-facing", () => {
    expect(getPinEnrollmentErrorMessage(new Error("Server unavailable"))).toBe("Server unavailable");
  });
});

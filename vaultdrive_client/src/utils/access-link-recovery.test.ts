import { describe, expect, it } from "vitest";

import {
  arrayBufferToBase64,
  deriveKeyFromPassword,
} from "./crypto";
import { recoverVerifiedOwnerFileKey } from "./access-link-recovery";

async function encryptedFixture(password: string) {
  const salt = new Uint8Array(16).fill(7);
  const iv = new Uint8Array(12).fill(9);
  const key = await deriveKeyFromPassword(password, salt, 100000);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode("verified fixture bytes"),
  );

  return {
    ciphertext,
    metadata: JSON.stringify({
      iv: arrayBufferToBase64(iv),
      salt: arrayBufferToBase64(salt),
      credential_scheme: "pin",
    }),
  };
}

describe("access link recovery", () => {
  it("exports a file key only after the credential decrypts the stored ciphertext", async () => {
    const fixture = await encryptedFixture("1111");

    const recovered = await recoverVerifiedOwnerFileKey({
      file: { id: "file-1", metadata: fixture.metadata },
      credential: "1111",
      encryptedData: fixture.ciphertext,
    });

    expect(recovered.fragment).toMatch(/^[A-Za-z0-9+/]+={0,2}$/);
    expect(recovered.key.algorithm.name).toBe("AES-GCM");
  });

  it("rejects a derived key from the wrong PIN instead of producing an unusable URL", async () => {
    const fixture = await encryptedFixture("1111");

    await expect(recoverVerifiedOwnerFileKey({
      file: { id: "file-1", metadata: fixture.metadata },
      credential: "9999",
      encryptedData: fixture.ciphertext,
    })).rejects.toThrow("didn't unlock this file");
  });

  it("validates an entered PIN even when a valid non-folder file key is cached", async () => {
    const fixture = await encryptedFixture("1111");
    const cachedFileKey = await deriveKeyFromPassword("1111", new Uint8Array(16).fill(7), 100000);

    await expect(recoverVerifiedOwnerFileKey({
      file: { id: "file-1", metadata: fixture.metadata },
      credential: "9999",
      encryptedData: fixture.ciphertext,
      cachedFileKey,
    })).rejects.toThrow("didn't unlock this file");
  });
});

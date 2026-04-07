import { generateKeyPairSync } from "node:crypto";
import { describe, expect, it } from "vitest";

import {
  arrayBufferToBase64,
  decryptPrivateKeyWithPassword,
  encryptPrivateKeyWithPassword,
  importRSAPrivateKey,
} from "./crypto";

async function encryptPrivateKeyWithRawPassword(
  password: string,
  privateKeyPem: string,
): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const passwordBytes = new TextEncoder().encode(password);
  const combined = new Uint8Array(salt.length + passwordBytes.length);
  combined.set(salt, 0);
  combined.set(passwordBytes, salt.length);

  const hashBuffer = await crypto.subtle.digest("SHA-256", combined);
  const aesKey = await crypto.subtle.importKey(
    "raw",
    hashBuffer,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt"],
  );

  const plaintext = new TextEncoder().encode(privateKeyPem);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    aesKey,
    plaintext,
  );

  const result = new Uint8Array(salt.length + iv.length + ciphertext.byteLength);
  result.set(salt, 0);
  result.set(iv, salt.length);
  result.set(new Uint8Array(ciphertext), salt.length + iv.length);

  return arrayBufferToBase64(result);
}

describe("decryptPrivateKeyWithPassword", () => {
  it("decrypts legacy backend ciphertext generated from raw password bytes", async () => {
    const password = "Cafe\u0301-1234";
    const privateKeyPem = "-----BEGIN RSA PRIVATE KEY-----\nlegacy-key\n-----END RSA PRIVATE KEY-----";
    const encryptedPrivateKey = await encryptPrivateKeyWithRawPassword(
      password,
      privateKeyPem,
    );

    await expect(
      decryptPrivateKeyWithPassword(password, encryptedPrivateKey),
    ).resolves.toBe(privateKeyPem);
  });

  it("still decrypts frontend-normalized ciphertext", async () => {
    const password = "Cafe\u0301-1234";
    const privateKeyPem = "-----BEGIN RSA PRIVATE KEY-----\nnormalized-key\n-----END RSA PRIVATE KEY-----";
    const encryptedPrivateKey = await encryptPrivateKeyWithPassword(
      password,
      privateKeyPem,
    );

    await expect(
      decryptPrivateKeyWithPassword(password, encryptedPrivateKey),
    ).resolves.toBe(privateKeyPem);
  });
});

describe("importRSAPrivateKey", () => {
  it("imports PKCS#1 PEM private keys produced by registration", async () => {
    const { privateKey } = generateKeyPairSync("rsa", {
      modulusLength: 2048,
      publicKeyEncoding: { type: "spki", format: "pem" },
      privateKeyEncoding: { type: "pkcs1", format: "pem" },
    });

    await expect(importRSAPrivateKey(privateKey)).resolves.toBeInstanceOf(CryptoKey);
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";
import { createPrivateKey } from "node:crypto";
import { arrayBufferToBase64, deriveKeyFromPassword } from "../utils/crypto";

import { isEncryptionMetadata } from "./preview.worker";

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function dropFixture(pin: string) {
  const rawKeyBytes = new Uint8Array(32).map((_, index) => index + 1);
  const rawKeyHex = bytesToHex(rawKeyBytes);
  const wrappingSalt = new Uint8Array(16).fill(11);
  const wrappingIv = new Uint8Array(12).fill(13);
  const wrappingKey = await deriveKeyFromPassword(pin, wrappingSalt, 100000);
  const wrappedCiphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: wrappingIv },
    wrappingKey,
    new TextEncoder().encode(rawKeyHex),
  );
  const wrapped = new Uint8Array(wrappingSalt.length + wrappingIv.length + wrappedCiphertext.byteLength);
  wrapped.set(wrappingSalt, 0);
  wrapped.set(wrappingIv, wrappingSalt.length);
  wrapped.set(new Uint8Array(wrappedCiphertext), wrappingSalt.length + wrappingIv.length);

  const fileIv = new Uint8Array(12).fill(17);
  const fileKey = await crypto.subtle.importKey(
    "raw",
    rawKeyBytes,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt"],
  );
  const plaintext = new TextEncoder().encode("exact secure drop preview bytes");
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv: fileIv }, fileKey, plaintext);
  const metadata = JSON.stringify({
    iv: arrayBufferToBase64(fileIv),
    salt: "",
    algorithm: "AES-256-GCM",
  });

  return { ciphertext, metadata, pinWrappedKey: bytesToHex(wrapped), plaintext };
}

function pkcs1PrivateKeyPem(pkcs1: Uint8Array): string {
  const base64 = arrayBufferToBase64(pkcs1);
  return `-----BEGIN RSA PRIVATE KEY-----\n${base64.match(/.{1,64}/g)?.join("\n") ?? base64}\n-----END RSA PRIVATE KEY-----`;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("preview worker encryption metadata", () => {
  it("previews a Secure Drop file using the server WrapKey envelope and owner PIN", async () => {
    const pin = "2468";
    const fixture = await dropFixture(pin);
    vi.stubGlobal("fetch", vi.fn(async () => new Response(fixture.ciphertext, {
      headers: {
        "X-File-Metadata": fixture.metadata,
        "X-Wrapped-Key": fixture.pinWrappedKey,
      },
    })));
    const post = vi.spyOn(self, "postMessage").mockImplementation(() => {});

    await self.onmessage?.call(self, new MessageEvent("message", {
      data: {
        file: {
          id: "secure-drop-file",
          metadata: fixture.metadata,
          pin_wrapped_key: fixture.pinWrappedKey,
          is_owner: true,
        },
        credential: pin,
        API_URL: "/api",
        authToken: "fixture",
      },
    }));

    const message = post.mock.calls.at(-1)?.[0] as { success: boolean; decryptedBuffer: ArrayBuffer; error?: string };
    expect(message).toEqual(expect.objectContaining({ success: true }));
    expect(Array.from(new Uint8Array(message.decryptedBuffer))).toEqual(Array.from(fixture.plaintext));
  });

  it("uses the authenticated download header when a Secure Drop list entry lacks pin_wrapped_key", async () => {
    const pin = "2468";
    const fixture = await dropFixture(pin);
    vi.stubGlobal("fetch", vi.fn(async () => new Response(fixture.ciphertext, {
      headers: {
        "X-File-Metadata": fixture.metadata,
        "X-Wrapped-Key": fixture.pinWrappedKey,
      },
    })));
    const post = vi.spyOn(self, "postMessage").mockImplementation(() => {});

    await self.onmessage?.call(self, new MessageEvent("message", {
      data: {
        file: {
          id: "secure-drop-header-file",
          metadata: fixture.metadata,
          is_owner: true,
        },
        credential: pin,
        API_URL: "/api",
        authToken: "fixture",
      },
    }));

    const message = post.mock.calls.at(-1)?.[0] as { success: boolean; decryptedBuffer: ArrayBuffer; error?: string };
    expect(message).toEqual(expect.objectContaining({ success: true }));
    expect(Array.from(new Uint8Array(message.decryptedBuffer))).toEqual(Array.from(fixture.plaintext));
  });

  it("previews a direct RSA share using the backend PKCS#1 RSA-OAEP SHA-256 private key", async () => {
    const keyPair = await crypto.subtle.generateKey(
      { name: "RSA-OAEP", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
      true,
      ["encrypt", "decrypt"],
    );
    const fileKeyBytes = new Uint8Array(32).fill(23);
    const fileKey = await crypto.subtle.importKey(
      "raw",
      fileKeyBytes,
      { name: "AES-GCM", length: 256 },
      true,
      ["encrypt"],
    );
    const wrappedKey = await crypto.subtle.encrypt({ name: "RSA-OAEP" }, keyPair.publicKey, fileKeyBytes);
    const fileIv = new Uint8Array(12).fill(29);
    const plaintext = new TextEncoder().encode("exact direct share preview bytes");
    const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv: fileIv }, fileKey, plaintext);
    const metadata = JSON.stringify({ iv: arrayBufferToBase64(fileIv), algorithm: "AES-256-GCM" });
    const pkcs8 = await crypto.subtle.exportKey("pkcs8", keyPair.privateKey);
    const pkcs1Buffer = createPrivateKey({
      key: Buffer.from(pkcs8),
      format: "der",
      type: "pkcs8",
    }).export({ format: "der", type: "pkcs1" });
    const pkcs1 = new Uint8Array(pkcs1Buffer.buffer, pkcs1Buffer.byteOffset, pkcs1Buffer.byteLength);
    vi.stubGlobal("fetch", vi.fn(async () => new Response(ciphertext, {
      headers: {
        "X-File-Metadata": metadata,
        "X-Wrapped-Key": arrayBufferToBase64(wrappedKey),
      },
    })));
    const post = vi.spyOn(self, "postMessage").mockImplementation(() => {});

    await self.onmessage?.call(self, new MessageEvent("message", {
      data: {
        file: { id: "direct-share-file", metadata, is_owner: false },
        credential: "",
        rawPrivateKeyPem: pkcs1PrivateKeyPem(pkcs1),
        API_URL: "/api",
        authToken: "fixture",
      },
    }));

    const message = post.mock.calls.at(-1)?.[0] as { success: boolean; decryptedBuffer: ArrayBuffer; error?: string };
    expect(message).toEqual(expect.objectContaining({ success: true }));
    expect(Array.from(new Uint8Array(message.decryptedBuffer))).toEqual(Array.from(plaintext));
  });

  it("previews a legacy File Request with its sender password and classifies wrong credentials", async () => {
    const password = "sender cafe\u0301 password";
    const salt = new Uint8Array(16).fill(7);
    const iv = new Uint8Array(12).fill(9);
    const key = await deriveKeyFromPassword(password, salt, 100000);
    const plaintext = new TextEncoder().encode("exact legacy request preview");
    const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext);
    const metadata = JSON.stringify({ iv: arrayBufferToBase64(iv), algorithm: "AES-256-GCM" });
    vi.stubGlobal("fetch", vi.fn(async () => new Response(ciphertext, {
      headers: { "X-File-Metadata": metadata, "X-Wrapped-Key": arrayBufferToBase64(salt) },
    })));
    const post = vi.spyOn(self, "postMessage").mockImplementation(() => {});
    const request = { file: { id: "legacy-request", metadata, is_owner: true }, API_URL: "/api", authToken: "fixture" };
    await self.onmessage?.call(self, new MessageEvent("message", { data: { ...request, credential: "wrong" } }));
    expect(post).toHaveBeenLastCalledWith(expect.objectContaining({ success: false, failureKind: "credential" }));
    await self.onmessage?.call(self, new MessageEvent("message", { data: { ...request, credential: password } }));
    const message = post.mock.calls.at(-1)?.[0] as { success: boolean; decryptedBuffer: ArrayBuffer };
    expect(message.success).toBe(true);
    expect(Array.from(new Uint8Array(message.decryptedBuffer))).toEqual(Array.from(plaintext));
  });

  it.each([
    { iv: "aXY=" },
    { iv: "aXY=", salt: null },
    { iv: "aXY=", salt: "" },
    { iv: "aXY=", salt: "c2FsdA==" },
  ])("accepts metadata used by owner and drop-upload previews", (metadata) => {
    expect(isEncryptionMetadata(metadata)).toBe(true);
  });

  it.each([
    {},
    { iv: null },
    { iv: "aXY=", salt: 42 },
  ])("rejects malformed encryption metadata", (metadata) => {
    expect(isEncryptionMetadata(metadata)).toBe(false);
  });
});

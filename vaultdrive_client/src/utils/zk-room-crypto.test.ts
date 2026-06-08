import { describe, expect, it } from "vitest";
import {
  generateECDHKeyPair,
  exportECDHPublicKey,
  importECDHPublicKey,
  deriveSharedSecret,
  generateRoomKey,
  exportRoomKey,
  importRoomKey,
  encryptRoomKeyEnvelope,
  decryptRoomKeyEnvelope,
  encryptRoomData,
  decryptRoomData,
} from "./zk-room-crypto";

describe("ZK Room Cryptography", () => {
  it("generates and exports/imports ECDH keys correctly", async () => {
    const keyPair = await generateECDHKeyPair();
    expect(keyPair.publicKey).toBeInstanceOf(CryptoKey);
    expect(keyPair.privateKey).toBeInstanceOf(CryptoKey);

    const jwk = await exportECDHPublicKey(keyPair.publicKey);
    expect(jwk.kty).toBe("EC");
    expect(jwk.crv).toBe("P-256");

    const imported = await importECDHPublicKey(jwk);
    expect(imported).toBeInstanceOf(CryptoKey);
    expect(imported.algorithm.name).toBe("ECDH");
  });

  it("derives identical shared secrets on both sides", async () => {
    const aliceKeys = await generateECDHKeyPair();
    const bobKeys = await generateECDHKeyPair();

    const aliceJwk = await exportECDHPublicKey(aliceKeys.publicKey);
    const bobJwk = await exportECDHPublicKey(bobKeys.publicKey);

    const aliceImportedBob = await importECDHPublicKey(bobJwk);
    const bobImportedAlice = await importECDHPublicKey(aliceJwk);

    const aliceShared = await deriveSharedSecret(aliceKeys.privateKey, aliceImportedBob);
    const bobShared = await deriveSharedSecret(bobKeys.privateKey, bobImportedAlice);

    // To test if they derived the same key, let's encrypt with one and decrypt with the other
    const plaintext = "Zero knowledge is the future";
    const envelope = await encryptRoomData(aliceShared, plaintext);
    const decrypted = await decryptRoomData(bobShared, envelope);

    expect(decrypted).toBe(plaintext);
  });

  it("generates, exports, and imports RoomKey", async () => {
    const key = await generateRoomKey();
    expect(key).toBeInstanceOf(CryptoKey);

    const b64 = await exportRoomKey(key);
    expect(typeof b64).toBe("string");
    expect(b64.length).toBeGreaterThan(0);

    const imported = await importRoomKey(b64);
    expect(imported).toBeInstanceOf(CryptoKey);
    expect(imported.algorithm.name).toBe("AES-GCM");
  });

  it("safely wraps and unwraps the RoomKey via shared secret", async () => {
    const aliceKeys = await generateECDHKeyPair();
    const bobKeys = await generateECDHKeyPair();

    const aliceShared = await deriveSharedSecret(aliceKeys.privateKey, bobKeys.publicKey);
    const bobShared = await deriveSharedSecret(bobKeys.privateKey, aliceKeys.publicKey);

    const roomKey = await generateRoomKey();
    const envelope = await encryptRoomKeyEnvelope(aliceShared, roomKey);

    const decryptedRoomKey = await decryptRoomKeyEnvelope(bobShared, envelope);
    expect(decryptedRoomKey).toBeInstanceOf(CryptoKey);

    // Verify the decrypted key works
    const msg = "This is a highly confidential document";
    const dataEnvelope = await encryptRoomData(roomKey, msg);
    const decryptedMsg = await decryptRoomData(decryptedRoomKey, dataEnvelope);

    expect(decryptedMsg).toBe(msg);
  });
});

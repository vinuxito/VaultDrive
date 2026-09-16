import { describe, expect, it } from "vitest";
import { legacyFileRequestSalt } from "./file-request-credential";

describe("legacy File Request password metadata", () => {
  const salt = btoa(String.fromCharCode(...new Uint8Array(16).fill(123)));
  it("recovers the historical 16-byte base64 salt stored in the owner access-key field", () => {
    expect(legacyFileRequestSalt({}, salt)).toBe(salt);
    expect(legacyFileRequestSalt({ credential_scheme: "password" }, salt)).toBe(salt);
  });
  it("never treats PIN, folder, RSA, hex or malformed key envelopes as a password salt", () => {
    expect(legacyFileRequestSalt({ credential_scheme: "pin" }, salt)).toBeUndefined();
    expect(legacyFileRequestSalt({ credential_scheme: "folder" }, salt)).toBeUndefined();
    expect(legacyFileRequestSalt({}, "ab".repeat(60))).toBeUndefined();
    expect(legacyFileRequestSalt({}, btoa("a".repeat(256)))).toBeUndefined();
    expect(legacyFileRequestSalt({}, "not-a-valid-key")).toBeUndefined();
    expect(legacyFileRequestSalt({}, null)).toBeUndefined();
  });
});

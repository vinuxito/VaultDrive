import { describe, expect, it } from "vitest";

import { isEncryptionMetadata } from "./preview.worker";

describe("preview worker encryption metadata", () => {
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

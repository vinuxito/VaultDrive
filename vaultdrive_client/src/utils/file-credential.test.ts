import { describe, expect, it } from "vitest";

import { getFileCredentialScheme } from "./file-credential";

describe("getFileCredentialScheme", () => {
  it.each([
    [
      "drop upload",
      { pin_wrapped_key: "wrapped", metadata: "{}", is_owner: true },
      "drop-pin",
    ],
    [
      "metadata PIN",
      { metadata: JSON.stringify({ credential_scheme: "pin" }), is_owner: true },
      "pin",
    ],
    [
      "shared RSA",
      { metadata: JSON.stringify({ credential_scheme: "password" }), is_owner: false },
      "pin",
    ],
    [
      "folder key",
      { metadata: JSON.stringify({ credential_scheme: "folder" }), is_owner: false },
      "folder",
    ],
    [
      "legacy owner password",
      { metadata: "{}", is_owner: true },
      "password",
    ],
    ["shared file with malformed metadata", { metadata: "not-json", is_owner: false }, "pin"],
  ] as const)("classifies %s files", (_label, file, expected) => {
    expect(getFileCredentialScheme(file)).toBe(expected);
  });
});

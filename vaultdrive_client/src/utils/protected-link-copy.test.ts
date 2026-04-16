import { describe, expect, it } from "vitest";

import {
  validateProtectedLinkForCopy,
  validateUploadLinkForCopy,
  validateFolderShareLinkForCopy,
} from "./protected-link-copy";

describe("protected-link-copy", () => {
  it("accepts a full upload link with the expected path and key fragment", () => {
    const result = validateUploadLinkForCopy(
      "https://quantixdrive.example.com/quantix/drop/drop-token-1#key=secret-key",
      "drop-token-1",
      "/quantix",
    );

    expect(result).toEqual({ ok: true, url: "https://quantixdrive.example.com/quantix/drop/drop-token-1#key=secret-key" });
  });

  it("rejects upload links without a key fragment", () => {
    const result = validateUploadLinkForCopy(
      "https://quantixdrive.example.com/quantix/drop/drop-token-1",
      "drop-token-1",
      "/quantix",
    );

    expect(result).toEqual({ ok: false, error: "The full upload link is unavailable. Recover the link again and retry." });
  });

  it("rejects empty URLs before copy", () => {
    const result = validateProtectedLinkForCopy("", {
      expectedPath: "/quantix/drop/drop-token-1",
      kind: "upload-link",
    });

    expect(result).toEqual({ ok: false, error: "The full upload link is unavailable. Recover the link again and retry." });
  });

  it("rejects URLs whose path does not match the expected token route", () => {
    const result = validateFolderShareLinkForCopy(
      "https://quantixdrive.example.com/quantix/folder-share/other-token#folder-key",
      "folder-token-1",
      "/quantix",
    );

    expect(result).toEqual({ ok: false, error: "The folder share route is incomplete. Generate it again before copying." });
  });

  it("accepts folder share URLs only when the hash fragment is present", () => {
    const result = validateFolderShareLinkForCopy(
      "https://quantixdrive.example.com/quantix/folder-share/folder-token-1#folder-key",
      "folder-token-1",
      "/quantix",
    );

    expect(result).toEqual({ ok: true, url: "https://quantixdrive.example.com/quantix/folder-share/folder-token-1#folder-key" });
  });
});

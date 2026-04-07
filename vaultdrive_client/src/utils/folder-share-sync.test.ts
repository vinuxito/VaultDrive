import { describe, expect, it } from "vitest";

import {
  extractFolderShareKeyFromUrl,
  filterSyncableLinksForFolder,
  getAncestorFolderIds,
} from "./folder-share-sync";

describe("getAncestorFolderIds", () => {
  it("returns the current folder followed by its ancestors", () => {
    const ancestors = getAncestorFolderIds("leaf", [
      { id: "root", parentId: null },
      { id: "child", parentId: "root" },
      { id: "leaf", parentId: "child" },
    ]);

    expect(ancestors).toEqual(["leaf", "child", "root"]);
  });
});

describe("filterSyncableLinksForFolder", () => {
  it("includes links rooted on the folder itself and any ancestor folder", () => {
    const links = filterSyncableLinksForFolder(
      "leaf",
      [
        { id: "root", parentId: null },
        { id: "child", parentId: "root" },
        { id: "leaf", parentId: "child" },
      ],
      [
        { id: "link-root", token: "a", folder_id: "root", is_active: true, created_at: "2026-04-07T00:00:00Z" },
        { id: "link-child", token: "b", folder_id: "child", is_active: true, created_at: "2026-04-07T00:00:00Z" },
        { id: "link-leaf", token: "c", folder_id: "leaf", is_active: true, created_at: "2026-04-07T00:00:00Z" },
        { id: "link-other", token: "d", folder_id: "other", is_active: true, created_at: "2026-04-07T00:00:00Z" },
      ],
    );

    expect(links.map((link) => link.id)).toEqual([
      "link-root",
      "link-child",
      "link-leaf",
    ]);
  });
});

describe("extractFolderShareKeyFromUrl", () => {
  it("extracts the token and fragment key from a full share URL", () => {
    expect(
      extractFolderShareKeyFromUrl(
        "https://abrndrive.filemonprime.net/folder-share/token123#abcXYZ=",
        "token123",
      ),
    ).toEqual({ token: "token123", keyB64: "abcXYZ=" });
  });

  it("rejects a pasted URL for the wrong link", () => {
    expect(() =>
      extractFolderShareKeyFromUrl(
        "https://abrndrive.filemonprime.net/folder-share/other#abcXYZ=",
        "token123",
      ),
    ).toThrow("That URL belongs to a different shared link.");
  });
});

import { describe, expect, it } from "vitest";

import {
  canRepairFolderShareLink,
  findOwnedFolderShareLink,
  getFolderShareRepairLabel,
} from "./folder-share-repair";

describe("findOwnedFolderShareLink", () => {
  it("finds the clicked share link inside the owner's active links", () => {
    const link = findOwnedFolderShareLink(
      [
        { id: "1", token: "aaa", folder_id: "root", is_active: true, created_at: "2026-04-07T00:00:00Z" },
        { id: "2", token: "bbb", folder_id: "root", is_active: true, created_at: "2026-04-07T00:00:00Z" },
      ],
      "bbb",
    );

    expect(link?.id).toBe("2");
  });

  it("returns null when the clicked token is not owned by the current user", () => {
    expect(findOwnedFolderShareLink([{ id: "1", token: "aaa", folder_id: "root", is_active: true, created_at: "2026-04-07T00:00:00Z" }], "zzz")).toBeNull();
  });
});

describe("canRepairFolderShareLink", () => {
  it("requires both a matching link and a live session credential", () => {
    expect(canRepairFolderShareLink(null, null)).toBe(false);
    expect(canRepairFolderShareLink({ id: "1", token: "aaa", folder_id: "root", is_active: true, created_at: "2026-04-07T00:00:00Z" }, null)).toBe(false);
    expect(canRepairFolderShareLink(
      { id: "1", token: "aaa", folder_id: "root", is_active: true, created_at: "2026-04-07T00:00:00Z" },
      { type: "pin", value: "2468" },
    )).toBe(true);
  });
});

describe("getFolderShareRepairLabel", () => {
  it("uses repair wording for legacy links and update wording for modern ones", () => {
    expect(getFolderShareRepairLabel({ id: "1", token: "aaa", folder_id: "root", is_active: true, created_at: "2026-04-07T00:00:00Z" })).toBe("Repair this link");
    expect(
      getFolderShareRepairLabel({
        id: "2",
        token: "bbb",
        folder_id: "root",
        is_active: true,
        created_at: "2026-04-07T00:00:00Z",
        owner_wrapped_folder_key: "stored",
      }),
    ).toBe("Update this link");
  });
});

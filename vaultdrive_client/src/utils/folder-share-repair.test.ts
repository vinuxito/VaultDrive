import { describe, expect, it } from "vitest";

import {
  canRepairFolderShareLink,
  findOwnedFolderShareLink,
  getFolderShareOwnerCredentialType,
  getFolderShareRepairLabel,
  resolveFolderSharePanelCredential,
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

describe("getFolderShareOwnerCredentialType", () => {
  it("prefers pin when the user already has a PIN", () => {
    expect(getFolderShareOwnerCredentialType({ pin_set: true })).toBe("pin");
    expect(getFolderShareOwnerCredentialType({ pin_set: false })).toBe("password");
    expect(getFolderShareOwnerCredentialType(null)).toBe("password");
  });
});

describe("resolveFolderSharePanelCredential", () => {
  it("uses cached credentials when available", () => {
    expect(
      resolveFolderSharePanelCredential(
        { type: "pin", value: "2468" },
        "ignored",
        { pin_set: true },
      ),
    ).toEqual({ type: "pin", value: "2468" });
  });

  it("ignores cached credentials when they do not match the expected owner credential type", () => {
    expect(
      resolveFolderSharePanelCredential(
        { type: "password", value: "stale-password" },
        "2468",
        { pin_set: true },
      ),
    ).toEqual({ type: "pin", value: "2468" });
  });

  it("builds a credential from inline owner input when the session is fresh", () => {
    expect(resolveFolderSharePanelCredential(null, " 2468 ", { pin_set: true })).toEqual({
      type: "pin",
      value: "2468",
    });
    expect(resolveFolderSharePanelCredential(null, "password123", { pin_set: false })).toEqual({
      type: "password",
      value: "password123",
    });
  });

  it("returns null when there is no usable credential", () => {
    expect(resolveFolderSharePanelCredential(null, "   ", { pin_set: true })).toBeNull();
  });
});

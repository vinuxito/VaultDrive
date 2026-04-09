import { describe, expect, it } from "vitest";

import { buildMoveTargetOptions } from "./file-move";

describe("buildMoveTargetOptions", () => {
  const folders = [
    { id: "root-a", name: "Arieman", parentId: "" },
    { id: "root-b", name: "Baubap", parentId: "" },
    { id: "child-a", name: "2025", parentId: "root-b" },
    { id: "child-b", name: "2026", parentId: "root-b" },
  ];

  it("returns a stable flattened tree with depth information", () => {
    expect(buildMoveTargetOptions(folders, null)).toEqual([
      { id: "root-a", name: "Arieman", depth: 0 },
      { id: "root-b", name: "Baubap", depth: 0 },
      { id: "child-a", name: "2025", depth: 1 },
      { id: "child-b", name: "2026", depth: 1 },
    ]);
  });

  it("omits the current folder from the destination list", () => {
    expect(buildMoveTargetOptions(folders, "root-b").map((folder) => folder.id)).toEqual([
      "root-a",
      "child-a",
      "child-b",
    ]);
  });
});

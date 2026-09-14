import { describe, expect, it } from "vitest";

import { deepMerge } from "./merge";

describe("deepMerge", () => {
  it("keeps sibling translations while applying nested overrides", () => {
    const target = {
      navigation: { home: "Home", files: "Files" },
      title: "Drive",
    };

    expect(deepMerge(target, {
      navigation: { files: "Vault" },
    })).toEqual({
      navigation: { home: "Home", files: "Vault" },
      title: "Drive",
    });
  });

  it("preserves the existing array merge behavior used by locale resources", () => {
    const target = { steps: ["one", "two", "three"] };

    expect(deepMerge(target, { steps: ["first"] })).toEqual({
      steps: ["first", "two", "three"],
    });
  });
});

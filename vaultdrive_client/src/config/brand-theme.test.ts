import { describe, expect, it } from "vitest";
import { getDefaultSkinForProduct } from "./brand-theme";

describe("getDefaultSkinForProduct", () => {
  it("uses the accessible light skin for ABRN", () => {
    expect(getDefaultSkinForProduct("abrn-drive")).toBe("light");
  });

  it("preserves the QuantiX skin for the upstream product", () => {
    expect(getDefaultSkinForProduct("quantix-drive")).toBe("quantix");
  });
});

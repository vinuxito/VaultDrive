import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  getNormalizedErrorMessage,
  getStoredUserFromLocalStorage,
} from "./browser-storage";

describe("browser-storage", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("evicts a corrupt stored user blob instead of throwing", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    localStorage.setItem("user", "{bad-json");

    expect(getStoredUserFromLocalStorage()).toBeNull();
    expect(localStorage.getItem("user")).toBeNull();
    expect(warnSpy).toHaveBeenCalled();
  });

  it("falls back when an error message is blank", () => {
    expect(getNormalizedErrorMessage(new Error(""), "Fallback message")).toBe("Fallback message");
  });
});

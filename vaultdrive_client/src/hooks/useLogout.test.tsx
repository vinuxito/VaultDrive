import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useLogout } from "./useLogout";

const { clearVault, navigate } = vi.hoisted(() => ({
  clearVault: vi.fn(),
  navigate: vi.fn(),
}));

vi.mock("../context/SessionVaultContext", () => ({
  useSessionVault: () => ({ clearVault }),
}));

vi.mock("./useTransitionNavigate", () => ({
  useTransitionNavigate: () => navigate,
}));

describe("useLogout", () => {
  beforeEach(() => {
    clearVault.mockClear();
    navigate.mockClear();
    localStorage.clear();
    localStorage.setItem("token", "access-token");
    localStorage.setItem("refresh_token", "refresh-token");
    localStorage.setItem("user", JSON.stringify({ username: "ada" }));
    localStorage.setItem("offline_queue", "preserve-me");
  });

  it("clears every authenticated session credential and the vault without erasing offline work", () => {
    const authChange = vi.fn();
    window.addEventListener("auth-change", authChange);
    const { result } = renderHook(() => useLogout());

    act(() => result.current());

    expect(clearVault).toHaveBeenCalledOnce();
    expect(localStorage.getItem("token")).toBeNull();
    expect(localStorage.getItem("refresh_token")).toBeNull();
    expect(localStorage.getItem("user")).toBeNull();
    expect(localStorage.getItem("offline_queue")).toBe("preserve-me");
    expect(authChange).toHaveBeenCalledOnce();
    expect(navigate).toHaveBeenCalledWith("/login", { replace: true });
    window.removeEventListener("auth-change", authChange);
  });
});

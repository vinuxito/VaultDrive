import { beforeEach, describe, expect, it, vi } from "vitest";

import { clearAuthSessionStorage, getLoginUrl, getSafeLoginIntent } from "./auth-session";

describe("auth session boundaries", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it("clears every persisted auth and vault cache entry", () => {
    localStorage.setItem("token", "access");
    localStorage.setItem("refresh_token", "refresh");
    localStorage.setItem("user", "{}");
    sessionStorage.setItem("vault_cached_private_key", "private");
    sessionStorage.setItem("vault_cached_credential", "credential");

    clearAuthSessionStorage();

    expect(localStorage.getItem("token")).toBeNull();
    expect(localStorage.getItem("refresh_token")).toBeNull();
    expect(localStorage.getItem("user")).toBeNull();
    expect(sessionStorage.getItem("vault_cached_private_key")).toBeNull();
    expect(sessionStorage.getItem("vault_cached_credential")).toBeNull();
  });

  it("accepts only internal fragment-free login intents", () => {
    expect(getSafeLoginIntent({ pathname: "/files", search: "?folder=mine", hash: "#secret" }))
      .toEqual({ pathname: "/files" });
    expect(getSafeLoginIntent({ pathname: "/help", search: "?section=vault_pin" }))
      .toEqual({ pathname: "/help", search: "?section=vault_pin" });
    expect(getSafeLoginIntent({ pathname: "/drop/secret-token" })).toBeNull();
    expect(getSafeLoginIntent({ pathname: "//evil.example/steal" })).toBeNull();
    expect(getSafeLoginIntent({ pathname: "https://evil.example" })).toBeNull();
    expect(getSafeLoginIntent({ pathname: "/files\\evil" })).toBeNull();
  });

  it("builds the login document URL under the configured base path", () => {
    expect(getLoginUrl({ origin: "https://example.test", hostname: "example.test", pathname: "/quantix/files" }))
      .toBe("https://example.test/quantix/login");
  });
});

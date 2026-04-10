import { describe, expect, it } from "vitest";

import { buildAppUrl, getBasePathForLocation } from "./base-path";

describe("getBasePathForLocation", () => {
  it("uses the root basename for root-hosted production routes", () => {
    expect(
      getBasePathForLocation(
        "app.quantixdrive.io",
        "/folder-share/token",
        "/quantix",
        ["app.quantixdrive.io"],
      ),
    ).toBe("");
  });

  it("keeps the configured base path for legacy prefixed routes on root-hosted hosts", () => {
    expect(
      getBasePathForLocation(
        "app.quantixdrive.io",
        "/quantix/drop/token",
        "/quantix",
        ["app.quantixdrive.io"],
      ),
    ).toBe("/quantix");
    expect(
      getBasePathForLocation(
        "app.quantixdrive.io",
        "/quantix/request/token",
        "/quantix",
        ["app.quantixdrive.io"],
      ),
    ).toBe("/quantix");
  });

  it("uses the configured base path on non-root-hosted hosts", () => {
    expect(
      getBasePathForLocation("localhost", "/drop/token", "/quantix", [
        "app.quantixdrive.io",
      ]),
    ).toBe("/quantix");
    expect(
      getBasePathForLocation("127.0.0.1", "/quantix/drop/token", "/quantix", [
        "app.quantixdrive.io",
      ]),
    ).toBe("/quantix");
    expect(
      getBasePathForLocation(
        "staging.example.com",
        "/folder-share/token",
        "/quantix",
        ["app.quantixdrive.io"],
      ),
    ).toBe("/quantix");
  });

  it("honors a quantix base path with no root-hosted hosts (default QuantiX deployment)", () => {
    expect(
      getBasePathForLocation("app.quantixdrive.io", "/files", "/quantix", []),
    ).toBe("/quantix");
    expect(
      getBasePathForLocation("localhost", "/drop/token", "/quantix", []),
    ).toBe("/quantix");
  });
});

describe("buildAppUrl", () => {
  it("builds root-hosted public URLs without duplicating the basename", () => {
    expect(
      buildAppUrl(
        "https://app.quantixdrive.io",
        "",
        "/folder-share/token#key",
      ),
    ).toBe("https://app.quantixdrive.io/folder-share/token#key");
  });

  it("builds base-path-hosted public URLs for local environments", () => {
    expect(
      buildAppUrl("http://127.0.0.1:8091", "/quantix", "/folder-share/token#key"),
    ).toBe("http://127.0.0.1:8091/quantix/folder-share/token#key");
  });

  it("builds quantix-hosted public URLs", () => {
    expect(
      buildAppUrl("https://app.quantixdrive.io", "/quantix", "/files/abc"),
    ).toBe("https://app.quantixdrive.io/quantix/files/abc");
  });
});

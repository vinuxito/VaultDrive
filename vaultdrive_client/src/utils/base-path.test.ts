import { describe, expect, it } from "vitest";

import { buildAppUrl, getBasePathForLocation } from "./base-path";

describe("getBasePathForLocation", () => {
  it("uses the root basename for root-hosted production routes", () => {
    expect(getBasePathForLocation("abrndrive.filemonprime.net", "/folder-share/token")).toBe("");
  });

  it("uses /abrn for legacy production routes that still include the basename", () => {
    expect(getBasePathForLocation("abrndrive.filemonprime.net", "/abrn/drop/token")).toBe("/abrn");
    expect(getBasePathForLocation("abrndrive.filemonprime.net", "/abrn/request/token")).toBe("/abrn");
  });

  it("uses /abrn on local and non-production hosts", () => {
    expect(getBasePathForLocation("localhost", "/drop/token")).toBe("/abrn");
    expect(getBasePathForLocation("127.0.0.1", "/abrn/drop/token")).toBe("/abrn");
    expect(getBasePathForLocation("staging.example.com", "/folder-share/token")).toBe("/abrn");
  });
});

describe("buildAppUrl", () => {
  it("builds root-hosted public URLs without duplicating the basename", () => {
    expect(buildAppUrl("https://abrndrive.filemonprime.net", "", "/folder-share/token#key")).toBe(
      "https://abrndrive.filemonprime.net/folder-share/token#key",
    );
  });

  it("builds /abrn-hosted public URLs for local environments", () => {
    expect(buildAppUrl("http://127.0.0.1:8091", "/abrn", "/folder-share/token#key")).toBe(
      "http://127.0.0.1:8091/abrn/folder-share/token#key",
    );
  });
});

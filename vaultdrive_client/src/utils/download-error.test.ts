import { describe, expect, it } from "vitest";
import { mapDownloadHttpError } from "./download-error";

describe("mapDownloadHttpError", () => {
  it("maps storage failures without exposing controller internals", () => {
    expect(mapDownloadHttpError(500)).toBe("File is temporarily unavailable from storage.");
    expect(mapDownloadHttpError(503)).toBe("File is temporarily unavailable from storage.");
  });

  it("maps authentication and missing-file failures", () => {
    expect(mapDownloadHttpError(401)).toBe("Your session expired. Sign in again.");
    expect(mapDownloadHttpError(403)).toBe("You do not have permission to download this file.");
    expect(mapDownloadHttpError(404)).toBe("This file is no longer available.");
  });
});

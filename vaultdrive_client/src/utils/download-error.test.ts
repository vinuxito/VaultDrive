import { describe, expect, it } from "vitest";
import {
  classifyTransferError,
  classifyTransferHttpError,
  mapDownloadHttpError,
} from "./download-error";

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

  it("classifies retryable service failures without blaming the share key", () => {
    expect(classifyTransferHttpError(503)).toEqual({
      kind: "service",
      message: "The service is temporarily unavailable.",
      retryable: true,
    });
    expect(classifyTransferHttpError(429)).toEqual({
      kind: "rate-limit",
      message: "Too many attempts. Wait a moment, then try again.",
      retryable: true,
    });
  });

  it("classifies revoked and expired access as terminal", () => {
    expect(classifyTransferHttpError(403).retryable).toBe(false);
    expect(classifyTransferHttpError(410)).toEqual({
      kind: "unavailable",
      message: "This link has expired or is no longer available.",
      retryable: false,
    });
  });

  it("classifies a fetch network failure as retryable", () => {
    expect(classifyTransferError(new TypeError("Failed to fetch"))).toEqual({
      kind: "network",
      message: "The service could not be reached. Check your connection and try again.",
      retryable: true,
    });
  });

  it("does not mislabel an unrelated TypeError as a network failure", () => {
    expect(classifyTransferError(new TypeError("Invalid response metadata"))).toEqual({
      kind: "unknown",
      message: "Invalid response metadata",
      retryable: false,
    });
  });
});

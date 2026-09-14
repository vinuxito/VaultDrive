import { describe, expect, it } from "vitest";
import {
  classifyPublicUploadOutcome,
  getRetryableUploadIds,
  type PublicUploadProgress,
} from "./public-upload-outcome";

describe("classifyPublicUploadOutcome", () => {
  it("requires a valid endpoint receipt before calling a 2xx upload accepted", () => {
    expect(classifyPublicUploadOutcome({
      endpoint: "drop",
      event: "load",
      status: 201,
      responseText: JSON.stringify({ success: true, uploaded: 1, count: 1, files: [{ file_id: "file-1" }] }),
      requestSent: true,
    })).toMatchObject({ status: "success", retryable: false });

    expect(classifyPublicUploadOutcome({
      endpoint: "file-request",
      event: "load",
      status: 201,
      responseText: JSON.stringify({ count: 1, uploaded: [{ file_id: "file-2", filename: "proof.pdf" }] }),
      requestSent: true,
    })).toMatchObject({ status: "success", retryable: false });

    expect(classifyPublicUploadOutcome({
      endpoint: "drop",
      event: "load",
      status: 201,
      responseText: "not-json",
      requestSent: true,
    })).toEqual({
      status: "unknown",
      retryable: false,
      message: "The server response did not confirm whether this file was accepted. Ask the recipient to check before sending it again.",
    });
  });

  it("marks post-send network, timeout, and server failures as unknown acceptance", () => {
    for (const event of ["network", "timeout"] as const) {
      expect(classifyPublicUploadOutcome({
        endpoint: "file-request",
        event,
        status: 0,
        responseText: "",
        requestSent: true,
      })).toMatchObject({ status: "unknown", retryable: false });
    }

    expect(classifyPublicUploadOutcome({
      endpoint: "drop",
      event: "load",
      status: 503,
      responseText: JSON.stringify({ error: "temporarily unavailable" }),
      requestSent: true,
    })).toMatchObject({ status: "unknown", retryable: false });

    expect(classifyPublicUploadOutcome({
      endpoint: "drop",
      event: "load",
      status: 0,
      responseText: "",
      requestSent: true,
    })).toMatchObject({ status: "unknown", retryable: false });
  });

  it("keeps confirmed rejection and pre-send encryption failures safely retryable", () => {
    expect(classifyPublicUploadOutcome({
      endpoint: "drop",
      event: "load",
      status: 429,
      responseText: JSON.stringify({ error: "Too many attempts" }),
      requestSent: true,
    })).toEqual({ status: "error", retryable: true, message: "Too many attempts" });

    expect(classifyPublicUploadOutcome({
      endpoint: "drop",
      event: "prepare-error",
      status: 0,
      responseText: "",
      requestSent: false,
      errorMessage: "Encryption failed",
    })).toEqual({ status: "error", retryable: true, message: "Encryption failed" });
  });

  it("does not offer retry for accepted, ambiguous, or cancelled rows", () => {
    const rows: PublicUploadProgress[] = [
      { id: "accepted", fileName: "a.txt", status: "success", progress: 100, bytesUploaded: 1, bytesTotal: 1 },
      { id: "ambiguous", fileName: "b.txt", status: "unknown", progress: 100, bytesUploaded: 1, bytesTotal: 1 },
      { id: "failed", fileName: "c.txt", status: "error", progress: 0, bytesUploaded: 0, bytesTotal: 1, retryable: true },
      { id: "terminal", fileName: "d.txt", status: "error", progress: 0, bytesUploaded: 0, bytesTotal: 1, retryable: false },
      { id: "cancelled", fileName: "e.txt", status: "cancelled", progress: 0, bytesUploaded: 0, bytesTotal: 1 },
    ];

    expect(getRetryableUploadIds(rows)).toEqual(["failed"]);
  });

  it("keeps cancellation terminal even when the request had not started", () => {
    expect(classifyPublicUploadOutcome({
      endpoint: "drop",
      event: "abort",
      status: 0,
      responseText: "",
      requestSent: false,
    })).toEqual({ status: "cancelled", retryable: false, message: "Upload cancelled." });
  });
});

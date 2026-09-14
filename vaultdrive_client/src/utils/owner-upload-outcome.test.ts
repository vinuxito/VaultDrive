import { describe, expect, it } from "vitest";

import { readOwnerUploadOutcome } from "./owner-upload-outcome";

describe("readOwnerUploadOutcome", () => {
  it("accepts only a created receipt with a file id", async () => {
    expect(await readOwnerUploadOutcome(new Response(JSON.stringify({ file_id: "file-1" }), { status: 201 }))).toEqual({ kind: "confirmed", fileId: "file-1" });
    expect((await readOwnerUploadOutcome(new Response("{}", { status: 201 }))).kind).toBe("unknown");
  });

  it("separates confirmed client rejection from ambiguous server acceptance", async () => {
    expect((await readOwnerUploadOutcome(new Response("bad", { status: 400 }))).kind).toBe("failed");
    expect((await readOwnerUploadOutcome(new Response("down", { status: 503 }))).kind).toBe("unknown");
  });
});

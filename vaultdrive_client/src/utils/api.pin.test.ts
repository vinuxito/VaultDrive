import { beforeEach, describe, expect, it, vi } from "vitest";

import { setPIN } from "./api";

describe("setPIN password-envelope repair", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("keeps positional callers compatible and persists repaired key material atomically", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));
    vi.stubGlobal("fetch", fetchMock);

    await setPIN("1234", "jwt", "0000", "pin-envelope", "password-envelope", 2);

    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(JSON.parse(String(init.body))).toEqual({
      pin: "1234",
      old_pin: "0000",
      private_key_pin_encrypted: "pin-envelope",
      private_key_encrypted: "password-envelope",
      kek_envelope_version: 2,
    });
  });
});

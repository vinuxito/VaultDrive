import { describe, expect, it } from "vitest";

import {
  getCachedPinValue,
  mergeUserPinState,
  requiresPinSetup,
} from "./pin-trust";

describe("pin trust helpers", () => {
  it("returns a cached pin only for valid pin credentials", () => {
    expect(getCachedPinValue({ type: "pin", value: "1234" })).toBe("1234");
    expect(getCachedPinValue({ type: "pin", value: "123" })).toBeNull();
    expect(getCachedPinValue({ type: "password", value: "secret" })).toBeNull();
    expect(getCachedPinValue(null)).toBeNull();
  });

  it("treats missing or false pin_set as requiring setup", () => {
    expect(requiresPinSetup(null)).toBe(true);
    expect(requiresPinSetup({})).toBe(true);
    expect(requiresPinSetup({ pin_set: false })).toBe(true);
    expect(requiresPinSetup({ pin_set: true })).toBe(false);
  });

  it("merges user pin state after successful enrollment", () => {
    expect(
      mergeUserPinState(
        { email: "owner@example.com", private_key_encrypted: "pw-key" },
        "pin-key",
      ),
    ).toEqual({
      email: "owner@example.com",
      pin_set: true,
      private_key_encrypted: "pw-key",
      private_key_pin_encrypted: "pin-key",
    });
  });
});

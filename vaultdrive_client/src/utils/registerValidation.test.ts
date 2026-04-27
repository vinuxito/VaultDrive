import { describe, it, expect } from "vitest";
import { validateRegister } from "./registerValidation";

const base = {
  first_name: "Jane",
  last_name: "Doe",
  username: "janedoe",
  email: "jane@example.com",
  password: "password123",
};

describe("validateRegister", () => {
  it("accepts valid input", () => {
    expect(validateRegister(base)).toBeNull();
  });

  it("rejects empty first name", () => {
    expect(validateRegister({ ...base, first_name: "  " })).toMatch(/First name/);
  });

  it("rejects empty last name", () => {
    expect(validateRegister({ ...base, last_name: "" })).toMatch(/Last name/);
  });

  it("rejects empty username", () => {
    expect(validateRegister({ ...base, username: "" })).toMatch(/Username/);
  });

  it("rejects empty email", () => {
    expect(validateRegister({ ...base, email: "" })).toMatch(/Email is required/);
  });

  it("rejects malformed email", () => {
    expect(validateRegister({ ...base, email: "nope" })).toMatch(/not valid/);
  });

  it("rejects passwords shorter than 8", () => {
    expect(validateRegister({ ...base, password: "short" })).toMatch(/at least 8/);
  });

  it("rejects passwords longer than 64", () => {
    expect(
      validateRegister({ ...base, password: "x".repeat(65) }),
    ).toMatch(/64 characters or fewer/);
  });
});

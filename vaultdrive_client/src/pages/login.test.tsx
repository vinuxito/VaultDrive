import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import Login from "./login";

const navigateMock = vi.fn();
const sessionVaultMocks = vi.hoisted(() => ({
  setPrivateKey: vi.fn(),
  setCredential: vi.fn(),
  clearVault: vi.fn(),
}));

vi.mock("react-router-dom", () => ({
  useNavigate: () => navigateMock,
}));

vi.mock("../components/branding", () => ({
  BrandLogo: () => <div>BrandLogo</div>,
  PoweredByBadge: () => <div>PoweredByBadge</div>,
}));

vi.mock("../context/SessionVaultContext", () => ({
  useSessionVault: () => sessionVaultMocks,
}));

vi.mock("../utils/crypto", () => ({
  decryptPrivateKeyWithPassword: vi.fn().mockResolvedValue("pem"),
  decryptPrivateKeyWithPIN: vi.fn().mockResolvedValue("pem"),
  importRSAPrivateKey: vi.fn().mockResolvedValue({ id: "rsa-key" }),
}));

describe("Login", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          token: "token-1",
          refresh_token: "refresh-1",
          id: "user-1",
          username: "owner",
          email: "owner@example.com",
          first_name: "Owner",
          last_name: "User",
          is_admin: false,
          pin_set: true,
          force_password_change: false,
          private_key_encrypted: "encrypted-key",
          private_key_pin_encrypted: null,
          public_key: "public-key",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    ) as typeof fetch;
  });

  it("clears stale vault state before storing a new login session", async () => {
    render(<Login />);

    await userEvent.type(screen.getByLabelText(/email/i), "owner@example.com");
    await userEvent.type(screen.getByLabelText(/^password$/i), "password123");
    await userEvent.click(screen.getByRole("button", { name: /open quantix drive/i }));

    await waitFor(() => {
      expect(sessionVaultMocks.clearVault).toHaveBeenCalledTimes(1);
    });

    expect(localStorage.getItem("token")).toBe("token-1");
    expect(sessionVaultMocks.setCredential).toHaveBeenCalledWith("password123", "password");
  });
});

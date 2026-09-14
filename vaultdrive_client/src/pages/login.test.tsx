import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import Login from "./login";

const navigateMock = vi.fn();
const sessionVaultMocks = vi.hoisted(() => ({
  setPrivateKey: vi.fn(),
  setCredential: vi.fn(),
  clearVault: vi.fn(),
}));
const cryptoMocks = vi.hoisted(() => ({
  decryptPrivateKeyWithPassword: vi.fn().mockResolvedValue("pem"),
  decryptPrivateKeyWithPIN: vi.fn().mockResolvedValue("pem"),
  importRSAPrivateKey: vi.fn().mockResolvedValue({ id: "rsa-key" }),
}));
const webAuthnMocks = vi.hoisted(() => ({
  hasRegisteredPasskey: vi.fn(() => false),
  unlockWithPasskey: vi.fn(),
  getWebAuthnEmail: vi.fn(() => ""),
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
  decryptPrivateKeyWithPassword: cryptoMocks.decryptPrivateKeyWithPassword,
  decryptPrivateKeyWithPIN: cryptoMocks.decryptPrivateKeyWithPIN,
  importRSAPrivateKey: cryptoMocks.importRSAPrivateKey,
}));

vi.mock("../hooks/useWebAuthn", () => webAuthnMocks);

describe("Login", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cryptoMocks.decryptPrivateKeyWithPassword.mockResolvedValue("pem");
    cryptoMocks.decryptPrivateKeyWithPIN.mockResolvedValue("pem");
    cryptoMocks.importRSAPrivateKey.mockResolvedValue({ id: "rsa-key" });
    webAuthnMocks.hasRegisteredPasskey.mockReturnValue(false);
    webAuthnMocks.getWebAuthnEmail.mockReturnValue("");
    webAuthnMocks.unlockWithPasskey.mockReset();
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
    await userEvent.click(screen.getByRole("button", { name: /open/i }));



    await waitFor(() => {
      expect(sessionVaultMocks.clearVault).toHaveBeenCalledTimes(1);
    });

    expect(localStorage.getItem("token")).toBe("token-1");
    expect(sessionVaultMocks.setCredential).toHaveBeenCalledWith("password123", "password");
  });

  it("does not create an authenticated session when vault unlock fails", async () => {
    cryptoMocks.decryptPrivateKeyWithPassword.mockRejectedValueOnce(new Error("bad credential"));

    render(<Login />);

    await userEvent.type(screen.getByLabelText(/email/i), "owner@example.com");
    await userEvent.type(screen.getByLabelText(/^password$/i), "wrong-password");
    await userEvent.click(screen.getByRole("button", { name: /open/i }));

    await screen.findByText(/unable to unlock your encrypted vault/i);
    expect(navigateMock).not.toHaveBeenCalled();
    expect(sessionVaultMocks.setCredential).not.toHaveBeenCalled();
    expect(localStorage.getItem("token")).toBeNull();
    expect(localStorage.getItem("refresh_token")).toBeNull();
    expect(localStorage.getItem("user")).toBeNull();
  });

  it("does not relaunch automatic biometrics when the email field changes", async () => {
    vi.useFakeTimers();
    webAuthnMocks.hasRegisteredPasskey.mockReturnValue(true);
    webAuthnMocks.getWebAuthnEmail.mockReturnValue("stored@example.com");
    webAuthnMocks.unlockWithPasskey.mockRejectedValue(new Error("cancelled"));

    try {
      render(<Login />);
      fireEvent.click(screen.getByRole("button", { name: /pin/i }));
      await act(async () => {
        vi.advanceTimersByTime(500);
        await Promise.resolve();
      });
      expect(webAuthnMocks.unlockWithPasskey).toHaveBeenCalledTimes(1);

      fireEvent.change(screen.getByLabelText(/email/i), {
        target: { value: "different@example.com" },
      });
      await act(async () => {
        vi.advanceTimersByTime(1_000);
        await Promise.resolve();
      });

      expect(webAuthnMocks.unlockWithPasskey).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
});

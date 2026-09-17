import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ForcePasswordChange from "./force-password-change";

const navigateMock = vi.fn();
const sessionMocks = vi.hoisted(() => ({ setPrivateKey: vi.fn(), setCredential: vi.fn() }));
const cryptoMocks = vi.hoisted(() => ({
  decryptPrivateKeyWithPassword: vi.fn(),
  encryptPrivateKeyWithPassword: vi.fn(),
  importRSAPrivateKey: vi.fn(),
}));

vi.mock("react-router-dom", () => ({ useNavigate: () => navigateMock }));
vi.mock("../context/SessionVaultContext", () => ({ useSessionVault: () => sessionMocks }));
vi.mock("../utils/crypto", () => cryptoMocks);
vi.mock("../components/branding", () => ({ BrandLogo: () => <div>Logo</div> }));

describe("forced password change key continuity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    localStorage.setItem("token", "jwt");
    localStorage.setItem("user", JSON.stringify({
      id: "user-1",
      force_password_change: true,
      private_key_encrypted: "v2-old-envelope",
      kek_envelope_version: 2,
    }));
    cryptoMocks.decryptPrivateKeyWithPassword.mockResolvedValue("PRIVATE KEY");
    cryptoMocks.encryptPrivateKeyWithPassword.mockResolvedValue("v2-new-envelope");
    cryptoMocks.importRSAPrivateKey.mockResolvedValue({ type: "private" });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: "ok" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })));
  });

  async function submit() {
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/current password/i), "old-password");
    await user.type(screen.getByLabelText(/^new password$/i), "new-password");
    await user.type(screen.getByLabelText(/confirm new password/i), "new-password");
    await user.click(screen.getByRole("button", { name: /set new password/i }));
  }

  it("fails closed without mutating the password when the current envelope cannot be decrypted", async () => {
    cryptoMocks.decryptPrivateKeyWithPassword.mockRejectedValueOnce(new Error("bad envelope"));
    render(<ForcePasswordChange />);

    await submit();

    expect(await screen.findByRole("alert")).toHaveTextContent(/could not unlock your account key/i);
    expect(fetch).not.toHaveBeenCalled();
    expect(navigateMock).not.toHaveBeenCalledWith("/dashboard", { replace: true });
  });

  it("verifies and imports the new wrapper before sending the password mutation", async () => {
    cryptoMocks.decryptPrivateKeyWithPassword
      .mockResolvedValueOnce("PRIVATE KEY")
      .mockResolvedValueOnce("DIFFERENT KEY");
    render(<ForcePasswordChange />);

    await submit();

    expect(await screen.findByRole("alert")).toHaveTextContent(/could not unlock your account key/i);
    expect(cryptoMocks.importRSAPrivateKey).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("preserves the envelope version in browser crypto and the atomic server request", async () => {
    render(<ForcePasswordChange />);
    await submit();

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    expect(cryptoMocks.decryptPrivateKeyWithPassword).toHaveBeenCalledWith(
      "old-password", "v2-old-envelope", 2,
    );
    expect(cryptoMocks.encryptPrivateKeyWithPassword).toHaveBeenCalledWith(
      "new-password", "PRIVATE KEY", 2,
    );
    expect(cryptoMocks.decryptPrivateKeyWithPassword).toHaveBeenLastCalledWith(
      "new-password", "v2-new-envelope", 2,
    );
    expect(cryptoMocks.importRSAPrivateKey).toHaveBeenCalledWith("PRIVATE KEY");
    const request = vi.mocked(fetch).mock.calls[0][1] as RequestInit;
    expect(JSON.parse(String(request.body))).toMatchObject({
      private_key_encrypted: "v2-new-envelope",
      kek_envelope_version: 2,
    });
  });

  it("uses the previous envelope password only in browser after an administrator reset", async () => {
    render(<ForcePasswordChange />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/current password/i), "temporary-password");
    await user.type(document.querySelector("#previous-envelope-password") as HTMLInputElement, "original-password");
    await user.type(screen.getByLabelText(/^new password$/i), "new-password");
    await user.type(screen.getByLabelText(/confirm new password/i), "new-password");
    await user.click(screen.getByRole("button", { name: /set new password/i }));

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    expect(cryptoMocks.decryptPrivateKeyWithPassword).toHaveBeenNthCalledWith(
      1, "original-password", "v2-old-envelope", 2,
    );
    const request = vi.mocked(fetch).mock.calls[0][1] as RequestInit;
    const body = JSON.parse(String(request.body));
    expect(body.old_password).toBe("temporary-password");
    expect(JSON.stringify(body)).not.toContain("original-password");
  });
});

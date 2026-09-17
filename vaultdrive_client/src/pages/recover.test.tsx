import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import Recover from "./recover";

const encryptDeferred = vi.hoisted(() => ({ resolve: null as null | ((value: string) => void) }));
const resetDeferred = vi.hoisted(() => ({ resolve: null as null | ((value: Response) => void) }));

vi.mock("../components/theme-provider", () => ({
  useTheme: () => ({ skin: "light" }),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string; time?: string }) => {
      if (options?.defaultValue) {
        return options.time ? options.defaultValue.replace("{{time}}", options.time) : options.defaultValue;
      }
      if (key === "drive:recovery.requestRecovery") return "Request Account Recovery";
      return key;
    },
  }),
}));

vi.mock("../utils/shamir", () => ({
  shamirReconstruct: () => new TextEncoder().encode("-----BEGIN PRIVATE KEY-----\nfixture\n-----END PRIVATE KEY-----"),
}));

vi.mock("../utils/crypto", () => ({
  hexToBytes: () => new Uint8Array([1]),
  encryptPrivateKeyWithPassword: () => new Promise<string>((resolve) => {
    encryptDeferred.resolve = resolve;
  }),
}));

const pendingStatus = {
  threshold: 2,
  verification_code: "A1B2C3D4",
  expires_at: "2026-09-17T12:00:00Z",
  shares: [
    { share_index: 1, custodian_label: "Custodian 1", status: "approved", decrypted_share_part: "aa" },
    { share_index: 2, custodian_label: "Custodian 2", status: "pending" },
  ],
};

const readyStatus = {
  threshold: 1,
  verification_code: "A1B2C3D4",
  expires_at: "2026-09-17T12:00:00Z",
  shares: [
    { share_index: 1, custodian_label: "Custodian 1", status: "approved", decrypted_share_part: "aa" },
  ],
};

function response(body: unknown, ok = true, status = ok ? 200 : 500) {
  return { ok, status, json: async () => body } as Response;
}

const started = { recovery_token: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", verification_code: "A1B2C3D4", expires_at: "2026-09-17T12:00:00Z" };

describe("account recovery guidance", () => {
  beforeEach(() => {
    encryptDeferred.resolve = null;
    resetDeferred.resolve = null;
    sessionStorage.clear();
    vi.clearAllMocks();
  });

  it("explains the original file credential limitation before starting recovery", () => {
    render(<MemoryRouter><Recover /></MemoryRouter>);
    expect(screen.getByText(/files encrypted with an earlier PIN or file password still need that original credential/i)).toBeInTheDocument();
    expect(screen.getByText(/support cannot recover a lost file credential/i)).toBeInTheDocument();
  });

  it("shows the last successful check and offers a manual retry while waiting", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response(started))
      .mockResolvedValue(response(pendingStatus));
    vi.stubGlobal("fetch", fetchMock);

    render(<MemoryRouter><Recover /></MemoryRouter>);
    await user.type(screen.getByLabelText("Username"), "ada");
    await user.click(screen.getByRole("button", { name: /Request Account Recovery/i }));

    await screen.findByText(/1 \/ 2 Approved/i);
    expect(screen.getByText(/Last checked/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Check again/i })).toBeInTheDocument();
    expect(screen.getByText(/Verification code:/i)).toHaveTextContent("A1B2C3D4");
    expect(fetchMock.mock.calls[1][0]).not.toContain("username=");
    expect((fetchMock.mock.calls[1][1] as RequestInit).headers).toEqual({ Authorization: `Bearer ${started.recovery_token}` });
    expect(screen.queryByText(/Reconstructing private key/i)).not.toBeInTheDocument();
  });

  it("resumes a pending attempt from the session capability without starting a duplicate", async () => {
    sessionStorage.setItem("abrn_recovery_capability", started.recovery_token);
    const fetchMock = vi.fn().mockResolvedValue(response(pendingStatus));
    vi.stubGlobal("fetch", fetchMock);

    render(<MemoryRouter><Recover /></MemoryRouter>);

    await screen.findByText(/1 \/ 2 Approved/i);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toContain("/v1/recovery/status");
    expect((fetchMock.mock.calls[0][1] as RequestInit).headers).toEqual({ Authorization: `Bearer ${started.recovery_token}` });
    expect(screen.queryByLabelText("Username")).not.toBeInTheDocument();
  });

  it("clears an expired stored capability and returns to an actionable request state", async () => {
    sessionStorage.setItem("abrn_recovery_capability", started.recovery_token);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response({ error: "expired" }, false, 401)));

    render(<MemoryRouter><Recover /></MemoryRouter>);

    expect(await screen.findByRole("alert")).toHaveTextContent(/expired|start a new recovery/i);
    expect(screen.getByLabelText("Username")).toBeInTheDocument();
    expect(sessionStorage.getItem("abrn_recovery_capability")).toBeNull();
  });

  it("calls the operation reconstructing only while reset work is running", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response(started))
      .mockResolvedValueOnce(response(readyStatus))
      .mockResolvedValueOnce(response({ message: "reset" }));
    vi.stubGlobal("fetch", fetchMock);

    render(<MemoryRouter><Recover /></MemoryRouter>);
    await user.type(screen.getByLabelText("Username"), "ada");
    await user.click(screen.getByRole("button", { name: /Request Account Recovery/i }));

    await screen.findByText(/Approvals complete/i);
    expect(screen.queryByText(/Reconstructing your key/i)).not.toBeInTheDocument();
    await user.type(screen.getByLabelText("New Password"), "new-password");
    await user.type(screen.getByLabelText("Confirm Password"), "new-password");
    await user.click(screen.getByRole("button", { name: /Recover & Reset Account/i }));

    expect(screen.getByText(/Reconstructing your key/i)).toBeInTheDocument();
    encryptDeferred.resolve?.("encrypted-key");

    await waitFor(() => expect(screen.getByText(/set a new vault PIN/i)).toBeInTheDocument());
    expect(screen.getByText(/files encrypted with an earlier PIN or file password still need that original credential/i)).toBeInTheDocument();
  });

  it("rejects malformed approval status without inventing progress or a successful check time", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(response(started))
      .mockResolvedValueOnce(response({ threshold: "2", shares: {} })));

    render(<MemoryRouter><Recover /></MemoryRouter>);
    await user.type(screen.getByLabelText("Username"), "ada");
    await user.click(screen.getByRole("button", { name: /Request Account Recovery/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/invalid approval status/i);
    expect(screen.queryByText(/Last checked:/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Approvals complete/i)).not.toBeInTheDocument();
  });

  it("cancels reconstruction before reset submission and clears sensitive inputs", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response(started))
      .mockResolvedValueOnce(response(readyStatus))
      .mockResolvedValueOnce(response({ message: "cancelled" }));
    vi.stubGlobal("fetch", fetchMock);

    render(<MemoryRouter><Recover /></MemoryRouter>);
    await user.type(screen.getByLabelText("Username"), "ada");
    await user.click(screen.getByRole("button", { name: /Request Account Recovery/i }));
    await screen.findByText(/Approvals complete/i);
    await user.type(screen.getByLabelText("New Password"), "new-password");
    await user.type(screen.getByLabelText("Confirm Password"), "new-password");
    await user.click(screen.getByRole("button", { name: /Recover & Reset Account/i }));
    await user.click(screen.getByRole("button", { name: /Cancel recovery/i }));

    await act(async () => {
      encryptDeferred.resolve?.("must-not-submit");
      await Promise.resolve();
    });

    await waitFor(() => expect(screen.getByLabelText("Username")).toHaveValue(""));
    expect(screen.queryByLabelText("New Password")).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[2][0]).toContain("/v1/recovery/cancel");
    expect((fetchMock.mock.calls[2][1] as RequestInit).headers).toEqual({ Authorization: `Bearer ${started.recovery_token}` });
  });

  it("does not offer cancellation after the reset request has been submitted", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response(started))
      .mockResolvedValueOnce(response(readyStatus))
      .mockImplementationOnce(() => new Promise<Response>((resolve) => {
        resetDeferred.resolve = resolve;
      }));
    vi.stubGlobal("fetch", fetchMock);

    render(<MemoryRouter><Recover /></MemoryRouter>);
    await user.type(screen.getByLabelText("Username"), "ada");
    await user.click(screen.getByRole("button", { name: /Request Account Recovery/i }));
    await screen.findByText(/Approvals complete/i);
    await user.type(screen.getByLabelText("New Password"), "new-password");
    await user.type(screen.getByLabelText("Confirm Password"), "new-password");
    await user.click(screen.getByRole("button", { name: /Recover & Reset Account/i }));

    await act(async () => {
      encryptDeferred.resolve?.("encrypted-key");
      await Promise.resolve();
    });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));

    const cancel = screen.getByRole("button", { name: /Cancel recovery/i });
    expect(cancel).toBeDisabled();
    await user.click(cancel);
    expect(fetchMock).toHaveBeenCalledTimes(3);

    await act(async () => {
      resetDeferred.resolve?.(response({ message: "reset" }));
      await Promise.resolve();
    });
  });

  it("explains an unknown reset outcome without offering cancellation", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response(started))
      .mockResolvedValueOnce(response(readyStatus))
      .mockRejectedValueOnce(new TypeError("Failed to fetch"));
    vi.stubGlobal("fetch", fetchMock);

    render(<MemoryRouter><Recover /></MemoryRouter>);
    await user.type(screen.getByLabelText("Username"), "ada");
    await user.click(screen.getByRole("button", { name: /Request Account Recovery/i }));
    await screen.findByText(/Approvals complete/i);
    await user.type(screen.getByLabelText("New Password"), "new-password");
    await user.type(screen.getByLabelText("Confirm Password"), "new-password");
    await user.click(screen.getByRole("button", { name: /Recover & Reset Account/i }));

    await act(async () => {
      encryptDeferred.resolve?.("encrypted-key");
      await Promise.resolve();
    });

    expect(await screen.findByRole("alert")).toHaveTextContent(/could not confirm whether the password changed.*try signing in with the new password/i);
    expect(screen.getByRole("button", { name: /Cancel recovery/i })).toBeDisabled();
  });

  it("treats a server error after reset submission as an unknown outcome", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response(started))
      .mockResolvedValueOnce(response(readyStatus))
      .mockResolvedValueOnce(response({ error: "temporary failure" }, false, 503));
    vi.stubGlobal("fetch", fetchMock);

    render(<MemoryRouter><Recover /></MemoryRouter>);
    await user.type(screen.getByLabelText("Username"), "ada");
    await user.click(screen.getByRole("button", { name: /Request Account Recovery/i }));
    await screen.findByText(/Approvals complete/i);
    await user.type(screen.getByLabelText("New Password"), "new-password");
    await user.type(screen.getByLabelText("Confirm Password"), "new-password");
    await user.click(screen.getByRole("button", { name: /Recover & Reset Account/i }));

    await act(async () => {
      encryptDeferred.resolve?.("encrypted-key");
      await Promise.resolve();
    });

    expect(await screen.findByRole("alert")).toHaveTextContent(/could not confirm whether the password changed.*try signing in with the new password/i);
    expect(screen.getByRole("button", { name: /Cancel recovery/i })).toBeDisabled();
  });

  it("keeps the capability and recovery inputs when cancellation is not acknowledged", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response(started))
      .mockResolvedValueOnce(response(readyStatus))
      .mockResolvedValueOnce(response({ error: "unavailable" }, false, 503));
    vi.stubGlobal("fetch", fetchMock);

    render(<MemoryRouter><Recover /></MemoryRouter>);
    await user.type(screen.getByLabelText("Username"), "ada");
    await user.click(screen.getByRole("button", { name: /Request Account Recovery/i }));
    await screen.findByText(/Approvals complete/i);
    await user.type(screen.getByLabelText("New Password"), "new-password");
    await user.type(screen.getByLabelText("Confirm Password"), "new-password");
    await user.click(screen.getByRole("button", { name: /Cancel recovery/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/could not confirm cancellation|try again/i);
    expect(sessionStorage.getItem("abrn_recovery_capability")).toBe(started.recovery_token);
    expect(screen.getByLabelText("New Password")).toHaveValue("new-password");
    expect(screen.getByText(/Approvals complete/i)).toBeInTheDocument();
  });

  it("keeps both reset credentials editable with named visibility controls", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(response(started))
      .mockResolvedValueOnce(response(readyStatus)));

    render(<MemoryRouter><Recover /></MemoryRouter>);
    await user.type(screen.getByLabelText("Username"), "ada");
    await user.click(screen.getByRole("button", { name: /Request Account Recovery/i }));
    await screen.findByText(/Approvals complete/i);

    const password = screen.getByLabelText("New Password");
    const confirmation = screen.getByLabelText("Confirm Password");
    await user.click(screen.getByRole("button", { name: /show new password/i }));
    await user.click(screen.getByRole("button", { name: /show password confirmation/i }));

    expect(password).toHaveAttribute("type", "text");
    expect(confirmation).toHaveAttribute("type", "text");
  });
});

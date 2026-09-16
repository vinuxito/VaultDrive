import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import Recover from "./recover";

const encryptDeferred = vi.hoisted(() => ({ resolve: null as null | ((value: string) => void) }));

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
  shares: [
    { custodian_id: "1", custodian_username: "one", custodian_first_name: "One", custodian_last_name: "User", status: "approved", decrypted_share_part: "aa" },
    { custodian_id: "2", custodian_username: "two", custodian_first_name: "Two", custodian_last_name: "User", status: "pending", decrypted_share_part: "" },
  ],
};

const readyStatus = {
  threshold: 1,
  shares: [
    { custodian_id: "1", custodian_username: "one", custodian_first_name: "One", custodian_last_name: "User", status: "approved", decrypted_share_part: "aa" },
  ],
};

function response(body: unknown, ok = true) {
  return { ok, json: async () => body } as Response;
}

describe("account recovery guidance", () => {
  beforeEach(() => {
    encryptDeferred.resolve = null;
  });

  it("explains the original file credential limitation before starting recovery", () => {
    render(<MemoryRouter><Recover /></MemoryRouter>);
    expect(screen.getByText(/files encrypted with an earlier PIN or file password still need that original credential/i)).toBeInTheDocument();
    expect(screen.getByText(/support cannot recover a lost file credential/i)).toBeInTheDocument();
  });

  it("shows the last successful check and offers a manual retry while waiting", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response({ message: "started" }))
      .mockResolvedValue(response(pendingStatus));
    vi.stubGlobal("fetch", fetchMock);

    render(<MemoryRouter><Recover /></MemoryRouter>);
    await user.type(screen.getByLabelText("Username"), "ada");
    await user.click(screen.getByRole("button", { name: /Request Account Recovery/i }));

    await screen.findByText(/1 \/ 2 Approved/i);
    expect(screen.getByText(/Last checked/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Check again/i })).toBeInTheDocument();
    expect(screen.queryByText(/Reconstructing private key/i)).not.toBeInTheDocument();
  });

  it("calls the operation reconstructing only while reset work is running", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response({ message: "started" }))
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
      .mockResolvedValueOnce(response({ message: "started" }))
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
      .mockResolvedValueOnce(response({ message: "started" }))
      .mockResolvedValueOnce(response(readyStatus));
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

    expect(screen.getByLabelText("Username")).toHaveValue("");
    expect(screen.queryByLabelText("New Password")).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

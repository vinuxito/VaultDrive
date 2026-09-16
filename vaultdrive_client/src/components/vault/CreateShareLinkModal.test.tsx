import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CreateShareLinkModal } from "./CreateShareLinkModal";

const recoveryMocks = vi.hoisted(() => ({ recoverVerifiedOwnerFileKey: vi.fn() }));
const vaultMocks = vi.hoisted(() => ({
  getCredential: vi.fn(() => null),
  getFileKey: vi.fn(() => null),
  getFolderKey: vi.fn<() => CryptoKey | null>(() => null),
  setFileKey: vi.fn(),
}));

vi.mock("../../context/SessionVaultContext", () => ({
  useSessionVault: () => vaultMocks,
}));

vi.mock("../../utils/access-link-recovery", () => ({
  recoverVerifiedOwnerFileKey: recoveryMocks.recoverVerifiedOwnerFileKey,
}));

describe("CreateShareLinkModal verified key recovery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    localStorage.setItem("token", "session-token");
    vaultMocks.getCredential.mockReturnValue(null);
    vaultMocks.getFileKey.mockReturnValue(null);
    vaultMocks.getFolderKey.mockReturnValue(null);
  });

  it("describes a limited-use route without claiming the file key is destroyed", () => {
    render(<CreateShareLinkModal isOpen onClose={() => undefined} file={{
      id: "file-1",
      filename: "proposal.pdf",
      metadata: JSON.stringify({ credential_scheme: "pin", iv: "iv", salt: "salt" }),
      is_owner: true,
    }} />);

    expect(screen.getByLabelText(/close link after first authorized fetch/i)).toBeInTheDocument();
    expect(screen.getByText(/owner file and copies already saved are unaffected/i)).toBeInTheDocument();
    expect(screen.queryByText(/destroy the key|auto-shredding/i)).not.toBeInTheDocument();
  });

  it("does not create a share grant when authenticated decryption rejects the PIN", async () => {
    recoveryMocks.recoverVerifiedOwnerFileKey.mockRejectedValue(new Error("That credential didn't unlock this file. Check it and try again."));
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/files/file-1/download") && !init?.method) {
        return new Response(new Uint8Array([1, 2, 3]), { status: 200 });
      }
      if (init?.method === "POST") throw new Error("share grant must not be created");
      throw new Error(`Unhandled fetch: ${url}`);
    }) as typeof fetch;

    render(<CreateShareLinkModal isOpen onClose={() => undefined} file={{
      id: "file-1",
      filename: "proposal.pdf",
      metadata: JSON.stringify({ credential_scheme: "pin", iv: "iv", salt: "salt" }),
      is_owner: true,
    }} />);

    await userEvent.type(screen.getByLabelText("4-digit PIN"), "9999");
    await userEvent.click(screen.getByRole("button", { name: "Generate Link" }));

    expect(await screen.findByText("That credential didn't unlock this file. Check it and try again.")).toBeInTheDocument();
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalledTimes(1));
    expect(screen.queryByText("Share link created")).not.toBeInTheDocument();
  });

  it("uses the explicit unlocked folder key for a folder-wrapped file", async () => {
    const folderKey = { id: "folder-key" } as unknown as CryptoKey;
    vaultMocks.getFolderKey.mockReturnValue(folderKey);
    recoveryMocks.recoverVerifiedOwnerFileKey.mockResolvedValue({ key: {} as CryptoKey, fragment: "verified" });
    globalThis.fetch = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (!init?.method) return new Response(new Uint8Array([1]), { status: 200, headers: { "X-Wrapped-Key": "wrapped" } });
      return new Response(JSON.stringify({ token: "share-token" }), { status: 200 });
    }) as typeof fetch;

    render(<CreateShareLinkModal isOpen onClose={() => undefined} file={{
      id: "file-1", filename: "folder-file.pdf", folder_id: "folder-1",
      metadata: JSON.stringify({ credential_scheme: "folder", iv: "iv" }),
    }} />);
    await userEvent.click(screen.getByRole("button", { name: "Generate Link" }));

    await waitFor(() => expect(recoveryMocks.recoverVerifiedOwnerFileKey).toHaveBeenCalledWith(
      expect.objectContaining({ folderKey, credential: "" }),
    ));
    expect(await screen.findByText("Share link created")).toBeInTheDocument();
  });

  it("does not create a grant after the modal closes during key recovery", async () => {
    let finishRecovery: ((value: { key: CryptoKey; fragment: string }) => void) | undefined;
    recoveryMocks.recoverVerifiedOwnerFileKey.mockImplementation(() => new Promise((resolve) => { finishRecovery = resolve; }));
    globalThis.fetch = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (!init?.method) return new Response(new Uint8Array([1]), { status: 200 });
      throw new Error("grant must not be created");
    }) as typeof fetch;
    const onClose = vi.fn();

    render(<CreateShareLinkModal isOpen onClose={onClose} file={{
      id: "file-1", filename: "proposal.pdf",
      metadata: JSON.stringify({ credential_scheme: "pin", iv: "iv", salt: "salt" }),
    }} />);
    await userEvent.type(screen.getByLabelText("4-digit PIN"), "1111");
    await userEvent.click(screen.getByRole("button", { name: "Generate Link" }));
    await waitFor(() => expect(recoveryMocks.recoverVerifiedOwnerFileKey).toHaveBeenCalled());
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    finishRecovery?.({ key: {} as CryptoKey, fragment: "secret" });
    await Promise.resolve();

    expect(onClose).toHaveBeenCalled();
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });
});

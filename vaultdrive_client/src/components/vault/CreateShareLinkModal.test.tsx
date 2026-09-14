import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CreateShareLinkModal } from "./CreateShareLinkModal";

const recoveryMocks = vi.hoisted(() => ({ recoverVerifiedOwnerFileKey: vi.fn() }));

vi.mock("../../context/SessionVaultContext", () => ({
  useSessionVault: () => ({
    getCredential: () => null,
    getFileKey: () => null,
    getFolderKey: () => null,
    setFileKey: vi.fn(),
  }),
}));

vi.mock("../../utils/access-link-recovery", () => ({
  recoverVerifiedOwnerFileKey: recoveryMocks.recoverVerifiedOwnerFileKey,
}));

describe("CreateShareLinkModal verified key recovery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    localStorage.setItem("token", "session-token");
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
});

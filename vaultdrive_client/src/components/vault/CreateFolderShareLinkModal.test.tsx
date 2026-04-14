import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CreateFolderShareLinkModal } from "./CreateFolderShareLinkModal";

const sessionVaultMocks = vi.hoisted(() => ({
  getCredential: vi.fn(),
}));

const cryptoMocks = vi.hoisted(() => ({
  decryptPrivateKeyWithPIN: vi.fn(),
}));

vi.mock("../../context/SessionVaultContext", () => ({
  useSessionVault: () => ({
    getCredential: sessionVaultMocks.getCredential,
  }),
}));

vi.mock("../../utils/crypto", async () => {
  const actual = await vi.importActual<typeof import("../../utils/crypto")>("../../utils/crypto");
  return {
    ...actual,
    decryptPrivateKeyWithPIN: cryptoMocks.decryptPrivateKeyWithPIN,
  };
});

describe("CreateFolderShareLinkModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    localStorage.setItem("token", "session-token");
    localStorage.setItem(
      "user",
      JSON.stringify({
        private_key_pin_encrypted: "wrapped-private-key",
        public_key: "public-key",
      }),
    );
    sessionVaultMocks.getCredential.mockReturnValue({ type: "pin", value: "1111" });
    cryptoMocks.decryptPrivateKeyWithPIN.mockRejectedValue(new Error(""));
  });

  it("falls back to a manual pin prompt when an auto-used cached pin fails", async () => {
    render(
      <CreateFolderShareLinkModal
        isOpen={true}
        onClose={() => undefined}
        folder={{ id: "folder-1", name: "ABRN CSD" }}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /generate link/i }));

    await waitFor(() => {
      expect(
        screen.getByText("Your cached PIN could not unlock this folder share. Enter your current PIN and try again."),
      ).toBeInTheDocument();
    });

    expect(screen.getByLabelText(/4-digit pin/i)).toBeInTheDocument();
  });
});

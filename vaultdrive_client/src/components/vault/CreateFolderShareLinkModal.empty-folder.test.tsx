import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CreateFolderShareLinkModal } from "./CreateFolderShareLinkModal";

const sessionVaultMocks = vi.hoisted(() => ({
  getCredential: vi.fn(),
}));

const cryptoMocks = vi.hoisted(() => ({
  decryptPrivateKeyWithPIN: vi.fn(),
  importRSAPrivateKey: vi.fn(),
}));

const fetchMock = vi.fn();

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
    importRSAPrivateKey: cryptoMocks.importRSAPrivateKey,
  };
});

describe("CreateFolderShareLinkModal empty folder handoff", () => {
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
    cryptoMocks.decryptPrivateKeyWithPIN.mockResolvedValue("private-key-pem");
    cryptoMocks.importRSAPrivateKey.mockResolvedValue({});
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ files: [], total_count: 0 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    globalThis.fetch = fetchMock as typeof fetch;
  });

  it("guides users to create an upload link when the folder is empty", async () => {
    const handleUseUploadLink = vi.fn();

    render(
      <CreateFolderShareLinkModal
        isOpen={true}
        onClose={() => undefined}
        onUseUploadLink={handleUseUploadLink}
        folder={{ id: "folder-1", name: "Client Intake" }}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /generate link/i }));

    await waitFor(() => {
      expect(screen.getByText(/this folder is empty right now/i)).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole("button", { name: /create upload link instead/i }));
    expect(handleUseUploadLink).toHaveBeenCalledTimes(1);
  });
});

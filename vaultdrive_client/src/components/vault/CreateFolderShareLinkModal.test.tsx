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
  generateFileKey: vi.fn(),
  importRSAPublicKey: vi.fn(),
  wrapKeyWithAES: vi.fn(),
  wrapKeyWithRSA: vi.fn(),
  exportKey: vi.fn(),
}));

const folderShareMocks = vi.hoisted(() => ({
  resolveFolderShareFileKey: vi.fn(),
}));

const clipboardWriteText = vi.fn();

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
    generateFileKey: cryptoMocks.generateFileKey,
    importRSAPublicKey: cryptoMocks.importRSAPublicKey,
    wrapKeyWithAES: cryptoMocks.wrapKeyWithAES,
    wrapKeyWithRSA: cryptoMocks.wrapKeyWithRSA,
    exportKey: cryptoMocks.exportKey,
  };
});

vi.mock("../../utils/folder-share", () => ({
  resolveFolderShareFileKey: folderShareMocks.resolveFolderShareFileKey,
}));

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
    cryptoMocks.importRSAPrivateKey.mockResolvedValue({});
    cryptoMocks.generateFileKey.mockResolvedValue({});
    cryptoMocks.importRSAPublicKey.mockResolvedValue({});
    cryptoMocks.wrapKeyWithAES.mockResolvedValue("wrapped-file-key");
    cryptoMocks.wrapKeyWithRSA.mockResolvedValue("owner-wrapped-folder-key");
    cryptoMocks.exportKey.mockResolvedValue("folder-share-secret");
    folderShareMocks.resolveFolderShareFileKey.mockResolvedValue({});
    globalThis.fetch = fetchMock as typeof fetch;

    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: clipboardWriteText },
      configurable: true,
    });
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

  it("guides users to upload links when the folder is empty", async () => {
    const handleUseUploadLink = vi.fn();

    cryptoMocks.decryptPrivateKeyWithPIN.mockResolvedValue("private-key-pem");
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ files: [], total_count: 0 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    render(
      <CreateFolderShareLinkModal
        isOpen={true}
        onClose={() => undefined}
        onUseUploadLink={handleUseUploadLink}
        folder={{ id: "folder-1", name: "Cristobal Sánchez" }}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /generate link/i }));

    await waitFor(() => {
      expect(screen.getByText(/folder share only works after the folder already contains files/i)).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole("button", { name: /generate upload link instead/i }));
    expect(handleUseUploadLink).toHaveBeenCalledTimes(1);
  });

  it("keeps the created folder share URL masked until the correct PIN is entered for copy", async () => {
    cryptoMocks.decryptPrivateKeyWithPIN.mockResolvedValue("private-key-pem");
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify({
          files: [{ id: "file-1", filename: "report.pdf", encrypted_metadata: "{}" }],
          total_count: 1,
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ "file-1": "wrapped-key" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ token: "folder-token-1" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

    render(
      <CreateFolderShareLinkModal
        isOpen={true}
        onClose={() => undefined}
        folder={{ id: "folder-1", name: "ABRN CSD" }}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /generate link/i }));

    expect(await screen.findByDisplayValue(/#••••••••/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /copy full folder share link/i }));
    const pinInput = await screen.findByLabelText(/4-digit pin/i);
    await userEvent.type(pinInput, "0000");
    await userEvent.click(screen.getByRole("button", { name: /verify pin and copy/i }));

    expect(await screen.findByText(/that pin didn't match/i)).toBeInTheDocument();
    expect(clipboardWriteText).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(pinInput).toHaveFocus();
    });
    expect(pinInput).toHaveValue("");
    expect(pinInput).toHaveAttribute("aria-invalid", "true");
    expect(pinInput.getAttribute("aria-describedby") ?? "").toContain("-error");

    await userEvent.type(screen.getByLabelText(/4-digit pin/i), "1111");
    await userEvent.click(screen.getByRole("button", { name: /verify pin and copy/i }));

    await waitFor(() => {
      expect(clipboardWriteText).toHaveBeenCalledWith(
        "http://localhost:3000/abrn/folder-share/folder-token-1#folder-share-secret",
      );
    });
  });
});

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import SharedFiles from "./shared";

const sessionVaultMocks = vi.hoisted(() => ({
  getPrivateKey: vi.fn(),
  getCredential: vi.fn(),
  setCredential: vi.fn(),
  setPrivateKey: vi.fn(),
}));

const sharedSessionMocks = vi.hoisted(() => ({
  restorePrivateKeyFromSessionPin: vi.fn(),
}));

const cryptoMocks = vi.hoisted(() => ({
  unwrapKeyWithRSA: vi.fn(),
  decryptFile: vi.fn(),
  base64ToArrayBuffer: vi.fn(),
}));

vi.mock("../context/SessionVaultContext", () => ({
  useSessionVault: () => ({
    getPrivateKey: sessionVaultMocks.getPrivateKey,
    getCredential: sessionVaultMocks.getCredential,
    setCredential: sessionVaultMocks.setCredential,
    setPrivateKey: sessionVaultMocks.setPrivateKey,
  }),
}));

vi.mock("../components/files", () => ({
  FileWidget: ({ file, onDownload }: { file: { id: string; filename: string; metadata: string }; onDownload: (id: string, filename: string, metadata: string) => void }) => (
    <button type="button" onClick={() => onDownload(file.id, file.filename, file.metadata)}>
      Download {file.filename}
    </button>
  ),
}));

vi.mock("../utils/shared-session", () => ({
  restorePrivateKeyFromSessionPin: sharedSessionMocks.restorePrivateKeyFromSessionPin,
}));

vi.mock("../utils/crypto", async () => {
  const actual = await vi.importActual<typeof import("../utils/crypto")>("../utils/crypto");
  return {
    ...actual,
    unwrapKeyWithRSA: cryptoMocks.unwrapKeyWithRSA,
    decryptFile: cryptoMocks.decryptFile,
    base64ToArrayBuffer: cryptoMocks.base64ToArrayBuffer,
  };
});

describe("SharedFiles", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    localStorage.setItem("token", "session-token");
    localStorage.setItem(
      "user",
      JSON.stringify({
        pin_set: true,
        private_key_pin_encrypted: "wrapped-private-key",
      }),
    );

    cryptoMocks.base64ToArrayBuffer.mockReturnValue(new Uint8Array([1, 2, 3]).buffer);
    cryptoMocks.unwrapKeyWithRSA.mockResolvedValue({ id: "aes-key" } as unknown as CryptoKey);
    cryptoMocks.decryptFile.mockResolvedValue(new Uint8Array([1, 2, 3]).buffer);

    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/files/shared")) {
        return new Response(
          JSON.stringify([
            {
              id: "file-1",
              filename: "shared.pdf",
              file_size: 12,
              owner_username: "owner",
              shared_at: new Date().toISOString(),
              encrypted_metadata: JSON.stringify({ iv: "iv-data" }),
            },
          ]),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      if (url.endsWith("/files/file-1/download")) {
        return new Response(new Uint8Array([1, 2, 3]), {
          status: 200,
          headers: {
            "X-Wrapped-Key": "wrapped-key",
            "X-File-Metadata": JSON.stringify({ iv: "iv-data" }),
          },
        });
      }

      throw new Error(`Unhandled fetch: ${url}`);
    }) as typeof fetch;
  });

  it("shows the real download error instead of asking for a pin again", async () => {
    sessionVaultMocks.getPrivateKey.mockReturnValue({ id: "session-rsa-key" } as unknown as CryptoKey);
    cryptoMocks.unwrapKeyWithRSA.mockRejectedValue(new Error("Failed to download file"));
    sharedSessionMocks.restorePrivateKeyFromSessionPin.mockResolvedValue(null);

    render(
      <MemoryRouter>
        <SharedFiles />
      </MemoryRouter>,
    );

    await userEvent.click(await screen.findByRole("button", { name: /download shared.pdf/i }));

    await waitFor(() => {
      expect(screen.getByText("Failed to download file")).toBeInTheDocument();
    });

    expect(screen.queryByText("Decrypt Shared File")).not.toBeInTheDocument();
  });

  it("restores the private key from the cached session pin before prompting", async () => {
    sessionVaultMocks.getPrivateKey.mockReturnValue(null);
    sessionVaultMocks.getCredential.mockReturnValue({ type: "pin", value: "1234" });
    sharedSessionMocks.restorePrivateKeyFromSessionPin.mockResolvedValue({ id: "restored-rsa-key" } as unknown as CryptoKey);

    render(
      <MemoryRouter>
        <SharedFiles />
      </MemoryRouter>,
    );

    await userEvent.click(await screen.findByRole("button", { name: /download shared.pdf/i }));

    await waitFor(() => {
      expect(sharedSessionMocks.restorePrivateKeyFromSessionPin).toHaveBeenCalledWith({
        credential: { type: "pin", value: "1234" },
        privateKeyPinEncrypted: "wrapped-private-key",
      });
    });

    expect(sessionVaultMocks.setPrivateKey).toHaveBeenCalledWith({ id: "restored-rsa-key" });
    expect(screen.queryByText("Decrypt Shared File")).not.toBeInTheDocument();
    expect(sessionVaultMocks.setCredential).not.toHaveBeenCalled();
  });
});

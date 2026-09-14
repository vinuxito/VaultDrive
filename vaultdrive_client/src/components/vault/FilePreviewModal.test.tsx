import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { FilePreviewModal } from "./FilePreviewModal";

const vaultMocks = vi.hoisted(() => ({
  getPrivateKey: vi.fn(),
  getPrivateKeyPem: vi.fn(),
  getCredential: vi.fn(),
  setCredential: vi.fn(),
  clearCredential: vi.fn(),
}));
const cryptoMocks = vi.hoisted(() => ({
  decryptPrivateKeyWithPIN: vi.fn(),
}));

vi.mock("../../context/SessionVaultContext", () => ({
  useSessionVault: () => vaultMocks,
}));

vi.mock("../../utils/crypto", () => ({
  decryptPrivateKeyWithPIN: cryptoMocks.decryptPrivateKeyWithPIN,
  importRSAPSSPrivateKey: vi.fn(),
  importRSAPSSPublicKey: vi.fn(),
  signWithRSAPSS: vi.fn(),
  verifyWithRSAPSS: vi.fn(),
}));

vi.mock("./TrustRail", () => ({ TrustRail: () => null }));
vi.mock("./FileSecurityTimeline", () => ({ FileSecurityTimeline: () => null }));

describe("FilePreviewModal cached credential recovery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    localStorage.setItem("user", JSON.stringify({
      pin_set: true,
      private_key_pin_encrypted: "encrypted-private-key",
    }));
    vaultMocks.getPrivateKey.mockReturnValue(null);
    vaultMocks.getPrivateKeyPem.mockResolvedValue(null);
    vaultMocks.getCredential.mockReturnValue({ type: "pin", value: "1234" });
    cryptoMocks.decryptPrivateKeyWithPIN.mockRejectedValue(new Error("bad PIN"));
  });

  it("clears a rejected cached PIN and reopens the prompt when unlock fails before the worker", async () => {
    render(
      <FilePreviewModal
        file={{
          id: "shared-file",
          filename: "contract.pdf",
          metadata: "{}",
          is_owner: false,
        }}
        onClose={() => undefined}
        onDownload={() => undefined}
      />,
    );

    await waitFor(() => expect(vaultMocks.clearCredential).toHaveBeenCalledTimes(1));
    expect(screen.getByLabelText(/^pin$/i)).toBeInTheDocument();
  });

  it("uses the active skin's semantic colors for the preview shell", async () => {
    render(
      <FilePreviewModal
        file={{
          id: "shared-file",
          filename: "contract.pdf",
          metadata: "{}",
          is_owner: false,
        }}
        onClose={() => undefined}
        onDownload={() => undefined}
      />,
    );

    await screen.findByLabelText(/^pin$/i);
    expect(screen.getByRole("heading", { name: "contract.pdf" })).toHaveClass("text-foreground");
    expect(screen.getByRole("button", { name: "Close preview" })).toBeInTheDocument();
    expect(screen.getByText("This file was shared with you.")).toHaveClass("text-foreground");
    expect(screen.getByLabelText(/^pin$/i)).toHaveClass("bg-background", "text-foreground");
  });

  it("offers a retry for a transport failure without clearing the cached PIN", async () => {
    cryptoMocks.decryptPrivateKeyWithPIN.mockResolvedValue("private-key");

    class FailingWorker {
      onmessage: ((event: MessageEvent) => void) | null = null;
      onerror: ((event: ErrorEvent) => void) | null = null;
      postMessage() {
        queueMicrotask(() => this.onmessage?.({
          data: {
            success: false,
            error: "The service is temporarily unavailable.",
            failureKind: "storage",
          },
        } as MessageEvent));
      }
      terminate() {}
    }
    vi.stubGlobal("Worker", FailingWorker);

    render(
      <FilePreviewModal
        file={{
          id: "shared-file",
          filename: "contract.pdf",
          metadata: "{}",
          is_owner: false,
        }}
        onClose={() => undefined}
        onDownload={() => undefined}
      />,
    );

    expect(await screen.findByText("The service is temporarily unavailable."))
      .toBeInTheDocument();
    expect(screen.getByRole("button", { name: /retry preview/i })).toBeInTheDocument();
    expect(vaultMocks.clearCredential).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: /edit credential/i }));
    expect(screen.getByLabelText(/^pin$/i)).toHaveValue("1234");
  });
});

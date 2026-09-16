import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FilePreviewModal } from "./FilePreviewModal";

const vaultMocks = vi.hoisted(() => ({
  getFileKey: vi.fn(),
  getFolderKey: vi.fn(),
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

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("keeps the PIN task visible while technical history starts collapsed", async () => {
    vaultMocks.getCredential.mockReturnValue(null);
    render(<FilePreviewModal file={{ id: "owner", filename: "owner.txt", is_owner: true, metadata: JSON.stringify({ credential_scheme: "pin" }) }} onClose={() => {}} onDownload={() => {}} />);
    expect(screen.getByLabelText("PIN")).toBeVisible();
    expect(screen.getByRole("button", { name: /Protection & History/ })).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("dialog")).toHaveAccessibleName("owner.txt");
  });

  it("gives a folder unlock action instead of asking for an unrelated PIN", async () => {
    vaultMocks.getCredential.mockReturnValue(null);
    const close = vi.fn();
    render(<FilePreviewModal file={{ id: "folder-file", folder_id: "folder", filename: "folder.txt", is_owner: true, metadata: JSON.stringify({ credential_scheme: "folder" }) }} onClose={close} onDownload={() => {}} />);
    expect(await screen.findByRole("alert")).toHaveTextContent(/reopen the containing folder/);
    expect(screen.queryByLabelText("PIN")).not.toBeInTheDocument();
    await userEvent.click(screen.getAllByRole("button", { name: "Close preview" }).at(-1)!);
    expect(close).toHaveBeenCalledTimes(1);
  });

  it("opens a collaborator folder preview with its unlocked folder key and no PIN prompt", async () => {
    const folderKey = {} as CryptoKey;
    vaultMocks.getFolderKey.mockReturnValue(folderKey);
    vaultMocks.getCredential.mockReturnValue(null);
    const posted: unknown[] = [];
    class SuccessfulWorker {
      onmessage: ((event: MessageEvent) => void) | null = null;
      onerror: ((event: ErrorEvent) => void) | null = null;
      postMessage(message: unknown) {
        posted.push(message);
        queueMicrotask(() => this.onmessage?.({ data: { success: true, decryptedBuffer: new TextEncoder().encode("shared preview").buffer } } as MessageEvent));
      }
      terminate() {}
    }
    vi.stubGlobal("Worker", SuccessfulWorker);

    render(<FilePreviewModal file={{
      id: "shared-folder-file",
      folder_id: "shared-folder",
      filename: "shared.txt",
      is_owner: false,
      metadata: JSON.stringify({ credential_scheme: "folder" }),
    }} onClose={() => {}} onDownload={() => {}} />);

    expect(await screen.findByText("shared preview")).toBeInTheDocument();
    expect(screen.queryByLabelText(/^pin$/i)).not.toBeInTheDocument();
    expect(posted).toContainEqual(expect.objectContaining({ folderKey, credential: "" }));
    expect(vaultMocks.getPrivateKeyPem).not.toHaveBeenCalled();
  });

  it("keeps RSA preview for a directly shared folder-encrypted file without a folder route", async () => {
    vaultMocks.getPrivateKeyPem.mockResolvedValue("recipient-private-key");
    vaultMocks.getCredential.mockReturnValue({ type: "pin", value: "1234" });
    const posted: unknown[] = [];
    class SuccessfulWorker {
      onmessage: ((event: MessageEvent) => void) | null = null;
      onerror: ((event: ErrorEvent) => void) | null = null;
      postMessage(message: unknown) {
        posted.push(message);
        queueMicrotask(() => this.onmessage?.({ data: { success: true, decryptedBuffer: new TextEncoder().encode("direct preview").buffer } } as MessageEvent));
      }
      terminate() {}
    }
    vi.stubGlobal("Worker", SuccessfulWorker);

    render(<FilePreviewModal file={{
      id: "direct-folder-file",
      filename: "direct.txt",
      is_owner: false,
      metadata: JSON.stringify({ credential_scheme: "folder" }),
    }} onClose={() => {}} onDownload={() => {}} />);

    expect(await screen.findByText("direct preview")).toBeInTheDocument();
    expect(screen.queryByText(/reopen the containing folder/i)).not.toBeInTheDocument();
    expect(posted).toContainEqual(expect.objectContaining({ rawPrivateKeyPem: "recipient-private-key", folderKey: undefined }));
  });

  it("uses a masked app dialog to unlock local signing and allows cancellation", async () => {
    vaultMocks.getFolderKey.mockReturnValue({} as CryptoKey);
    vaultMocks.getCredential.mockReturnValue(null);
    class SuccessfulWorker {
      onmessage: ((event: MessageEvent) => void) | null = null;
      onerror: ((event: ErrorEvent) => void) | null = null;
      postMessage() {
        queueMicrotask(() => this.onmessage?.({ data: { success: true, decryptedBuffer: new TextEncoder().encode("owner preview").buffer } } as MessageEvent));
      }
      terminate() {}
    }
    vi.stubGlobal("Worker", SuccessfulWorker);
    const promptSpy = vi.spyOn(window, "prompt");

    render(<FilePreviewModal file={{ id: "owner", folder_id: "folder", filename: "owner.txt", is_owner: true, metadata: JSON.stringify({ credential_scheme: "folder" }) }} onClose={() => {}} onDownload={() => {}} />);
    await screen.findByText("owner preview");
    await userEvent.click(screen.getByRole("button", { name: "Sign locally" }));

    const signingDialog = screen.getByRole("dialog", { name: /unlock local signing/i });
    const signingCredential = screen.getByLabelText(/account pin/i);
    expect(signingDialog).toBeInTheDocument();
    expect(signingCredential).toHaveAttribute("type", "password");
    expect(promptSpy).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: /cancel signing/i }));
    expect(screen.queryByRole("dialog", { name: /unlock local signing/i })).not.toBeInTheDocument();
  });

  it("keeps the masked signing dialog open with a useful error after a rejected PIN", async () => {
    vaultMocks.getFolderKey.mockReturnValue({} as CryptoKey);
    vaultMocks.getCredential.mockReturnValue(null);
    cryptoMocks.decryptPrivateKeyWithPIN.mockRejectedValue(new Error("bad PIN"));
    class SuccessfulWorker {
      onmessage: ((event: MessageEvent) => void) | null = null;
      onerror: ((event: ErrorEvent) => void) | null = null;
      postMessage() {
        queueMicrotask(() => this.onmessage?.({ data: { success: true, decryptedBuffer: new TextEncoder().encode("owner preview").buffer } } as MessageEvent));
      }
      terminate() {}
    }
    vi.stubGlobal("Worker", SuccessfulWorker);

    render(<FilePreviewModal file={{ id: "owner", folder_id: "folder", filename: "owner.txt", is_owner: true, metadata: JSON.stringify({ credential_scheme: "folder" }) }} onClose={() => {}} onDownload={() => {}} />);
    await screen.findByText("owner preview");
    await userEvent.click(screen.getByRole("button", { name: "Sign locally" }));
    const signingCredential = screen.getByLabelText(/account pin/i);
    await userEvent.type(signingCredential, "0000");
    await userEvent.click(screen.getByRole("button", { name: /unlock and sign/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/could not unlock signing/i);
    expect(screen.getByLabelText(/account pin/i)).toHaveAttribute("type", "password");
  });

  it("terminates deferred preview workers when the file changes and the modal unmounts", async () => {
    vaultMocks.getFolderKey.mockReturnValue({} as CryptoKey);
    vaultMocks.getCredential.mockReturnValue(null);
    const terminate = vi.fn();
    class DeferredWorker {
      onmessage: ((event: MessageEvent) => void) | null = null;
      onerror: ((event: ErrorEvent) => void) | null = null;
      postMessage() {}
      terminate() { terminate(); }
    }
    vi.stubGlobal("Worker", DeferredWorker);

    const view = render(<FilePreviewModal file={{ id: "owner-a", folder_id: "folder", filename: "owner-a.txt", is_owner: true, metadata: JSON.stringify({ credential_scheme: "folder" }) }} onClose={() => {}} onDownload={() => {}} />);
    await screen.findByText(/decrypting/i);
    view.rerender(<FilePreviewModal file={{ id: "owner-b", folder_id: "folder", filename: "owner-b.txt", is_owner: true, metadata: JSON.stringify({ credential_scheme: "folder" }) }} onClose={() => {}} onDownload={() => {}} />);
    await waitFor(() => expect(terminate).toHaveBeenCalledTimes(1));
    view.unmount();
    expect(terminate).toHaveBeenCalledTimes(2);
  });

  it("does not create a worker after unmount while recipient key loading is pending", async () => {
    let resolvePem: ((value: string | null) => void) | undefined;
    vaultMocks.getPrivateKeyPem.mockReturnValue(new Promise((resolve) => { resolvePem = resolve; }));
    vaultMocks.getCredential.mockReturnValue({ type: "pin", value: "1234" });
    const workerConstructor = vi.fn();
    class TrackingWorker {
      onmessage: ((event: MessageEvent) => void) | null = null;
      onerror: ((event: ErrorEvent) => void) | null = null;
      constructor() { workerConstructor(); }
      postMessage() {}
      terminate() {}
    }
    vi.stubGlobal("Worker", TrackingWorker);

    const view = render(<FilePreviewModal file={{ id: "shared", filename: "shared.txt", is_owner: false, metadata: "{}" }} onClose={() => {}} onDownload={() => {}} />);
    await waitFor(() => expect(vaultMocks.getPrivateKeyPem).toHaveBeenCalledTimes(1));
    view.unmount();
    resolvePem?.("recipient-private-key");
    await Promise.resolve();
    await Promise.resolve();
    expect(workerConstructor).not.toHaveBeenCalled();
  });

  it("does not publish stale text after the selected file changes", async () => {
    vaultMocks.getFolderKey.mockReturnValue({} as CryptoKey);
    vaultMocks.getCredential.mockReturnValue(null);
    let resolveOldText: ((value: string) => void) | undefined;
    const textSpy = vi.spyOn(Blob.prototype, "text").mockReturnValueOnce(new Promise((resolve) => { resolveOldText = resolve; }));
    const NativeURL = URL;
    class TestURL extends NativeURL {
      static createObjectURL = vi.fn(() => "blob:new-preview");
      static revokeObjectURL = vi.fn();
    }
    vi.stubGlobal("URL", TestURL);
    class SuccessfulWorker {
      onmessage: ((event: MessageEvent) => void) | null = null;
      onerror: ((event: ErrorEvent) => void) | null = null;
      postMessage() {
        queueMicrotask(() => this.onmessage?.({ data: { success: true, decryptedBuffer: new Uint8Array([1, 2, 3]).buffer } } as MessageEvent));
      }
      terminate() {}
    }
    vi.stubGlobal("Worker", SuccessfulWorker);

    const view = render(<FilePreviewModal file={{ id: "old", folder_id: "folder", filename: "old.txt", is_owner: true, metadata: JSON.stringify({ credential_scheme: "folder" }) }} onClose={() => {}} onDownload={() => {}} />);
    await waitFor(() => expect(textSpy).toHaveBeenCalledTimes(1));
    view.rerender(<FilePreviewModal file={{ id: "new", folder_id: "folder", filename: "new.png", is_owner: true, metadata: JSON.stringify({ credential_scheme: "folder" }) }} onClose={() => {}} onDownload={() => {}} />);
    await waitFor(() => expect(URL.createObjectURL).toHaveBeenCalledTimes(1));
    await act(async () => {
      resolveOldText?.("stale plaintext");
      await Promise.resolve();
    });
    expect(screen.queryByText("stale plaintext")).not.toBeInTheDocument();
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

  it("asks for the original file password even when the owner has an account PIN", () => {
    vaultMocks.getCredential.mockReturnValue(null);
    render(<FilePreviewModal
      file={{ id: "request-file", filename: "delivery.zip", metadata: JSON.stringify({ iv: "AA==" }), is_owner: true }}
      onClose={() => undefined} onDownload={() => undefined}
    />);
    const input = screen.getByLabelText("File password");
    expect(input).not.toHaveAttribute("maxLength", "4");
    expect(input).not.toHaveAttribute("inputMode", "numeric");
    expect(screen.queryByText("Enter your 4-digit PIN")).not.toBeInTheDocument();
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

    expect(await screen.findByText(/The service is temporarily unavailable/))
      .toBeInTheDocument();
    expect(screen.getByRole("button", { name: /retry preview/i })).toBeInTheDocument();
    expect(vaultMocks.clearCredential).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: /edit credential/i }));
    expect(screen.getByLabelText(/^pin$/i)).toHaveValue("1234");
  });
});

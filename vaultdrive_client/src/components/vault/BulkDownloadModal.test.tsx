import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { BulkDownloadModal, type BulkDownloadFile } from "./BulkDownloadModal";

const vaultMocks = vi.hoisted(() => ({
  getCredential: vi.fn(),
  clearCredential: vi.fn(),
}));

vi.mock("../../context/SessionVaultContext", () => ({
  useSessionVault: () => vaultMocks,
}));

vi.mock("../theme-provider", () => ({
  useTheme: () => ({ theme: "light" }),
}));

const files: BulkDownloadFile[] = [
  { id: "one", filename: "one.pdf", metadata: "{}", pin_wrapped_key: "wrapped-one" },
  { id: "two", filename: "two.pdf", metadata: "{}", pin_wrapped_key: "wrapped-two" },
];

const metadataPinFile: BulkDownloadFile = {
  id: "metadata-pin",
  filename: "metadata-pin.pdf",
  metadata: JSON.stringify({ credential_scheme: "pin" }),
  is_owner: true,
};

const sharedRsaFile: BulkDownloadFile = {
  id: "shared-rsa",
  filename: "shared-rsa.pdf",
  metadata: JSON.stringify({ credential_scheme: "password" }),
  is_owner: false,
};

const folderFile: BulkDownloadFile = {
  id: "folder",
  filename: "folder.pdf",
  metadata: JSON.stringify({ credential_scheme: "folder" }),
  folder_id: "folder-one",
  is_owner: true,
};

describe("BulkDownloadModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vaultMocks.getCredential.mockReturnValue({ type: "pin", value: "1234" });
  });

  it("keeps a cached PIN visible and editable", async () => {
    const onDownloadFile = vi.fn().mockResolvedValue({ success: true });
    render(
      <BulkDownloadModal
        files={[files[0]]}
        onDownloadFile={onDownloadFile}
        onClose={() => undefined}
      />,
    );

    const input = await screen.findByLabelText(/4-digit pin/i);
    expect(input).toHaveValue("1234");
    await userEvent.clear(input);
    await userEvent.type(input, "4321");
    await userEvent.click(screen.getByRole("button", { name: /start download/i }));

    await waitFor(() => expect(onDownloadFile).toHaveBeenCalledWith(files[0], "4321"));
  });

  it("rejects an empty batch instead of reporting that credentials are ready", () => {
    const onDownloadFile = vi.fn().mockResolvedValue({ success: true });
    render(
      <BulkDownloadModal files={[]} onDownloadFile={onDownloadFile} onClose={() => undefined} />,
    );

    expect(screen.getByRole("dialog", { name: /download 0 files/i })).toHaveAttribute(
      "aria-modal",
      "true",
    );
    expect(screen.getByText("No files selected.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /start download/i })).toBeDisabled();
    expect(screen.queryByText(/credentials ready/i)).not.toBeInTheDocument();
  });

  it("asks for a PIN when metadata declares the PIN credential scheme", async () => {
    vaultMocks.getCredential.mockReturnValue(null);
    const onDownloadFile = vi.fn().mockResolvedValue({ success: true });
    render(
      <BulkDownloadModal
        files={[metadataPinFile]}
        onDownloadFile={onDownloadFile}
        onClose={() => undefined}
      />,
    );

    const input = screen.getByLabelText(/4-digit pin/i);
    expect(input).toHaveFocus();
    expect(input).toHaveAttribute("autocomplete", "one-time-code");
    expect(screen.queryByLabelText(/file credential/i)).not.toBeInTheDocument();

    await userEvent.type(input, "2468");
    await userEvent.click(screen.getByRole("button", { name: /start download/i }));
    await waitFor(() => expect(onDownloadFile).toHaveBeenCalledWith(metadataPinFile, "2468"));
  });

  it("asks for a PIN to unlock a shared RSA file", async () => {
    vaultMocks.getCredential.mockReturnValue(null);
    const onDownloadFile = vi.fn().mockResolvedValue({ success: true });
    render(
      <BulkDownloadModal
        files={[sharedRsaFile]}
        onDownloadFile={onDownloadFile}
        onClose={() => undefined}
      />,
    );

    const input = screen.getByLabelText(/4-digit pin/i);
    expect(input).toHaveAttribute("name", "bulk-file-pin");
    expect(screen.queryByLabelText(/file credential/i)).not.toBeInTheDocument();

    await userEvent.type(input, "1357");
    await userEvent.click(screen.getByRole("button", { name: /start download/i }));
    await waitFor(() => expect(onDownloadFile).toHaveBeenCalledWith(sharedRsaFile, "1357"));
  });

  it("downloads folder-encrypted files without asking for a secret", async () => {
    vaultMocks.getCredential.mockReturnValue(null);
    const onDownloadFile = vi.fn().mockResolvedValue({ success: true });
    render(
      <BulkDownloadModal
        files={[folderFile]}
        onDownloadFile={onDownloadFile}
        onClose={() => undefined}
      />,
    );

    expect(screen.queryByLabelText(/4-digit pin/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/file credential/i)).not.toBeInTheDocument();
    expect(screen.getByText(/ready to download/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /start download/i }));
    await waitFor(() => expect(onDownloadFile).toHaveBeenCalledWith(folderFile, ""));
  });

  it("closes from the completed state without submitting the download form again", async () => {
    const onDownloadFile = vi.fn().mockResolvedValue({ success: true });
    const onClose = vi.fn();
    render(
      <BulkDownloadModal files={[files[0]]} onDownloadFile={onDownloadFile} onClose={onClose} />,
    );

    await userEvent.click(screen.getByRole("button", { name: /start download/i }));
    await screen.findByText("All downloads processed.");
    await userEvent.click(screen.getByRole("button", { name: "Done" }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onDownloadFile).toHaveBeenCalledTimes(1);
  });

  it("keeps a legacy password editable and isolated from login autofill", async () => {
    vaultMocks.getCredential.mockReturnValue({ type: "password", value: "old-secret" });
    const legacyFile: BulkDownloadFile = {
      id: "legacy",
      filename: "legacy.pdf",
      metadata: JSON.stringify({ credential_scheme: "password" }),
      is_owner: true,
    };
    const onDownloadFile = vi.fn().mockResolvedValue({ success: true });
    render(
      <BulkDownloadModal
        files={[legacyFile]}
        onDownloadFile={onDownloadFile}
        onClose={() => undefined}
      />,
    );

    const input = screen.getByLabelText(/file credential/i);
    expect(input).toHaveValue("old-secret");
    expect(input).toHaveAttribute("name", "bulk-file-credential");
    expect(input).toHaveAttribute("autocomplete", "new-password");
    await userEvent.clear(input);
    await userEvent.type(input, "new-secret");
    await userEvent.click(screen.getByRole("button", { name: /start download/i }));

    await waitFor(() => expect(onDownloadFile).toHaveBeenCalledWith(legacyFile, "new-secret"));
  });

  it("stops at the first server failure instead of cascading through the batch", async () => {
    const onDownloadFile = vi.fn().mockResolvedValue({
      success: false,
      error: "File is temporarily unavailable from storage.",
      failureKind: "storage",
    });
    render(
      <BulkDownloadModal files={files} onDownloadFile={onDownloadFile} onClose={() => undefined} />,
    );

    await userEvent.click(screen.getByRole("button", { name: /start download/i }));

    await screen.findByText("File is temporarily unavailable from storage.");
    expect(onDownloadFile).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("All downloads processed.")).not.toBeInTheDocument();
    expect(vaultMocks.clearCredential).not.toHaveBeenCalled();
  });

  it("evicts a rejected cached PIN and allows a replacement retry", async () => {
    const onDownloadFile = vi
      .fn()
      .mockResolvedValueOnce({
        success: false,
        error: "Incorrect PIN.",
        failureKind: "credential",
      })
      .mockResolvedValueOnce({ success: true });
    render(
      <BulkDownloadModal
        files={[files[0]]}
        onDownloadFile={onDownloadFile}
        onClose={() => undefined}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /start download/i }));
    await screen.findByText("Incorrect PIN.");

    expect(vaultMocks.clearCredential).toHaveBeenCalledTimes(1);
    const input = screen.getByLabelText(/4-digit pin/i);
    expect(input).toHaveValue("");

    await userEvent.type(input, "4321");
    await userEvent.click(screen.getByRole("button", { name: /retry downloads/i }));
    await waitFor(() => expect(onDownloadFile).toHaveBeenLastCalledWith(files[0], "4321"));
  });
});

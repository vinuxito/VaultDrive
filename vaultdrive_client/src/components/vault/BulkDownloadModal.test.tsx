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

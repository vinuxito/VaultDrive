import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CryptoPassportDrawer } from "./CryptoPassportDrawer";

describe("CryptoPassportDrawer", () => {
  const dummyFile = {
    id: "f-123",
    filename: "contract.pdf",
    file_size: 4096,
    created_at: "2026-09-16T12:00:00Z",
    metadata: JSON.stringify({ sha256: "abcdef1234567890abcdef1234567890" }),
    is_owner: true,
  };

  it("renders golden seal and file details", () => {
    render(<CryptoPassportDrawer file={dummyFile} onClose={vi.fn()} />);

    expect(screen.getByText("Cryptographic Passport")).toBeInTheDocument();
    expect(screen.getByText("contract.pdf")).toBeInTheDocument();
    expect(screen.getByText("Golden SHA-256 Seal")).toBeInTheDocument();
    expect(screen.getByText("abcdef1234567890abcdef1234567890")).toBeInTheDocument();
    expect(screen.getByText("AES-256-GCM")).toBeInTheDocument();
  });

  it("calls onClose when close button is clicked", async () => {
    const onClose = vi.fn();
    render(<CryptoPassportDrawer file={dummyFile} onClose={onClose} />);

    const closeBtn = screen.getByRole("button", { name: "Close passport" });
    await userEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalled();
  });
});

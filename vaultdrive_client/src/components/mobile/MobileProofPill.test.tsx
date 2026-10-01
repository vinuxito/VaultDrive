import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MobileProofPill } from "./MobileProofPill";

describe("MobileProofPill", () => {
  it("renders proof-of-life details and responds to actions", () => {
    const onClose = vi.fn();
    const onShare = vi.fn();

    render(
      <MobileProofPill
        isOpen={true}
        filename="balance_general_2026.pdf"
        filesize="1.8 MB"
        sha256="e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
        onClose={onClose}
        onShare={onShare}
      />
    );

    expect(screen.getByText("1. ¿Qué pasó? · Blindado")).toBeInTheDocument();
    expect(screen.getByText("balance_general_2026.pdf")).toBeInTheDocument();
    expect(screen.getByText("1.8 MB")).toBeInTheDocument();
    expect(screen.getByText("AES-256 verificado")).toBeInTheDocument();

    const shareBtn = screen.getByRole("button", { name: /Compartir/i });
    fireEvent.click(shareBtn);
    expect(onShare).toHaveBeenCalledTimes(1);

    const closeBtn = screen.getByRole("button", { name: /Listo/i });
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

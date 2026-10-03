import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ReciboSagradoCard } from "./ReciboSagradoCard";

describe("ReciboSagradoCard", () => {
  const sampleReceipt = {
    fileId: "file-xyz",
    filename: "Dictamen_Fiscal_2026.pdf",
    size: 1048576,
    hash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    timestamp: new Date("2026-10-03T12:00:00Z"),
  };

  it("renders receipt details with filename and Ley Tola proof statement", () => {
    const onShare = vi.fn();
    const onClose = vi.fn();

    render(
      <ReciboSagradoCard
        receipt={sampleReceipt}
        onClose={onClose}
        onShare={onShare}
      />
    );

    expect(screen.getByText("Recibo Sagrado")).toBeInTheDocument();
    expect(screen.getByText("Dictamen_Fiscal_2026.pdf")).toBeInTheDocument();
    expect(screen.getByText(/Blindado en tu chip \(AES-256-GCM\)/)).toBeInTheDocument();
    expect(screen.getByText("Compartir Enlace")).toBeInTheDocument();
  });

  it("triggers onShare with fileId when share button is clicked", () => {
    const onShare = vi.fn();
    const onClose = vi.fn();

    render(
      <ReciboSagradoCard
        receipt={sampleReceipt}
        onClose={onClose}
        onShare={onShare}
      />
    );

    fireEvent.click(screen.getByText("Compartir Enlace"));
    expect(onShare).toHaveBeenCalledWith("file-xyz");
    expect(onClose).toHaveBeenCalled();
  });

  it("returns null when receipt is null", () => {
    const { container } = render(
      <ReciboSagradoCard
        receipt={null}
        onClose={vi.fn()}
        onShare={vi.fn()}
      />
    );
    expect(container).toBeEmptyDOMElement();
  });
});

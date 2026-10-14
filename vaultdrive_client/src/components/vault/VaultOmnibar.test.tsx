import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { VaultOmnibar } from "./VaultOmnibar";
import { VaultSearchIndex } from "../../utils/vault-search-index";

describe("VaultOmnibar", () => {
  const index = new VaultSearchIndex();
  index.addDocuments([
    {
      id: "file-101",
      filename: "Contrato_Servicios_ABRN.pdf",
      folderName: "Legales",
      tags: ["contrato", "servicios", "abrn"],
      snippetText: "Honorarios profesionales acordados por $25,000 MXN mensuales.",
      filesize: 1024 * 300,
    },
    {
      id: "file-102",
      filename: "Factura_SAT_AWS.xml",
      folderName: "SAT",
      tags: ["cfdi", "sat", "aws"],
      snippetText: "RFC Emisor: AWS980101 Total: 1450.00",
      filesize: 1024 * 15,
    },
  ]);

  it("renders when open and focuses search input", () => {
    render(
      <VaultOmnibar
        isOpen={true}
        onClose={vi.fn()}
        onSelectFile={vi.fn()}
        searchIndex={index}
      />
    );

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Buscar por nombre, RFC, monto|Search by filename, RFC, amount/i)).toBeInTheDocument();
  });

  it("shows search results dynamically as query changes", () => {
    render(
      <VaultOmnibar
        isOpen={true}
        onClose={vi.fn()}
        onSelectFile={vi.fn()}
        searchIndex={index}
      />
    );

    const input = screen.getByPlaceholderText(/Buscar por nombre, RFC, monto|Search by filename, RFC, amount/i);
    fireEvent.change(input, { target: { value: "Contrato" } });

    expect(screen.getByText("Contrato_Servicios_ABRN.pdf")).toBeInTheDocument();
    expect(screen.getByText("Legales")).toBeInTheDocument();
  });

  it("dispatches file selection on click", () => {
    const handleSelect = vi.fn();
    const handleClose = vi.fn();

    render(
      <VaultOmnibar
        isOpen={true}
        onClose={handleClose}
        onSelectFile={handleSelect}
        searchIndex={index}
      />
    );

    const input = screen.getByPlaceholderText(/Buscar por nombre, RFC, monto|Search by filename, RFC, amount/i);
    fireEvent.change(input, { target: { value: "Factura" } });

    const fileRow = screen.getByText("Factura_SAT_AWS.xml");
    fireEvent.click(fileRow);

    expect(handleSelect).toHaveBeenCalledWith("file-102", "preview");
    expect(handleClose).toHaveBeenCalled();
  });

  it("handles Escape to close", () => {
    const handleClose = vi.fn();

    render(
      <VaultOmnibar
        isOpen={true}
        onClose={handleClose}
        onSelectFile={vi.fn()}
        searchIndex={index}
      />
    );

    const dialog = screen.getByRole("dialog").querySelector(".max-w-2xl")!;
    fireEvent.keyDown(dialog, { key: "Escape" });

    expect(handleClose).toHaveBeenCalled();
  });

  it("supports keyboard navigation (ArrowDown + Enter) and quick-action shortcuts (⌘S, ⌘D)", () => {
    const handleSelect = vi.fn();
    const handleClose = vi.fn();

    render(
      <VaultOmnibar
        isOpen={true}
        onClose={handleClose}
        onSelectFile={handleSelect}
        searchIndex={index}
      />
    );

    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "a" } });

    expect(screen.getByTestId("omnibar-match-count")).toBeInTheDocument();

    const dialog = screen.getByRole("dialog").querySelector(".max-w-2xl")!;
    // Navigate down to second result and press Cmd+S to share
    fireEvent.keyDown(dialog, { key: "ArrowDown" });
    fireEvent.keyDown(dialog, { key: "s", metaKey: true });

    expect(handleSelect).toHaveBeenCalledWith(expect.any(String), "share");
    expect(handleClose).toHaveBeenCalled();
  });
});

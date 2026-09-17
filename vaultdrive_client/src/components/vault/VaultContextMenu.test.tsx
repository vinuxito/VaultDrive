import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { VaultContextMenu } from "./VaultContextMenu";

describe("VaultContextMenu", () => {
  const mockFile = { id: "f-1", name: "financial_report.pdf", is_starred: false };

  it("renders file actions and calls onDownload when clicked", async () => {
    const onDownload = vi.fn();
    const onClose = vi.fn();

    render(
      <VaultContextMenu
        state={{
          isOpen: true,
          x: 100,
          y: 200,
          targetType: "file",
          targetData: mockFile,
        }}
        onClose={onClose}
        onDownload={onDownload}
      />
    );

    expect(screen.getByText("financial_report.pdf")).toBeInTheDocument();
    const downloadBtn = screen.getByText("Descargar");
    expect(downloadBtn).toBeInTheDocument();

    await userEvent.click(downloadBtn);
    expect(onDownload).toHaveBeenCalledWith(mockFile);
    expect(onClose).toHaveBeenCalled();
  });

  it("renders multi-file actions for batch selection", async () => {
    const onBatchDownload = vi.fn();
    const onClose = vi.fn();
    const mockFiles = [mockFile, { id: "f-2", name: "contract.pdf" }];

    render(
      <VaultContextMenu
        state={{
          isOpen: true,
          x: 50,
          y: 50,
          targetType: "multi-file",
          targetData: mockFiles,
        }}
        onClose={onClose}
        onBatchDownload={onBatchDownload}
      />
    );

    expect(screen.getByText("2 archivos seleccionados")).toBeInTheDocument();
    const batchBtn = screen.getByText("Descargar Lote (Zip)");
    expect(batchBtn).toBeInTheDocument();

    await userEvent.click(batchBtn);
    expect(onBatchDownload).toHaveBeenCalledWith(mockFiles);
  });

  it("dismisses on Escape key", () => {
    const onClose = vi.fn();

    render(
      <VaultContextMenu
        state={{
          isOpen: true,
          x: 100,
          y: 200,
          targetType: "canvas",
        }}
        onClose={onClose}
      />
    );

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });
});

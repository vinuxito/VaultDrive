import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MobileFolderSheet } from "./MobileFolderSheet";

describe("MobileFolderSheet", () => {
  const folders = [
    { id: "f1", name: "Facturas 2026", parentId: null },
    { id: "f2", name: "Contratos Legales", parentId: null },
  ];

  it("renders folders list with counts when open", () => {
    const onSelectFolder = vi.fn();
    const onClose = vi.fn();

    render(
      <MobileFolderSheet
        isOpen={true}
        onClose={onClose}
        folders={folders}
        fileCountsByFolderId={{ f1: 5, f2: 12 }}
        allFilesCount={17}
        onSelectRoot={vi.fn()}
        onSelectStarred={vi.fn()}
        onSelectShared={vi.fn()}
        onSelectFolder={onSelectFolder}
        onCreateFolder={vi.fn()}
      />
    );

    expect(screen.getByText("Explorador de Bóveda")).toBeInTheDocument();
    expect(screen.getByText("Facturas 2026")).toBeInTheDocument();
    expect(screen.getByText("5 archivos")).toBeInTheDocument();
    expect(screen.getByText("Contratos Legales")).toBeInTheDocument();
    expect(screen.getByText("12 archivos")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Facturas 2026"));
    expect(onSelectFolder).toHaveBeenCalledWith("f1", "Facturas 2026");
    expect(onClose).toHaveBeenCalled();
  });
});

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

  it("renders indented subfolders and dispatches 1-tap Compartir and Pedir Drop without navigating", () => {
    const onSelectFolder = vi.fn();
    const onShareFolder = vi.fn();
    const onClose = vi.fn();

    const treeFolders = [
      { id: "f-root", name: "Expedientes Fiscales 2026", parentId: null },
      { id: "f-empty", name: "Auditoría Externa Q4", parentId: null },
      { id: "f-sub", name: "SAT Declaraciones Anuales", parentId: "f-root" },
    ];

    render(
      <MobileFolderSheet
        isOpen={true}
        onClose={onClose}
        folders={treeFolders}
        currentFolderId="f-root"
        fileCountsByFolderId={{ "f-root": 8, "f-sub": 3, "f-empty": 0 }}
        dropFolderIds={["f-root"]}
        allFilesCount={11}
        onSelectRoot={vi.fn()}
        onSelectStarred={vi.fn()}
        onSelectShared={vi.fn()}
        onSelectFolder={onSelectFolder}
        onCreateFolder={vi.fn()}
        onShareFolder={onShareFolder}
      />
    );

    // Subfolder row is indented under its parent
    const subRow = screen.getByTestId("mobile-folder-row-f-sub");
    expect(subRow.className).toContain("ml-4");
    expect(subRow.className).toContain("border-dashed");

    // Non-empty folder triggers 1-tap #key link share without navigating
    fireEvent.click(screen.getByTestId("mobile-folder-row-share-f-sub"));
    expect(onShareFolder).toHaveBeenCalledWith("f-sub", "SAT Declaraciones Anuales", "link");
    expect(onSelectFolder).not.toHaveBeenCalled();

    // Empty folder shows Zero Dead-End Pedir Drop pill
    fireEvent.click(screen.getByTestId("mobile-folder-row-ask-drop-f-empty"));
    expect(onShareFolder).toHaveBeenCalledWith("f-empty", "Auditoría Externa Q4", "drop");

    // Sticky Zone 3 dock shares current folder
    fireEvent.click(screen.getByTestId("mobile-folder-dock-share-current"));
    expect(onShareFolder).toHaveBeenCalledWith("f-root", "Expedientes Fiscales 2026", "link");
  });
});

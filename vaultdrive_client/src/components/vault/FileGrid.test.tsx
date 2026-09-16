import { createRef } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { FileGrid } from "./FileGrid";

describe("FileGrid action labels", () => {
  it("uses translated accessible names for file selection and owner actions", () => {
    render(
      <FileGrid
        files={[{
          id: "file-1",
          filename: "invoice.pdf",
          file_size: 120,
          created_at: "2026-09-16T00:00:00Z",
          metadata: "{}",
          is_owner: true,
        }]}
        selectedFileIds={new Set()}
        toggleFileSelection={vi.fn()}
        toggleSelectAllVisible={vi.fn()}
        allVisibleSelected={false}
        headerCheckboxRef={createRef<HTMLInputElement>()}
        onDownload={vi.fn()}
        onCreateShareLink={vi.fn()}
        onToggleStar={vi.fn()}
        onAccessPanel={vi.fn()}
        onShareClick={vi.fn()}
        onQuickShare={vi.fn()}
        onManageSharesClick={vi.fn()}
        onMoveClick={vi.fn()}
        onDeleteClick={vi.fn()}
        onPreviewClick={vi.fn()}
        onContextMenu={vi.fn()}
        setOpenActionMenu={vi.fn()}
        openActionMenu={null}
        onOpenReceipt={vi.fn()}
      />,
    );

    expect(screen.getByRole("checkbox", { name: "Select invoice.pdf" })).toBeInTheDocument();
    expect(screen.getByTitle("Download")).toBeInTheDocument();
    expect(screen.getByTitle("Quick Share")).toBeInTheDocument();
    expect(screen.getByTitle("Manage shares")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "File actions for invoice.pdf" })).toBeInTheDocument();
  });

  it("renders row with cursor-pointer and triggers onPreviewClick on row click", () => {
    const onPreviewClick = vi.fn();
    const { container } = render(
      <FileGrid
        files={[{
          id: "file-2",
          filename: "secret_report.docx",
          file_size: 2048,
          created_at: "2026-09-16T00:00:00Z",
          metadata: "{}",
          is_owner: true,
        }]}
        selectedFileIds={new Set()}
        toggleFileSelection={vi.fn()}
        toggleSelectAllVisible={vi.fn()}
        allVisibleSelected={false}
        headerCheckboxRef={createRef<HTMLInputElement>()}
        onDownload={vi.fn()}
        onCreateShareLink={vi.fn()}
        onToggleStar={vi.fn()}
        onAccessPanel={vi.fn()}
        onShareClick={vi.fn()}
        onQuickShare={vi.fn()}
        onManageSharesClick={vi.fn()}
        onMoveClick={vi.fn()}
        onDeleteClick={vi.fn()}
        onPreviewClick={onPreviewClick}
        onContextMenu={vi.fn()}
        setOpenActionMenu={vi.fn()}
        openActionMenu={null}
        onOpenReceipt={vi.fn()}
      />,
    );

    const row = container.querySelector("#file-row-file-2");
    expect(row).not.toBeNull();
    expect(row).toHaveClass("cursor-pointer", "select-none");

    if (row) {
      (row as HTMLElement).click();
      expect(onPreviewClick).toHaveBeenCalledTimes(1);
    }
  });

  it("calls onSort when clicking column headers", () => {
    const onSort = vi.fn();
    render(
      <FileGrid
        files={[]}
        selectedFileIds={new Set()}
        toggleFileSelection={vi.fn()}
        toggleSelectAllVisible={vi.fn()}
        allVisibleSelected={false}
        headerCheckboxRef={createRef<HTMLInputElement>()}
        onDownload={vi.fn()}
        onCreateShareLink={vi.fn()}
        onToggleStar={vi.fn()}
        onAccessPanel={vi.fn()}
        onShareClick={vi.fn()}
        onQuickShare={vi.fn()}
        onManageSharesClick={vi.fn()}
        onMoveClick={vi.fn()}
        onDeleteClick={vi.fn()}
        onPreviewClick={vi.fn()}
        onContextMenu={vi.fn()}
        setOpenActionMenu={vi.fn()}
        openActionMenu={null}
        onOpenReceipt={vi.fn()}
        onSort={onSort}
        sortBy="name"
        sortAsc={true}
      />,
    );

    const nameBtn = screen.getByRole("button", { name: /name/i });
    nameBtn.click();
    expect(onSort).toHaveBeenCalledWith("name");
  });
});

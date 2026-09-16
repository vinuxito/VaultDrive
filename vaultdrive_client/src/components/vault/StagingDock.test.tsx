import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { StagingDock } from "./StagingDock";

describe("StagingDock", () => {
  const dummyFiles = [
    { id: "1", filename: "doc1.pdf", file_size: 1024, created_at: "", metadata: "" },
    { id: "2", filename: "doc2.zip", file_size: 2048, created_at: "", metadata: "" },
  ];

  it("renders count and total size when files are docked", () => {
    render(
      <StagingDock
        dockedFiles={dummyFiles}
        onClearDock={vi.fn()}
        onBatchDownload={vi.fn()}
      />
    );

    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("Staged for Action")).toBeInTheDocument();
    expect(screen.getByText(/3 KB/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /batch download/i })).toBeInTheDocument();
  });

  it("does not render when dockedFiles is empty", () => {
    const { container } = render(
      <StagingDock
        dockedFiles={[]}
        onClearDock={vi.fn()}
        onBatchDownload={vi.fn()}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it("triggers onBatchDownload on button click", async () => {
    const onBatchDownload = vi.fn();
    render(
      <StagingDock
        dockedFiles={dummyFiles}
        onClearDock={vi.fn()}
        onBatchDownload={onBatchDownload}
      />
    );

    await userEvent.click(screen.getByRole("button", { name: /batch download/i }));
    expect(onBatchDownload).toHaveBeenCalledWith(dummyFiles);
  });
});

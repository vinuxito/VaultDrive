import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { FileVersionsModal } from "./file-versions-modal";

const apiMocks = vi.hoisted(() => ({
  getFileVersions: vi.fn(),
  restoreFileVersion: vi.fn(),
}));

vi.mock("../../utils/api", () => apiMocks);
vi.mock("../../context/ToastContext", () => ({
  useToast: () => ({ addToast: vi.fn() }),
}));
vi.mock("../elegant", () => ({
  ElegantModal: ({ isOpen, children }: { isOpen: boolean; children: React.ReactNode }) =>
    isOpen ? <div>{children}</div> : null,
}));

describe("FileVersionsModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("starts a clean load when the same file is reopened after an error", async () => {
    apiMocks.getFileVersions
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce([
        { id: "version-2", version_number: 2, file_size: 12, created_at: "2026-09-14T00:00:00Z" },
      ]);
    const props = {
      onClose: vi.fn(),
      fileId: "file-1",
      filename: "report.pdf",
      token: "token-1",
    };
    const { rerender } = render(<FileVersionsModal {...props} isOpen />);
    expect(await screen.findByText("Failed to load file versions")).toBeInTheDocument();

    rerender(<FileVersionsModal {...props} isOpen={false} />);
    rerender(<FileVersionsModal {...props} isOpen />);

    expect(screen.getByText("Loading versions...")).toBeInTheDocument();
    expect(await screen.findByText("Version 2")).toBeInTheDocument();
    expect(screen.queryByText("Failed to load file versions")).not.toBeInTheDocument();
  });

  it("resets loading content when the file changes while open", async () => {
    apiMocks.getFileVersions
      .mockResolvedValueOnce([
        { id: "version-1", version_number: 1, file_size: 10, created_at: "2026-09-14T00:00:00Z" },
      ])
      .mockResolvedValueOnce([
        { id: "version-3", version_number: 3, file_size: 30, created_at: "2026-09-14T00:00:00Z" },
      ]);
    const props = { onClose: vi.fn(), filename: "report.pdf", token: "token-1", isOpen: true };
    const { rerender } = render(<FileVersionsModal {...props} fileId="file-1" />);
    expect(await screen.findByText("Version 1")).toBeInTheDocument();

    rerender(<FileVersionsModal {...props} fileId="file-2" />);

    expect(screen.getByText("Loading versions...")).toBeInTheDocument();
    expect(await screen.findByText("Version 3")).toBeInTheDocument();
    expect(screen.queryByText("Version 1")).not.toBeInTheDocument();
  });
});

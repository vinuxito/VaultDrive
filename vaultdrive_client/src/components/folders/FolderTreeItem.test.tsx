import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { FolderTreeItem } from "./FolderTreeItem";

const baseProps = {
  level: 0,
  active: false,
  showActions: true,
  variant: "sidebar" as const,
  onToggleExpand: vi.fn(),
  onNavigate: vi.fn(),
  onRename: vi.fn(),
  onDelete: vi.fn(),
  onCreateSubfolder: vi.fn(),
};

describe("FolderTreeItem", () => {
  it("shows Create Upload Link instead of Share Folder for empty folders", async () => {
    render(
      <FolderTreeItem
        {...baseProps}
        folder={{ id: "folder-1", name: "Inbox", parentId: null, children: [], fileCount: 0, isExpanded: false }}
        onShare={vi.fn()}
        onCollectUploads={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /folder actions for inbox/i }));

    expect(screen.getByRole("button", { name: /create upload link/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /share folder/i })).not.toBeInTheDocument();
  });

  it("keeps Share Folder for folders that already contain files", async () => {
    render(
      <FolderTreeItem
        {...baseProps}
        folder={{ id: "folder-1", name: "Inbox", parentId: null, children: [], fileCount: 2, isExpanded: false }}
        onShare={vi.fn()}
        onCollectUploads={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /folder actions for inbox/i }));

    expect(screen.getByRole("button", { name: /share folder/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /create upload link/i })).not.toBeInTheDocument();
  });
});

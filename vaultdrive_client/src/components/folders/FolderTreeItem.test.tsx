import { render, screen, fireEvent } from "@testing-library/react";
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

  it("fires onContextMenu when right-clicked", () => {
    const onContextMenu = vi.fn();
    const folder = { id: "folder-1", name: "Inbox", parentId: null, children: [], fileCount: 0, isExpanded: false };

    render(
      <FolderTreeItem
        {...baseProps}
        folder={folder}
        onContextMenu={onContextMenu}
      />
    );

    const folderEl = screen.getByText("Inbox").closest("div");
    expect(folderEl).not.toBeNull();
    fireEvent.contextMenu(folderEl!);
    expect(onContextMenu).toHaveBeenCalledWith(expect.anything(), folder);
  });

  it("does not trigger onNavigate when opening folder actions or selecting an action", async () => {
    const onNavigate = vi.fn();
    const onCreateSubfolder = vi.fn();
    const onRename = vi.fn();

    render(
      <FolderTreeItem
        {...baseProps}
        onNavigate={onNavigate}
        onCreateSubfolder={onCreateSubfolder}
        onRename={onRename}
        folder={{ id: "folder-1", name: "Inbox", parentId: null, children: [], fileCount: 0, isExpanded: false }}
      />
    );

    // 1. Open actions menu
    await userEvent.click(screen.getByRole("button", { name: /folder actions for inbox/i }));
    expect(onNavigate).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /create subfolder/i })).toBeInTheDocument();

    // 2. Click Create Subfolder
    await userEvent.click(screen.getByRole("button", { name: /create subfolder/i }));
    expect(onCreateSubfolder).toHaveBeenCalledTimes(1);
    expect(onNavigate).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: /create subfolder/i })).not.toBeInTheDocument();
  });

  it("dismisses menu on Escape without calling onNavigate", async () => {
    const onNavigate = vi.fn();

    render(
      <FolderTreeItem
        {...baseProps}
        onNavigate={onNavigate}
        folder={{ id: "folder-1", name: "Inbox", parentId: null, children: [], fileCount: 0, isExpanded: false }}
      />
    );

    await userEvent.click(screen.getByRole("button", { name: /folder actions for inbox/i }));
    expect(screen.getByRole("button", { name: /create subfolder/i })).toBeInTheDocument();

    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("button", { name: /create subfolder/i })).not.toBeInTheDocument();
    expect(onNavigate).not.toHaveBeenCalled();
  });
});

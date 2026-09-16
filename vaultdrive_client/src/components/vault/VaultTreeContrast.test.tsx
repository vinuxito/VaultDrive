import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { VaultTree } from "./VaultTree";

describe("VaultTree contrast", () => {
  it("uses foreground text for the selected quick-access item and count", () => {
    render(
      <VaultTree
        selected={{ type: "all" }}
        onSelect={vi.fn()}
        folders={[]}
        dropTokens={[]}
        allFilesCount={119}
        starredCount={0}
        sharedCount={0}
      />,
    );

    const selectedItem = screen.getByText("All Files").closest("button");
    expect(selectedItem).not.toBeNull();
    if (!selectedItem) return;
    expect(selectedItem).toHaveClass("bg-primary/10", "text-foreground");
    expect(selectedItem).toHaveAttribute("aria-current", "page");
    expect(within(selectedItem).getByText("119")).toHaveClass("bg-primary/15", "text-foreground");
  });

  it("names the tree and exposes collapsible section state", async () => {
    render(
      <VaultTree
        selected={{ type: "all" }}
        onSelect={vi.fn()}
        folders={[]}
        dropTokens={[]}
        allFilesCount={1}
        starredCount={0}
        sharedCount={0}
      />,
    );

    expect(screen.getByRole("navigation", { name: "Vault navigation" })).toBeInTheDocument();
    const folders = screen.getByRole("button", { name: "My folders" });
    expect(folders).toHaveAttribute("aria-expanded", "true");
    await userEvent.click(folders);
    expect(folders).toHaveAttribute("aria-expanded", "false");
  });
});

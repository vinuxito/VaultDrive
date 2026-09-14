import { render, screen, within } from "@testing-library/react";
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
    expect(within(selectedItem).getByText("119")).toHaveClass("bg-primary/15", "text-foreground");
  });
});

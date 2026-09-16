import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { FileSearch } from "./FileSearch";

describe("FileSearch", () => {
  it("names search controls and exposes the selected file type", async () => {
    const setSearchQuery = vi.fn();
    const setTypeFilter = vi.fn();
    render(
      <FileSearch
        searchQuery="invoice"
        setSearchQuery={setSearchQuery}
        typeFilter="documents"
        setTypeFilter={setTypeFilter}
      />,
    );

    expect(screen.getByRole("searchbox", { name: "Search all files…" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Documents" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Images" })).toHaveAttribute("aria-pressed", "false");
    await userEvent.click(screen.getByRole("button", { name: "Clear search" }));
    expect(setSearchQuery).toHaveBeenCalledWith("");
  });
});

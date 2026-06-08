import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { FolderActionEntryPanel } from "./FolderActionEntryPanel";

describe("FolderActionEntryPanel", () => {
  it("renders the distinct folder actions with exact labels and helper text", async () => {
    const handleGenerateUploadLink = vi.fn();
    const handleShareFolder = vi.fn();

    render(
      <FolderActionEntryPanel
        folderName="Client Intake"
        onGenerateUploadLink={handleGenerateUploadLink}
        onShareFolder={handleShareFolder}
      />,
    );

    expect(screen.getByRole("button", { name: /generate upload link/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /share folder/i })).toBeInTheDocument();
    expect(screen.getByText(/collect inbound uploads into this folder/i)).toBeInTheDocument();
    expect(screen.getByText(/share this folder outward so people can view what is already here/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /generate upload link/i }));
    await userEvent.click(screen.getByRole("button", { name: /share folder/i }));

    expect(handleGenerateUploadLink).toHaveBeenCalledTimes(1);
    expect(handleShareFolder).toHaveBeenCalledTimes(1);
  });

  it("disables Share Folder when the selected folder is empty", () => {
    render(
      <FolderActionEntryPanel
        folderName="Client Intake"
        canShareFolder={false}
        onGenerateUploadLink={vi.fn()}
        onShareFolder={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: /share folder/i })).toBeDisabled();
    expect(screen.getByText(/unlocks after this folder already contains files/i)).toBeInTheDocument();
  });
});

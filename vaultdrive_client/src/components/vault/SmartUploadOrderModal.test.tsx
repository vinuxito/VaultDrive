import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SmartUploadOrderModal } from "./SmartUploadOrderModal";

describe("SmartUploadOrderModal", () => {
  it("does not render when closed", () => {
    render(
      <SmartUploadOrderModal
        isOpen={false}
        onClose={vi.fn()}
        activeFolderName="Grupo Roche SA de CV"
        onCommitUpload={vi.fn()}
      />
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("loads sample chaotic accountant files, maps them to clean names & subfolders, and commits upload", async () => {
    const onClose = vi.fn();
    const onCommitUpload = vi.fn().mockResolvedValue(undefined);

    render(
      <SmartUploadOrderModal
        isOpen={true}
        onClose={onClose}
        activeFolderName="Grupo Roche SA de CV"
        onCommitUpload={onCommitUpload}
      />
    );

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText(/Grupo Roche SA de CV/i)).toBeInTheDocument();

    const loadSampleBtn = screen.getByTestId("smart-upload-load-sample-btn");
    await userEvent.click(loadSampleBtn);

    const commitBtn = await screen.findByTestId("smart-upload-commit-btn");
    expect(commitBtn).toHaveTextContent(/Cifrar y Guardar \(4\)/i);

    // Verify chaotic original names and editable clean outputs are rendered
    expect(screen.getByText("scan_0019_final(2).pdf")).toBeInTheDocument();
    expect(screen.getByText("a89f22c1-77b4-40e2.xml")).toBeInTheDocument();

    await userEvent.click(commitBtn);

    expect(onCommitUpload).toHaveBeenCalledTimes(1);
    const stagedArg = onCommitUpload.mock.calls[0][0];
    expect(stagedArg).toHaveLength(4);
    expect(stagedArg[0].targetSubfolderName).toBe("02 Constancia y 32-D");
    expect(stagedArg[1].targetSubfolderName).toBe("04 Facturas XML");
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

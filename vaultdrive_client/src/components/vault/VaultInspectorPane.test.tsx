import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { VaultInspectorPane } from "./VaultInspectorPane";

describe("VaultInspectorPane", () => {
  const sampleFile = {
    id: "file-abrn-1",
    filename: "Arquitectura_Zero_Knowledge_v4.pdf",
    file_size: 2516582,
    created_at: "2026-11-04T00:00:00Z",
    metadata: "{}",
    is_owner: true,
    parent_hash: "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
  };

  it("renders the active file title, cryptographic lineage, and switches across all 5 preview formats", async () => {
    const onExpand = vi.fn();
    const onCopyHash = vi.fn();
    const onDownload = vi.fn();

    render(
      <VaultInspectorPane
        file={sampleFile}
        onExpandCinemascope={onExpand}
        onCopyHash={onCopyHash}
        onDownload={onDownload}
      />
    );

    expect(screen.getByTestId("vault-inspector-pane")).toBeInTheDocument();
    expect(screen.getAllByText("Arquitectura_Zero_Knowledge_v4.pdf").length).toBeGreaterThan(0);
    expect(screen.getByText(/AES-256-GCM · 0 bytes en claro/i)).toBeInTheDocument();

    // Switch to 4K Image tab and rotate
    await userEvent.click(screen.getByTestId("inspector-tab-image"));
    expect(screen.getByText(/Rotación 0°/i)).toBeInTheDocument();
    await userEvent.click(screen.getByTestId("inspector-rotate-btn"));
    expect(screen.getByText(/Rotación 90°/i)).toBeInTheDocument();

    // Switch to 64KB Video tab and toggle playback
    await userEvent.click(screen.getByTestId("inspector-tab-video"));
    expect(screen.getByText(/STREAMING RAM · 64 KB CHUNKS/i)).toBeInTheDocument();
    await userEvent.click(screen.getByTestId("inspector-video-toggle"));
    expect(screen.getByText(/Reproduciendo stream AES-GCM en RAM/i)).toBeInTheDocument();

    // Switch to XLSX Spreadsheet tab and click row
    await userEvent.click(screen.getByTestId("inspector-tab-sheet"));
    expect(screen.getByTestId("inspector-sheet-cell")).toHaveTextContent("C2");
    await userEvent.click(screen.getByTestId("inspector-sheet-row-2"));
    expect(screen.getByTestId("inspector-sheet-cell")).toHaveTextContent("C4");

    // Copy SHA-256 and Expand 94vw
    await userEvent.click(screen.getByTestId("inspector-copy-sha-btn"));
    expect(onCopyHash).toHaveBeenCalledOnce();

    await userEvent.click(screen.getByTestId("inspector-expand-94vw"));
    expect(onExpand).toHaveBeenCalledWith(sampleFile);

    await userEvent.click(screen.getByTestId("inspector-download-btn"));
    expect(onDownload).toHaveBeenCalledWith(sampleFile);
  });

  it("creates, edits, persists, and deletes a real Nota rápida without fake audio theater", async () => {
    window.localStorage.clear();

    const { container } = render(<VaultInspectorPane file={sampleFile} />);
    expect(container.textContent).not.toMatch(/94vw/i);
    expect(screen.getByText(/Pantalla completa/i)).toBeInTheDocument();
    expect(screen.getByText(/Sin notas en este archivo/i)).toBeInTheDocument();

    await userEvent.click(screen.getByTestId("inspector-voice-record-btn"));
    const input = screen.getByTestId("inspector-note-input");
    await userEvent.type(input, "Cuadrado con estado de cuenta BBVA Nov 2026");
    await userEvent.click(screen.getByTestId("inspector-note-save-btn"));

    expect(screen.getByTestId("inspector-saved-note-text")).toHaveTextContent(
      "Cuadrado con estado de cuenta BBVA Nov 2026"
    );

    await userEvent.click(screen.getByTestId("inspector-note-edit-btn"));
    const editInput = screen.getByTestId("inspector-note-input");
    await userEvent.clear(editInput);
    await userEvent.type(editInput, "Nota actualizada por contador");
    await userEvent.click(screen.getByTestId("inspector-note-save-btn"));

    expect(screen.getByTestId("inspector-saved-note-text")).toHaveTextContent(
      "Nota actualizada por contador"
    );

    await userEvent.click(screen.getByTestId("inspector-note-delete-btn"));
    expect(screen.queryByTestId("inspector-saved-note-text")).toBeNull();
    expect(screen.getByText(/Sin notas en este archivo/i)).toBeInTheDocument();
  });
});

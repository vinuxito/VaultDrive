import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MobileInspectorSheet } from "./MobileInspectorSheet";
import type { FileData } from "../vault/FileGrid";

describe("MobileInspectorSheet", () => {
  const sampleFile: FileData = {
    id: "file-cfdi-1",
    filename: "CFDI_Honorarios_Nov2026.xml",
    file_size: 43008,
    created_at: "2026-11-12T10:00:00Z",
    metadata: JSON.stringify({ sha256: "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b" }),
    is_owner: true,
  };

  it("auto-selects format tab from filename, switches across all 5 RAM formats, and triggers dock actions", () => {
    const onClose = vi.fn();
    const onOpenFullPreview = vi.fn();
    const onWhatsAppShare = vi.fn();
    const onDownload = vi.fn();

    render(
      <MobileInspectorSheet
        isOpen={true}
        file={sampleFile}
        folderName="Expedientes Fiscales 2026"
        onClose={onClose}
        onOpenFullPreview={onOpenFullPreview}
        onWhatsAppShare={onWhatsAppShare}
        onDownload={onDownload}
      />,
    );

    // .xml auto-selects CFDI ("code") tab
    expect(screen.getByTestId("mobile-inspector-stage-code")).toBeInTheDocument();
    expect(screen.getByText(/Recibo Sagrado · SHA-256 · 0 B Delta/)).toBeInTheDocument();

    // Switch through PDF, 4K, MP4, XLSX tabs
    fireEvent.click(screen.getByTestId("mobile-inspector-tab-pdf"));
    expect(screen.getByTestId("mobile-inspector-stage-pdf")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("mobile-inspector-tab-image"));
    expect(screen.getByTestId("mobile-inspector-stage-image")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("mobile-inspector-tab-video"));
    expect(screen.getByTestId("mobile-inspector-stage-video")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("mobile-inspector-tab-sheet"));
    expect(screen.getByTestId("mobile-inspector-stage-sheet")).toBeInTheDocument();

    // Full streaming preview button
    fireEvent.click(screen.getByTestId("mobile-inspector-open-full"));
    expect(onOpenFullPreview).toHaveBeenCalledWith(sampleFile);

    // Sticky dock WhatsApp and Download buttons
    fireEvent.click(screen.getByTestId("mobile-inspector-whatsapp-btn"));
    expect(onWhatsAppShare).toHaveBeenCalledWith(sampleFile);

    fireEvent.click(screen.getByTestId("mobile-inspector-download-btn"));
    expect(onDownload).toHaveBeenCalledWith(sampleFile);
  });
});

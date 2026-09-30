import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QuickShareReceipt } from "./quick-share-receipt";

describe("QuickShareReceipt component", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renders filename and copy confirmation", () => {
    render(
      <QuickShareReceipt
        filename="Contrato_Final.pdf"
        shareUrl="https://abrndrive.filemonprime.net/abrn/#/public/share/token#key=123"
        onDismiss={vi.fn()}
      />
    );

    expect(screen.getByText("¡Enlace protegido copiado!")).toBeDefined();
    expect(screen.getByText("Contrato_Final.pdf")).toBeDefined();
    expect(screen.getByText("Enviar por WhatsApp")).toBeDefined();
  });

  it("opens WhatsApp intent with encoded message when WhatsApp button is clicked", () => {
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);

    render(
      <QuickShareReceipt
        filename="Balance.xlsx"
        shareUrl="https://example.com/share#key=abc"
        onDismiss={vi.fn()}
      />
    );

    fireEvent.click(screen.getByText("Enviar por WhatsApp"));

    expect(openSpy).toHaveBeenCalledWith(
      expect.stringContaining("https://api.whatsapp.com/send?text="),
      "_blank",
      "noopener,noreferrer"
    );
  });

  it("calls onDismiss when close button is clicked", () => {
    const handleDismiss = vi.fn();
    render(
      <QuickShareReceipt
        filename="Reporte.pdf"
        shareUrl="https://example.com/share"
        onDismiss={handleDismiss}
      />
    );

    fireEvent.click(screen.getByLabelText("Cerrar recibo"));
    expect(handleDismiss).toHaveBeenCalledTimes(1);
  });

  it("displays manual copy fallback when clipboard fails", async () => {
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockRejectedValue(new Error("Permission denied")),
      },
    });

    render(
      <QuickShareReceipt
        filename="Reporte.pdf"
        shareUrl="https://example.com/share#key=safe"
        onDismiss={vi.fn()}
      />
    );

    const copyBtn = screen.getByTitle("Copiar de nuevo");
    fireEvent.click(copyBtn);

    await waitFor(() => {
      expect(
        screen.getByText("Selecciona y copia la liga directamente:")
      ).toBeDefined();
    });
  });
});

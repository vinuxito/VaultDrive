import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MobileReconcileSheet } from "./MobileReconcileSheet";
import type { FileData } from "../vault/FileGrid";

describe("MobileReconcileSheet", () => {
  it("never shows false $0.00 or raw enum codes when CFDI or bank files are absent", async () => {
    const onOpenUpload = vi.fn();
    const { container } = render(
      <MobileReconcileSheet
        open={true}
        onClose={vi.fn()}
        files={[]}
        clientName="Grupo Roche SA de CV"
        onOpenUpload={onOpenUpload}
      />
    );

    expect(screen.getByTestId("mobile-reconcile-not-evaluable")).toBeInTheDocument();
    expect(screen.getByText(/Faltan facturas XML o el estado de cuenta/i)).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/SIN_CFDI_EN_CARPETA/);
    expect(container.textContent).not.toMatch(/NOT_EVALUABLE/);
    expect(screen.queryByTestId("mobile-reconcile-delta-card")).not.toBeInTheDocument();

    await userEvent.click(screen.getByTestId("mobile-reconcile-upload-btn"));
    expect(onOpenUpload).toHaveBeenCalledOnce();
  });

  it("computes exact $0.00 MXN delta when CFDI 4.0 XMLs match BBVA bank statement", async () => {
    const onShareWhatsApp = vi.fn();
    const seededFiles: FileData[] = [
      {
        id: "cfdi-1",
        filename: "2026-11_CFDI_Reactivos_$245,000.00.xml",
        file_size: 4200,
        created_at: "2026-11-14T10:00:00Z",
        metadata: "{}",
        is_owner: true,
      },
      {
        id: "cfdi-2",
        filename: "2026-11_CFDI_Logistica_$124,700.00.xml",
        file_size: 4100,
        created_at: "2026-11-14T10:01:00Z",
        metadata: "{}",
        is_owner: true,
      },
      {
        id: "cfdi-3",
        filename: "2026-11_CFDI_Honorarios_$48,500.00.xml",
        file_size: 3980,
        created_at: "2026-11-14T10:02:00Z",
        metadata: "{}",
        is_owner: true,
      },
      {
        id: "bbva-1",
        filename: "BBVA_Estado_de_Cuenta_Nov2026_$418,200.00.pdf",
        file_size: 128400,
        created_at: "2026-11-14T10:03:00Z",
        metadata: "{}",
        is_owner: true,
      },
    ];

    render(
      <MobileReconcileSheet
        open={true}
        onClose={vi.fn()}
        files={seededFiles}
        clientName="Grupo Roche SA de CV"
        onShareWhatsApp={onShareWhatsApp}
      />
    );

    expect(screen.getByTestId("mobile-reconcile-delta-card")).toHaveTextContent("$0.00");
    expect(screen.getByText(/100% amarrado · Diferencia \$0\.00 MXN/i)).toBeInTheDocument();

    await userEvent.click(screen.getByTestId("mobile-reconcile-wa-btn"));
    expect(onShareWhatsApp).toHaveBeenCalledOnce();
  });
});

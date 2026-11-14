import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  VaultReconcileCockpit,
  evaluateRamReconciliation,
  buildRealAccountingSeedBatch,
} from "./VaultReconcileCockpit";
import type { FileData } from "./FileGrid";

const makeFile = (id: string, filename: string): FileData => ({
  id,
  filename,
  file_size: 4096,
  created_at: "2026-11-14T12:00:00Z",
  metadata: "{}",
  parent_hash: "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
});

describe("VaultReconcileCockpit", () => {
  it("never displays false $0.00 or raw enum codes when folder has no CFDI XML or bank statement", () => {
    const { container } = render(
      <VaultReconcileCockpit files={[]} clientName="Grupo Roche SA de CV" />
    );
    expect(screen.getByTestId("reconcile-not-evaluable")).toBeTruthy();
    expect(
      screen.getByText(/Faltan facturas XML o el estado de cuenta/i)
    ).toBeTruthy();
    expect(screen.queryByTestId("reconcile-delta-total")).toBeNull();
    expect(container.textContent).not.toMatch(/SIN_CFDI_EN_CARPETA/);
    expect(container.textContent).not.toMatch(/NOT_EVALUABLE/);
  });

  it("reports LOCKED status internally without false $0.00 when privacy shutter is active", () => {
    const res = evaluateRamReconciliation([makeFile("1", "a.xml")], true);
    expect(res.status).toBe("LOCKED");
    expect(res.deltaMxn).toBeNull();
  });

  it("reconciles real CFDI 4.0 XMLs against BBVA bank statement to $0.00 MXN difference", () => {
    const files: FileData[] = [
      makeFile("f1", "2026-11_CFDI_Grupo_Roche_$245,000.00.xml"),
      makeFile("f2", "2026-11_CFDI_Logistica_Bajio_$124,700.00.xml"),
      makeFile("f3", "2026-11_CFDI_Honorarios_ABRN_$48,500.00.xml"),
      makeFile("f4", "BBVA_Estado_de_Cuenta_Nov2026_$418,200.00.pdf"),
    ];
    render(<VaultReconcileCockpit files={files} clientName="Grupo Roche SA de CV" />);
    expect(screen.getByTestId("reconcile-bank-total").textContent).toBe("$418,200.00 MXN");
    expect(screen.getByTestId("reconcile-cfdi-total").textContent).toBe("$418,200.00 MXN");
    expect(screen.getByTestId("reconcile-delta-total").textContent).toBe("$0.00 MXN");
  });

  it("opens real document upload modal and keeps secondary sample batch honest", () => {
    const onOpenUpload = vi.fn();
    const onSeed = vi.fn();
    render(
      <VaultReconcileCockpit
        files={[]}
        clientName="Grupo Roche SA de CV"
        onOpenUploadModal={onOpenUpload}
        onSeedAccountingFiles={onSeed}
      />
    );
    fireEvent.click(screen.getByTestId("reconcile-upload-real-btn"));
    expect(onOpenUpload).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTestId("reconcile-seed-real-btn"));
    expect(onSeed).toHaveBeenCalledTimes(1);
    const batch = buildRealAccountingSeedBatch("Grupo Roche SA de CV");
    expect(batch).toHaveLength(4);
  });
});

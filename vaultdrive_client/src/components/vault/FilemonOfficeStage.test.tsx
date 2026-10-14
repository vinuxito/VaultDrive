import { fireEvent, render, screen } from "@testing-library/react";
import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { parseFilemonOfficeDocument } from "../../utils/filemon-office";
import { FilemonOfficeStage } from "./FilemonOfficeStage";

const SAMPLE_CFDI_XML = `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" Version="4.0" Serie="FA" Folio="8842" Fecha="2026-10-14T10:15:00" FormaPago="03" MetodoPago="PUE" Moneda="MXN" SubTotal="24525.86" Descuento="0.00" Total="28450.00" TipoDeComprobante="I" LugarExpedicion="64000">
  <cfdi:Emisor Rfc="QAB240101AAA" Nombre="QUANTIX ABRN INDUSTRIAL SA DE CV" RegimenFiscal="601" />
  <cfdi:Receptor Rfc="ROCH9001019A1" Nombre="ROCHE LOGISTICA Y AMARRE FISCAL SA DE CV" UsoCFDI="G03" RegimenFiscalReceptor="601" DomicilioFiscalReceptor="06600" />
  <cfdi:Conceptos>
    <cfdi:Concepto ClaveProdServ="80141600" Cantidad="2" ClaveUnidad="E48" Descripcion="SERVICIO DE AUDITORIA Y AMARRE FISCAL ROCHE" ValorUnitario="10000.00" Importe="20000.00" />
  </cfdi:Conceptos>
  <cfdi:Impuestos TotalImpuestosTrasladados="3924.14" TotalImpuestosRetenidos="0.00" />
  <cfdi:Complemento>
    <tfd:TimbreFiscalDigital Version="1.1" UUID="550E8400-E29B-41D4-A716-446655440000" FechaTimbrado="2026-10-14T10:15:05" RfcProvCertif="SAT970701NN3" />
  </cfdi:Complemento>
</cfdi:Comprobante>`;

function textToBuffer(text: string): ArrayBuffer {
  const bytes = new TextEncoder().encode(text);
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

describe("FilemonOfficeStage", () => {
  it("renders CFDI 4.0 Live Glass Twin and toggles between Source and Amarre Fiscal (Roche) contract", async () => {
    const doc = await parseFilemonOfficeDocument({
      id: "cfdi-1",
      filename: "CFDI_Roche_8842.xml",
      buffer: textToBuffer(SAMPLE_CFDI_XML),
      sha256: "a4f90123456789abcdef0123456789abcdef0123456789abcdef0123456789ab",
    });

    render(<FilemonOfficeStage doc={doc} />);

    // Default mode: Glass Twin
    expect(screen.getByTestId("filemon-office-cfdi-twin")).toBeInTheDocument();
    expect(screen.getByText("QUANTIX ABRN INDUSTRIAL SA DE CV")).toBeInTheDocument();
    expect(screen.getByText("ROCHE LOGISTICA Y AMARRE FISCAL SA DE CV")).toBeInTheDocument();
    expect(screen.getByText("SERVICIO DE AUDITORIA Y AMARRE FISCAL ROCHE")).toBeInTheDocument();
    expect(screen.getByText(/550E8400-E29B-41D4-A716-446655440000/)).toBeInTheDocument();

    // Switch to Amarre Fiscal (Roche) Contract view
    fireEvent.click(
      screen.getByRole("button", {
        name: /SAT \/ Amarre Fiscal|Ficha SAT/i,
      }),
    );
    expect(screen.getByTestId("filemon-office-contract-view")).toBeInTheDocument();
    expect(screen.getByText(/"target_modules"/)).toBeInTheDocument();

    // Switch to Original Source view
    fireEvent.click(
      screen.getByRole("button", { name: /Original Source|Fuente Original/i }),
    );
    expect(screen.getByTestId("filemon-office-source-view")).toBeInTheDocument();
  });

  it("renders multi-sheet XLSX workbench, switches sheets, and inspects cell formulas", async () => {
    const zip = new JSZip();
    zip.file(
      "xl/workbook.xml",
      `<workbook><sheets><sheet name="Amarre_Roche" sheetId="1"/><sheet name="Cortes_SAT" sheetId="2"/></sheets></workbook>`,
    );
    zip.file(
      "xl/worksheets/sheet1.xml",
      `<worksheet><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>Concepto</t></is></c><c r="B1" t="inlineStr"><is><t>Importe</t></is></c></row><row r="2"><c r="A2" t="inlineStr"><is><t>Flete Roche</t></is></c><c r="B2"><f>SUM(1000,500)</f><v>1500.00</v></c></row></sheetData></worksheet>`,
    );
    zip.file(
      "xl/worksheets/sheet2.xml",
      `<worksheet><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>Corte Octubre</t></is></c></row></sheetData></worksheet>`,
    );
    const buffer = await zip.generateAsync({ type: "arraybuffer" });

    const doc = await parseFilemonOfficeDocument({
      id: "xlsx-1",
      filename: "Amarre_Octubre.xlsx",
      buffer,
      sha256: "b8c90123456789abcdef0123456789abcdef0123456789abcdef0123456789ab",
    });

    render(<FilemonOfficeStage doc={doc} />);

    expect(screen.getByTestId("filemon-office-spreadsheet-workbench")).toBeInTheDocument();
    expect(screen.getByText("Flete Roche")).toBeInTheDocument();

    // Click cell B2 to inspect formula
    fireEvent.click(screen.getByText("1500.00"));
    expect(screen.getByText("Amarre_Roche!B2")).toBeInTheDocument();
    expect(screen.getByText("fx =SUM(1000,500)")).toBeInTheDocument();

    // Switch to sheet 2
    fireEvent.click(screen.getByRole("tab", { name: /Cortes_SAT/i }));
    expect(screen.getByText("Cortes_SAT!A1")).toBeInTheDocument();
    expect(screen.getAllByText("Corte Octubre").length).toBeGreaterThanOrEqual(1);
  });
});

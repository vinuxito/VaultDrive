import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import {
  buildSpreadsheetCellCitation,
  canHandleWithFilemonOffice,
  parseDelimitedText,
  parseFilemonOfficeDocument,
  parseXlsxBuffer,
} from "./filemon-office";

const SAMPLE_CFDI_40_XML = `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" Version="4.0" Serie="FA" Folio="8842" Fecha="2026-10-14T10:15:00" FormaPago="03" MetodoPago="PUE" Moneda="MXN" SubTotal="24525.86" Descuento="0.00" Total="28450.00" TipoDeComprobante="I" LugarExpedicion="64000">
  <cfdi:Emisor Rfc="QAB240101AAA" Nombre="QUANTIX ABRN INDUSTRIAL SA DE CV" RegimenFiscal="601" />
  <cfdi:Receptor Rfc="ROCH9001019A1" Nombre="ROCHE LOGISTICA Y AMARRE FISCAL SA DE CV" UsoCFDI="G03" RegimenFiscalReceptor="601" DomicilioFiscalReceptor="06600" />
  <cfdi:Conceptos>
    <cfdi:Concepto ClaveProdServ="80141600" Cantidad="2" ClaveUnidad="E48" Descripcion="SERVICIO DE AUDITORIA Y AMARRE FISCAL ROCHE" ValorUnitario="10000.00" Importe="20000.00" Descuento="0.00" />
    <cfdi:Concepto ClaveProdServ="43231500" Cantidad="1" ClaveUnidad="E48" Descripcion="LICENCIA ENTERPRISE FILEMON OFFICE" ValorUnitario="4525.86" Importe="4525.86" Descuento="0.00" />
  </cfdi:Conceptos>
  <cfdi:Impuestos TotalImpuestosTrasladados="3924.14" TotalImpuestosRetenidos="0.00" />
  <cfdi:Complemento>
    <tfd:TimbreFiscalDigital Version="1.1" UUID="550E8400-E29B-41D4-A716-446655440000" FechaTimbrado="2026-10-14T10:15:05" RfcProvCertif="SAT970701NN3" />
  </cfdi:Complemento>
</cfdi:Comprobante>`;

function textToArrayBuffer(text: string): ArrayBuffer {
  const bytes = new TextEncoder().encode(text);
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

async function buildSampleXlsxBuffer(): Promise<ArrayBuffer> {
  const zip = new JSZip();
  zip.file(
    "xl/workbook.xml",
    `<?xml version="1.0" encoding="UTF-8"?>
    <workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
      <sheets>
        <sheet name="Amarre_Roche" sheetId="1" r:id="rId1"/>
        <sheet name="Resumen_SAT" sheetId="2" r:id="rId2"/>
      </sheets>
    </workbook>`,
  );
  zip.file(
    "xl/_rels/workbook.xml.rels",
    `<?xml version="1.0" encoding="UTF-8"?>
    <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
      <Relationship Id="rId1" Target="worksheets/sheet1.xml"/>
      <Relationship Id="rId2" Target="worksheets/sheet2.xml"/>
    </Relationships>`,
  );
  zip.file(
    "xl/sharedStrings.xml",
    `<?xml version="1.0" encoding="UTF-8"?>
    <sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="4" uniqueCount="4">
      <si><t>Folio</t></si>
      <si><t>Proveedor</t></si>
      <si><t>Monto MXN</t></si>
      <si><t>QUANTIX ABRN</t></si>
    </sst>`,
  );
  zip.file(
    "xl/worksheets/sheet1.xml",
    `<?xml version="1.0" encoding="UTF-8"?>
    <worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
      <sheetData>
        <row r="1">
          <c r="A1" t="s"><v>0</v></c>
          <c r="B1" t="s"><v>1</v></c>
          <c r="C1" t="s"><v>2</v></c>
        </row>
        <row r="2">
          <c r="A2" t="inlineStr"><is><t>FA-8842</t></is></c>
          <c r="B2" t="s"><v>3</v></c>
          <c r="C2"><f>SUM(20000,8450)</f><v>28450.00</v></c>
        </row>
        <row r="3">
          <c r="A3" t="inlineStr"><is><t>FA-8843</t></is></c>
          <c r="B3" t="s"><v>3</v></c>
          <c r="C3"><f>A2*2</f></c>
        </row>
      </sheetData>
    </worksheet>`,
  );
  zip.file(
    "xl/worksheets/sheet2.xml",
    `<?xml version="1.0" encoding="UTF-8"?>
    <worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
      <sheetData>
        <row r="1">
          <c r="A1" t="inlineStr"><is><t>Estatus</t></is></c>
          <c r="B1" t="inlineStr"><is><t>Cuadrado</t></is></c>
        </row>
      </sheetData>
    </worksheet>`,
  );

  return zip.generateAsync({ type: "arraybuffer" });
}

describe("filemon-office plugin engine", () => {
  it("identifies files supported by Filemón Office", () => {
    expect(canHandleWithFilemonOffice("factura_roche.xml")).toBe(true);
    expect(canHandleWithFilemonOffice("amarre_octubre.xlsx")).toBe(true);
    expect(canHandleWithFilemonOffice("nomina.csv")).toBe(true);
    expect(canHandleWithFilemonOffice("reporte.md")).toBe(true);
    expect(canHandleWithFilemonOffice("video.mp4")).toBe(false);
  });

  it("parses CFDI 4.0 XML into Live Glass Twin invoice data and Amarre Fiscal (Roche) payload", async () => {
    const doc = await parseFilemonOfficeDocument({
      id: "doc-cfdi-1",
      filename: "CFDI_Quantix_Roche_8842.xml",
      buffer: textToArrayBuffer(SAMPLE_CFDI_40_XML),
      sha256: "a4f90123456789abcdef0123456789abcdef0123456789abcdef0123456789ab",
    });

    expect(doc.kind).toBe("cfdi_xml");
    expect(doc.badgeLabel).toBe("FILEMÓN OFFICE • CFDI 4.0");
    expect(doc.cfdi).toBeDefined();
    expect(doc.cfdi?.timbre.uuid).toBe("550E8400-E29B-41D4-A716-446655440000");
    expect(doc.cfdi?.emisor.rfc).toBe("QAB240101AAA");
    expect(doc.cfdi?.receptor.rfc).toBe("ROCH9001019A1");
    expect(doc.cfdi?.total).toBe("28450.00");
    expect(doc.cfdi?.conceptos).toHaveLength(2);
    expect(doc.notices[0]).toContain("SAT");

    const amarre = doc.cfdi?.amarreFiscalRochePayload;
    expect(amarre?.plugin).toBe("filemon-office-mx");
    expect(amarre?.host).toBe("ABRN-Drive");
    expect(amarre?.target_modules).toEqual([
      "Quantix ABRN SAT",
      "Amarre Fiscal (Roche)",
    ]);
    expect(amarre?.uuid).toBe("550E8400-E29B-41D4-A716-446655440000");
  });

  it("blocks XML with DOCTYPE / ENTITY declarations (XXE defense)", async () => {
    const xxeXml = `<?xml version="1.0"?><!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><cfdi:Comprobante>&xxe;</cfdi:Comprobante>`;
    const doc = await parseFilemonOfficeDocument({
      id: "doc-xxe",
      filename: "malicious.xml",
      buffer: textToArrayBuffer(xxeXml),
      sha256: "deadbeef",
    });

    expect(doc.kind).toBe("generic_xml");
    expect(doc.cfdi).toBeUndefined();
    expect(doc.badgeLabel).toContain("BLOQUEADO");
  });

  it("parses multi-sheet XLSX buffers in RAM with formulas and NOT_EVALUABLE protection", async () => {
    const xlsxBuffer = await buildSampleXlsxBuffer();
    const workbook = await parseXlsxBuffer(xlsxBuffer);

    expect(workbook.format).toBe("xlsx");
    expect(workbook.sheets).toHaveLength(2);
    expect(workbook.sheets[0].name).toBe("Amarre_Roche");
    expect(workbook.sheets[0].rows[0].map((c) => c.value)).toEqual(["Folio", "Proveedor", "Monto MXN"]);
    expect(workbook.sheets[0].rows[1][0].value).toBe("FA-8842");
    expect(workbook.sheets[0].rows[1][1].value).toBe("QUANTIX ABRN");
    expect(workbook.sheets[0].rows[1][2].formula).toBe("SUM(20000,8450)");
    expect(workbook.sheets[0].rows[1][2].value).toBe("28450.00");

    // Uncached formula cell must never show a false zero
    expect(workbook.sheets[0].rows[2][2].formula).toBe("A2*2");
    expect(workbook.sheets[0].rows[2][2].cacheMissing).toBe(true);
    expect(workbook.sheets[0].rows[2][2].value).toBe("NOT_EVALUABLE (sin caché de fórmula)");
  });

  it("parses RFC 4180 CSV with quoted commas and generates cell citations", () => {
    const csv = `Folio,Concepto,Monto\n"FA-01","Amarre Fiscal, Roche",14500.50\n"FA-02","Auditoría SAT",9200.00`;
    const sheet = parseDelimitedText(csv, ",");
    expect(sheet.columns).toEqual(["A", "B", "C"]);
    expect(sheet.rows[0].map((c) => c.value)).toEqual(["Folio", "Concepto", "Monto"]);
    expect(sheet.rows[1][1].value).toBe("Amarre Fiscal, Roche");

    const citation = buildSpreadsheetCellCitation(
      "amarre_roche.csv",
      "a4f90123456789abcdef",
      sheet.name,
      sheet.rows[1][1],
    );
    expect(citation).toContain("amarre_roche.csv#sha256:a4f901234567");
    expect(citation).toContain("B2");
  });
});

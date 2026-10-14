import { describe, it, expect } from "vitest";
import {
  analyzeDocumentTriage,
  triageCfdiXml,
  triageSatConstancia,
  triageContract,
  triageBankReceipt,
} from "./document-triage";

describe("document-triage", () => {
  it("detects and auto-names CFDI SAT XML", () => {
    const mockXml = `<?xml version="1.0" encoding="utf-8"?>
<cfdi:Comprobante Total="1450.00" Fecha="2026-03-15T12:00:00" TipoDeComprobante="I">
  <cfdi:Emisor Rfc="AWS980101XYZ" Nombre="AMAZON WEB SERVICES MEXICO" />
</cfdi:Comprobante>`;

    const result = triageCfdiXml(mockXml);
    expect(result).not.toBeNull();
    expect(result!.category).toBe("cfdi_sat");
    expect(result!.extractedFields.total).toBe("1450.00");
    expect(result!.extractedFields.emisorRfc).toBe("AWS980101XYZ");
    expect(result!.suggestedFilename).toContain("CFDI_Factura_AWS980101XYZ_$1450.00_2026-03-15.xml");
    expect(result!.suggestedTags).toContain("cfdi");
  });

  it("detects SAT Constancia de Situación Fiscal", () => {
    const text = "SECRETARÍA DE HACIENDA Y CRÉDITO PÚBLICO CONSTANCIA DE SITUACIÓN FISCAL RFC: ABR980101XYZ LUGAR Y FECHA DE EMISIÓN";
    const result = triageSatConstancia(text);
    expect(result).not.toBeNull();
    expect(result!.category).toBe("sat_constancia");
    expect(result!.extractedFields.rfc).toBe("ABR980101XYZ");
    expect(result!.suggestedFilename).toContain("Constancia_SAT_ABR980101XYZ");
  });

  it("detects legal contract types", () => {
    const text = "CONTRATO DE ARRENDAMIENTO QUE CELEBRAN POR UNA PARTE...";
    const result = triageContract(text, "scan_document_001.pdf");
    expect(result).not.toBeNull();
    expect(result!.category).toBe("contract_legal");
    expect(result!.extractedFields.tipoContrato).toBe("Arrendamiento");
    expect(result!.suggestedFilename).toContain("Contrato_Arrendamiento");
  });

  it("detects bank transfer receipts", () => {
    const text = "COMPROBANTE DE PAGO TRANSFERENCIA SPEI BBVA MONTO TOTAL: $8,500.00 MXN";
    const result = triageBankReceipt(text, "recibo.pdf");
    expect(result).not.toBeNull();
    expect(result!.category).toBe("bank_receipt");
    expect(result!.extractedFields.monto).toBe("8,500.00");
    expect(result!.suggestedFilename).toContain("Comprobante_SPEI_$8,500.00");
  });

  it("detects and auto-names CFDI SAT XML including UUID and Moneda regardless of attribute order", () => {
    const mockXml = `<?xml version="1.0" encoding="utf-8"?>
<cfdi:Comprobante Total="1450.00" Moneda="MXN" Fecha="2026-03-15T12:00:00" TipoDeComprobante="I">
  <cfdi:Emisor Nombre="AMAZON WEB SERVICES MEXICO" Rfc="AWS980101XYZ" />
  <cfdi:Complemento>
    <tfd:TimbreFiscalDigital UUID="8f491102-abcd-4321-9999-001122334455" />
  </cfdi:Complemento>
</cfdi:Comprobante>`;

    const result = triageCfdiXml(mockXml);
    expect(result).not.toBeNull();
    expect(result!.category).toBe("cfdi_sat");
    expect(result!.extractedFields.total).toBe("1450.00");
    expect(result!.extractedFields.moneda).toBe("MXN");
    expect(result!.extractedFields.emisorRfc).toBe("AWS980101XYZ");
    expect(result!.extractedFields.emisorNombre).toBe("AMAZON WEB SERVICES MEXICO");
    expect(result!.extractedFields.uuid).toBe("8F491102-ABCD-4321-9999-001122334455");
    expect(result!.suggestedFilename).toContain("CFDI_Factura_AWS980101XYZ_$1450.00_2026-03-15.xml");
    expect(result!.suggestedTags).toContain("cfdi");
    expect(result!.suggestedTags).toContain("8f491102");
  });

  it("detects official ID credentials (INE / Pasaporte)", () => {
    const result = analyzeDocumentTriage("scan_front.pdf", "INSTITUTO NACIONAL ELECTORAL CREDENCIAL PARA VOTAR", "application/pdf");
    expect(result.category).toBe("id_credential");
    expect(result.extractedFields.tipoId).toBe("INE");
    expect(result.suggestedFilename).toContain("Identificacion_INE_");
  });

  it("falls back gracefully for generic files", () => {
    const result = analyzeDocumentTriage("family_photo.jpg", "", "image/jpeg");
    expect(result.category).toBe("generic");
    expect(result.confidence).toBe(0.5);
  });
});

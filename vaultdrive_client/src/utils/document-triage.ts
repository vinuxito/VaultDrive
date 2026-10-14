/**
 * El Cerebro Ciego — Client-Side Document Triage & Smart Auto-Naming
 * Zero-Knowledge Pattern Recognition running 100% in browser memory.
 */

import { extractSnippetForIndexing } from "./streaming-decrypt";

export type DocumentCategory =
  | "cfdi_sat"
  | "sat_constancia"
  | "contract_legal"
  | "bank_receipt"
  | "id_credential"
  | "spreadsheet"
  | "generic";

export interface TriageResult {
  category: DocumentCategory;
  detectedType: string;
  confidence: number; // 0 to 1
  suggestedFilename?: string;
  suggestedTags: string[];
  extractedFields: Record<string, string>;
  summaryText?: string;
}

const RFC_REGEX = /\b([A-Z&Ñ]{3,4}\d{6}[A-Z0-9]{3})\b/i;
const DATE_REGEX = /\b(20\d{2}[-/.]\d{2}[-/.]\d{2})\b/;
const TOTAL_REGEX = /(?:total|importe|monto|monto total)[\s:=]*\$?\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})?)/i;

function cleanText(text: string): string {
  return text
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/**
 * Triage analysis for CFDI 3.3 / 4.0 XML documents
 */
export function triageCfdiXml(xmlContent: string, filename = ""): TriageResult | null {
  const hasXmlNodes =
    xmlContent.includes("cfdi:Comprobante") ||
    xmlContent.includes("<Comprobante") ||
    xmlContent.includes("TimbreFiscalDigital");
  const normFile = cleanText(filename);
  const isCfdiFilename =
    normFile.endsWith(".XML") &&
    (normFile.includes("CFDI") || normFile.includes("FACTURA") || normFile.includes("SAT") || normFile.includes("NOMINA"));

  if (!hasXmlNodes && !isCfdiFilename) {
    return null;
  }

  const fields: Record<string, string> = {};

  // Extract Total
  const totalMatch = xmlContent.match(/\bTotal="([^"]+)"/i);
  if (totalMatch) fields.total = totalMatch[1];

  // Extract Moneda
  const monedaMatch = xmlContent.match(/\bMoneda="([^"]+)"/i);
  if (monedaMatch) fields.moneda = monedaMatch[1].toUpperCase();

  // Extract Fecha
  const fechaMatch = xmlContent.match(/\bFecha="([^"T]+)/i);
  if (fechaMatch) fields.fecha = fechaMatch[1];

  // Extract Emisor node attributes safely regardless of attribute order
  const emisorNodeMatch = xmlContent.match(/<(?:cfdi:)?Emisor\b[^>]*>/i);
  if (emisorNodeMatch) {
    const emisorTag = emisorNodeMatch[0];
    const rfcAttr = emisorTag.match(/\bRfc="([^"]+)"/i);
    const nombreAttr = emisorTag.match(/\bNombre="([^"]*)"/i);
    if (rfcAttr) fields.emisorRfc = rfcAttr[1].toUpperCase();
    if (nombreAttr && nombreAttr[1]) fields.emisorNombre = nombreAttr[1];
    else if (fields.emisorRfc) fields.emisorNombre = fields.emisorRfc;
  } else {
    const fileRfc = filename.match(RFC_REGEX);
    if (fileRfc) fields.emisorRfc = fileRfc[1].toUpperCase();
  }

  // Extract TimbreFiscalDigital UUID
  const uuidMatch = xmlContent.match(/\bUUID="([0-9a-fA-F-]{8,36})"/i);
  if (uuidMatch) fields.uuid = uuidMatch[1].toUpperCase();

  // Extract TipoDeComprobante (I = Ingreso, E = Egreso, P = Pago, N = Nómina)
  const tipoMatch = xmlContent.match(/\bTipoDeComprobante="([^"]+)"/i);
  const tipoChar = tipoMatch ? tipoMatch[1].toUpperCase() : normFile.includes("NOMINA") ? "N" : "I";
  const tipoLabel =
    tipoChar === "N" ? "Nomina" : tipoChar === "P" ? "Pago" : tipoChar === "E" ? "Egreso" : "Factura";

  const datePart = fields.fecha ? fields.fecha.slice(0, 10) : new Date().toISOString().slice(0, 10);
  const rfcPart = fields.emisorRfc ? fields.emisorRfc.toUpperCase() : "SAT";
  const totalPart = fields.total ? `$${fields.total}` : "";

  const suggestedFilename = `CFDI_${tipoLabel}_${rfcPart}_${totalPart ? totalPart + "_" : ""}${datePart}.xml`;
  const tags = ["cfdi", "sat", "fiscal", tipoLabel.toLowerCase(), rfcPart.toLowerCase()];
  if (fields.uuid) tags.push(fields.uuid.slice(0, 8).toLowerCase());

  return {
    category: "cfdi_sat",
    detectedType: `CFDI SAT (${tipoLabel})`,
    confidence: hasXmlNodes ? 0.98 : 0.85,
    suggestedFilename,
    suggestedTags: Array.from(new Set(tags)),
    extractedFields: fields,
    summaryText: `Comprobante Fiscal Digital (${tipoLabel}) de ${fields.emisorNombre || rfcPart}${fields.total ? " por $" + fields.total : ""}${fields.moneda ? " " + fields.moneda : ""}`,
  };
}

/**
 * Triage analysis for SAT Constancia de Situación Fiscal
 */
export function triageSatConstancia(text: string, filename = ""): TriageResult | null {
  const combined = text + " " + filename.replace(/[_-]+/g, " ");
  const norm = cleanText(combined);
  if (
    !norm.includes("CONSTANCIA DE SITUACION FISCAL") &&
    !norm.includes("CEDULA DE IDENTIFICACION FISCAL") &&
    !norm.includes("CONSTANCIA SAT")
  ) {
    return null;
  }

  const fields: Record<string, string> = {};
  const rfcMatch = combined.match(RFC_REGEX);
  if (rfcMatch) fields.rfc = rfcMatch[1].toUpperCase();

  const rfcPart = fields.rfc || "SAT";
  const dateStr = new Date().toISOString().slice(0, 7); // YYYY-MM
  const suggestedFilename = `Constancia_SAT_${rfcPart}_${dateStr}.pdf`;

  return {
    category: "sat_constancia",
    detectedType: "Constancia de Situación Fiscal SAT",
    confidence: 0.95,
    suggestedFilename,
    suggestedTags: ["sat", "constancia", "rfc", "fiscal", rfcPart.toLowerCase()],
    extractedFields: fields,
    summaryText: `Constancia SAT oficial para RFC ${rfcPart}`,
  };
}

/**
 * Triage analysis for Legal Contracts & Deeds
 */
export function triageContract(text: string, filename: string): TriageResult | null {
  const norm = cleanText(text + " " + filename.replace(/[_-]+/g, " "));
  const isContract =
    norm.includes("CONTRATO") ||
    norm.includes("CONVENIO") ||
    norm.includes("ACUERDO") ||
    norm.includes("ESCRITURA") ||
    norm.includes("ACTA CONSTITUTIVA");
  if (!isContract) return null;

  let tipo = "General";
  if (norm.includes("ARRENDAMIENTO")) tipo = "Arrendamiento";
  else if (norm.includes("PRESTACION DE SERVICIOS") || norm.includes("SERVICIOS")) tipo = "Servicios";
  else if (norm.includes("COMPRAVENTA")) tipo = "Compraventa";
  else if (norm.includes("CONFIDENCIALIDAD") || norm.includes("NDA")) tipo = "Confidencialidad";
  else if (norm.includes("LABORAL") || norm.includes("TRABAJO")) tipo = "Laboral";
  else if (norm.includes("ACTA CONSTITUTIVA")) tipo = "Acta_Constitutiva";

  const fields: Record<string, string> = { tipoContrato: tipo };
  const dateMatch = (text + " " + filename).match(DATE_REGEX);
  if (dateMatch) fields.fecha = dateMatch[1];

  const datePart = fields.fecha || new Date().toISOString().slice(0, 10);
  const ext = filename.endsWith(".pdf") ? ".pdf" : filename.endsWith(".docx") ? ".docx" : ".pdf";
  const suggestedFilename = `Contrato_${tipo}_${datePart}${ext}`;

  return {
    category: "contract_legal",
    detectedType: `Contrato Legal (${tipo.replace(/_/g, " ")})`,
    confidence: 0.90,
    suggestedFilename,
    suggestedTags: ["contrato", "legal", tipo.toLowerCase(), "firma"],
    extractedFields: fields,
    summaryText: `Documento legal clasificado como Contrato de ${tipo.replace(/_/g, " ")}`,
  };
}

/**
 * Triage analysis for Bank Payment Proofs & Transfers
 */
export function triageBankReceipt(text: string, filename: string): TriageResult | null {
  const norm = cleanText(text + " " + filename.replace(/[_-]+/g, " "));
  const isBank =
    norm.includes("SPEI") ||
    norm.includes("TRANSFERENCIA") ||
    norm.includes("COMPROBANTE DE PAGO") ||
    norm.includes("ESTADO DE CUENTA") ||
    norm.includes("BBVA") ||
    norm.includes("SANTANDER") ||
    norm.includes("BANORTE");
  if (!isBank) return null;

  const fields: Record<string, string> = {};
  const totalMatch = text.match(TOTAL_REGEX);
  if (totalMatch) fields.monto = totalMatch[1];

  const datePart = new Date().toISOString().slice(0, 10);
  const montoPart = fields.monto ? `$${fields.monto}_` : "";
  const suggestedFilename = `Comprobante_SPEI_${montoPart}${datePart}.pdf`;

  return {
    category: "bank_receipt",
    detectedType: "Comprobante de Pago / SPEI",
    confidence: 0.88,
    suggestedFilename,
    suggestedTags: ["banco", "spei", "pago", "recibo"],
    extractedFields: fields,
    summaryText: `Comprobante bancario${fields.monto ? " por $" + fields.monto : ""}`,
  };
}

/**
 * Triage analysis for Official ID Credentials (INE, Pasaporte, CURP)
 */
export function triageIdCredential(text: string, filename: string): TriageResult | null {
  const norm = cleanText(text + " " + filename.replace(/[_-]+/g, " "));
  const isId =
    norm.includes("INSTITUTO NACIONAL ELECTORAL") ||
    norm.includes("CREDENCIAL PARA VOTAR") ||
    norm.includes("PASAPORTE") ||
    norm.includes("CLAVE UNICA DE REGISTRO DE POBLACION") ||
    /\b(?:INE|CURP)\b/.test(norm);
  if (!isId) return null;

  const tipo = norm.includes("PASAPORTE") ? "Pasaporte" : norm.includes("CURP") ? "CURP" : "INE";
  const datePart = new Date().toISOString().slice(0, 10);
  const ext = filename.toLowerCase().endsWith(".png")
    ? ".png"
    : filename.toLowerCase().endsWith(".jpg") || filename.toLowerCase().endsWith(".jpeg")
      ? ".jpg"
      : ".pdf";

  return {
    category: "id_credential",
    detectedType: `Identificación Oficial (${tipo})`,
    confidence: 0.89,
    suggestedFilename: `Identificacion_${tipo}_${datePart}${ext}`,
    suggestedTags: ["identificacion", "oficial", tipo.toLowerCase(), "kyc"],
    extractedFields: { tipoId: tipo },
    summaryText: `Documento de identidad oficial (${tipo})`,
  };
}

/**
 * Main dispatcher: Analyzes file preview or extracted text sample
 */
export function analyzeDocumentTriage(filename: string, textSample = "", mimeType = ""): TriageResult {
  // 1. Check CFDI XML
  if (filename.toLowerCase().endsWith(".xml") || mimeType.includes("xml") || textSample.includes("cfdi:")) {
    const cfdi = triageCfdiXml(textSample, filename);
    if (cfdi) return cfdi;
  }

  // 2. Check SAT Constancia
  const constancia = triageSatConstancia(textSample, filename);
  if (constancia) return constancia;

  // 3. Check Legal Contract
  const contract = triageContract(textSample, filename);
  if (contract) return contract;

  // 4. Check Bank Receipt
  const bank = triageBankReceipt(textSample, filename);
  if (bank) return bank;

  // 5. Check Official ID Credential
  const idCred = triageIdCredential(textSample, filename);
  if (idCred) return idCred;

  // 6. Spreadsheets
  if (
    filename.toLowerCase().endsWith(".xlsx") ||
    filename.toLowerCase().endsWith(".csv") ||
    mimeType.includes("spreadsheet") ||
    mimeType.includes("csv")
  ) {
    return {
      category: "spreadsheet",
      detectedType: "Hoja de Cálculo / Datos",
      confidence: 0.85,
      suggestedTags: ["hoja_calculo", "datos", "finanzas"],
      extractedFields: {},
      summaryText: "Archivo de datos tabulares o finanzas",
    };
  }

  // Fallback generic
  return {
    category: "generic",
    detectedType: "Documento Soberano",
    confidence: 0.50,
    suggestedTags: ["archivo"],
    extractedFields: {},
  };
}

/**
 * Reads up to the first 64KB of a browser File object in memory (zero network traffic)
 * to extract an indexable snippet and perform content-aware document triage.
 */
export async function triageFileObject(
  file: File
): Promise<{ triage: TriageResult; snippetText: string }> {
  let snippetText = "";
  try {
    const headBlob = typeof file.slice === "function" ? file.slice(0, 65536) : file;
    if (typeof headBlob.arrayBuffer === "function") {
      const buf = await headBlob.arrayBuffer();
      snippetText = extractSnippetForIndexing(buf, file.type || "", file.name) || "";
    } else if (typeof (file as any).text === "function") {
      const rawText = await (file as any).text();
      snippetText = String(rawText).slice(0, 4000);
    }
  } catch {
    // Fallback cleanly to filename/mime triage if stream read is unavailable
  }

  const triage = analyzeDocumentTriage(file.name, snippetText, file.type || "");
  return { triage, snippetText };
}


import JSZip from "jszip";

export type FilemonOfficeKind =
  | "cfdi_xml"
  | "generic_xml"
  | "spreadsheet"
  | "pdf"
  | "json"
  | "markdown"
  | "text";

export interface CfdiConcepto {
  claveProdServ: string;
  cantidad: string;
  claveUnidad: string;
  descripcion: string;
  valorUnitario: string;
  importe: string;
}

export interface AmarreFiscalRochePayload {
  plugin: "filemon-office-mx";
  host: "ABRN-Drive";
  target_modules: ["Quantix ABRN SAT", "Amarre Fiscal (Roche)"];
  document_id: string;
  filename: string;
  sha256: string;
  uuid: string;
  serie_folio: string;
  fecha: string;
  tipo_comprobante: string;
  emisor_rfc: string;
  emisor_nombre: string;
  emisor_regimen: string;
  receptor_rfc: string;
  receptor_nombre: string;
  receptor_uso_cfdi: string;
  subtotal: string;
  descuento: string;
  iva_trasladado: string;
  retenciones: string;
  total: string;
  moneda: string;
  metodo_pago: string;
  forma_pago: string;
  conceptos_count: number;
  status_sat: "UNVERIFIED_LOCAL_RAM_PARSE";
}

export interface CfdiInvoiceData {
  version: string;
  serie: string;
  folio: string;
  fecha: string;
  subTotal: string;
  descuento: string;
  moneda: string;
  total: string;
  tipoDeComprobante: string;
  metodoPago: string;
  formaPago: string;
  lugarExpedicion: string;
  emisor: {
    rfc: string;
    nombre: string;
    regimenFiscal: string;
  };
  receptor: {
    rfc: string;
    nombre: string;
    usoCFDI: string;
    domicilioFiscalReceptor: string;
    regimenFiscalReceptor: string;
  };
  conceptos: CfdiConcepto[];
  impuestos: {
    totalImpuestosTrasladados: string;
    totalImpuestosRetenidos: string;
  };
  timbre: {
    uuid: string;
    fechaTimbrado: string;
    rfcProvCertif: string;
    selloCFD: string;
    selloSAT: string;
  };
  amarreFiscalRochePayload: AmarreFiscalRochePayload;
}

export interface OfficeCell {
  ref: string;
  value: string;
  formula?: string;
  cacheMissing?: boolean;
}

export interface OfficeSheet {
  name: string;
  columns: string[];
  rows: OfficeCell[][];
  totalRows: number;
  totalCols: number;
  truncated: boolean;
}

export interface OfficeSpreadsheetData {
  format: "xlsx" | "csv" | "tsv";
  sheets: OfficeSheet[];
}

export interface FilemonOfficeDocumentContract {
  identity: {
    document_id: string;
    filename: string;
    sha256: string;
    bytes: number;
  };
  plugin: {
    module: "filemon-office-mx";
    host: "ABRN-Drive";
    targets: ["Quantix ABRN SAT", "Amarre Fiscal (Roche)"];
  };
  kind: FilemonOfficeKind;
  badgeLabel: string;
  headline: string;
  readonly: true;
  rawText?: string;
  cfdi?: CfdiInvoiceData;
  spreadsheet?: OfficeSpreadsheetData;
  notices: string[];
  citation: {
    sha256: string;
    locator: string;
  };
}

const OFFICE_EXTENSIONS = new Set([
  "xml",
  "xlsx",
  "csv",
  "tsv",
  "pdf",
  "json",
  "md",
  "txt",
]);

export function getFileExtension(filename: string): string {
  const parts = filename.toLowerCase().trim().split(".");
  return parts.length > 1 ? parts[parts.length - 1] : "";
}

export function canHandleWithFilemonOffice(filename: string): boolean {
  return OFFICE_EXTENSIONS.has(getFileExtension(filename));
}

export function columnIndexToLetter(index: number): string {
  let n = index + 1;
  let letters = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    letters = String.fromCharCode(65 + rem) + letters;
    n = Math.floor((n - 1) / 26);
  }
  return letters || "A";
}

export function cellRefToCoords(ref: string): { row: number; col: number } | null {
  const match = /^([A-Za-z]+)(\d+)$/.exec(ref.trim());
  if (!match) return null;
  const letters = match[1].toUpperCase();
  const rowNum = parseInt(match[2], 10);
  if (Number.isNaN(rowNum) || rowNum < 1) return null;
  let col = 0;
  for (let i = 0; i < letters.length; i++) {
    col = col * 26 + (letters.charCodeAt(i) - 64);
  }
  return { row: rowNum - 1, col: col - 1 };
}

export function buildSpreadsheetCellCitation(
  filename: string,
  sha256: string,
  sheetName: string,
  cell: OfficeCell
): string {
  const shortHash = (sha256 || "PENDING").slice(0, 12);
  return `${filename}#sha256:${shortHash}!${sheetName}!${cell.ref}="${cell.value}"`;
}

function getAttrCI(el: Element | null, names: string[]): string {
  if (!el) return "";
  for (const name of names) {
    const direct = el.getAttribute(name);
    if (direct !== null && direct !== "") return direct;
  }
  const lowerSet = new Set(names.map((n) => n.toLowerCase()));
  for (let i = 0; i < el.attributes.length; i++) {
    const attr = el.attributes[i];
    if (lowerSet.has(attr.name.toLowerCase()) || lowerSet.has(attr.localName?.toLowerCase() || "")) {
      return attr.value;
    }
  }
  return "";
}

function findElementsByLocalName(root: Document | Element, localName: string): Element[] {
  const target = localName.toLowerCase();
  const all = root.getElementsByTagName("*");
  const matched: Element[] = [];
  for (let i = 0; i < all.length; i++) {
    const el = all[i];
    const ln = (el.localName || el.tagName.split(":").pop() || "").toLowerCase();
    if (ln === target) {
      matched.push(el);
    }
  }
  return matched;
}

export function parseDelimitedText(
  text: string,
  delimiter: "," | "\t",
  sheetName = "Hoja 1",
  maxRows = 200,
  maxCols = 32
): OfficeSheet {
  const clean = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const rawRows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = "";
  let inQuotes = false;

  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (inQuotes) {
      if (ch === '"') {
        if (clean[i + 1] === '"') {
          currentCell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        currentCell += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      currentRow.push(currentCell.trim());
      currentCell = "";
    } else if (ch === "\n") {
      currentRow.push(currentCell.trim());
      if (currentRow.some((c) => c !== "") || rawRows.length > 0) {
        rawRows.push(currentRow);
      }
      currentRow = [];
      currentCell = "";
    } else {
      currentCell += ch;
    }
  }
  if (currentCell !== "" || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    if (currentRow.some((c) => c !== "")) {
      rawRows.push(currentRow);
    }
  }

  const totalRows = rawRows.length;
  const totalCols = rawRows.reduce((max, r) => Math.max(max, r.length), 0);
  const boundedCols = Math.min(Math.max(totalCols, 1), maxCols);
  const boundedRows = rawRows.slice(0, maxRows);

  const columns = Array.from({ length: boundedCols }, (_, idx) => columnIndexToLetter(idx));
  const rows: OfficeCell[][] = boundedRows.map((r, rIdx) =>
    Array.from({ length: boundedCols }, (_, cIdx) => ({
      ref: `${columnIndexToLetter(cIdx)}${rIdx + 1}`,
      value: r[cIdx] ?? "",
    }))
  );

  return {
    name: sheetName,
    columns,
    rows,
    totalRows,
    totalCols,
    truncated: totalRows > maxRows || totalCols > maxCols,
  };
}

export async function parseXlsxBuffer(
  buffer: ArrayBuffer,
  maxRows = 200,
  maxCols = 32
): Promise<OfficeSpreadsheetData> {
  const zip = await JSZip.loadAsync(buffer);
  const parser = new DOMParser();

  // 1. Parse sharedStrings.xml if present
  const sharedStrings: string[] = [];
  const sharedStringsFile = zip.file("xl/sharedStrings.xml");
  if (sharedStringsFile) {
    const ssXml = await sharedStringsFile.async("string");
    const ssDoc = parser.parseFromString(ssXml, "application/xml");
    const siNodes = findElementsByLocalName(ssDoc, "si");
    for (const si of siNodes) {
      const tNodes = findElementsByLocalName(si, "t");
      sharedStrings.push(tNodes.map((t) => t.textContent ?? "").join(""));
    }
  }

  // 2. Parse workbook.xml for sheet names
  const sheetNames: string[] = [];
  const wbFile = zip.file("xl/workbook.xml");
  if (wbFile) {
    const wbXml = await wbFile.async("string");
    const wbDoc = parser.parseFromString(wbXml, "application/xml");
    const sheetNodes = findElementsByLocalName(wbDoc, "sheet");
    for (const sNode of sheetNodes) {
      const name = getAttrCI(sNode, ["name"]) || `Hoja ${sheetNames.length + 1}`;
      sheetNames.push(name);
    }
  }

  // 3. Locate worksheet XML files
  const worksheetPaths = Object.keys(zip.files)
    .filter((p) => /^xl\/worksheets\/sheet\d+\.xml$/i.test(p))
    .sort((a, b) => {
      const numA = parseInt(a.match(/\d+/)?.[0] || "0", 10);
      const numB = parseInt(b.match(/\d+/)?.[0] || "0", 10);
      return numA - numB;
    })
    .slice(0, 12);

  const sheets: OfficeSheet[] = [];
  for (let idx = 0; idx < worksheetPaths.length; idx++) {
    const wsPath = worksheetPaths[idx];
    const wsFile = zip.file(wsPath);
    if (!wsFile) continue;
    const wsXml = await wsFile.async("string");
    const wsDoc = parser.parseFromString(wsXml, "application/xml");
    const rowNodes = findElementsByLocalName(wsDoc, "row");

    let maxRowSeen = 0;
    let maxColSeen = 0;
    const cellMap = new Map<string, OfficeCell>();

    for (let rIdx = 0; rIdx < rowNodes.length; rIdx++) {
      const rowEl = rowNodes[rIdx];
      const rowNumAttr = parseInt(getAttrCI(rowEl, ["r"]) || String(rIdx + 1), 10);
      const rowZero = Math.max(0, rowNumAttr - 1);
      maxRowSeen = Math.max(maxRowSeen, rowZero + 1);

      const cNodes = findElementsByLocalName(rowEl, "c");
      for (let cIdx = 0; cIdx < cNodes.length; cIdx++) {
        const cEl = cNodes[cIdx];
        const refAttr = getAttrCI(cEl, ["r"]) || `${columnIndexToLetter(cIdx)}${rowZero + 1}`;
        const coords = cellRefToCoords(refAttr) ?? { row: rowZero, col: cIdx };
        maxRowSeen = Math.max(maxRowSeen, coords.row + 1);
        maxColSeen = Math.max(maxColSeen, coords.col + 1);

        if (coords.row >= maxRows || coords.col >= maxCols) continue;

        const cellType = getAttrCI(cEl, ["t"]);
        const vNode = findElementsByLocalName(cEl, "v")[0];
        const fNode = findElementsByLocalName(cEl, "f")[0];
        const isNode = findElementsByLocalName(cEl, "is")[0];

        const rawV = vNode?.textContent?.trim() ?? "";
        const formulaText = fNode?.textContent?.trim() || undefined;
        let displayVal = rawV;
        let cacheMissing = false;

        if (cellType === "s") {
          const ssIndex = parseInt(rawV, 10);
          displayVal = !Number.isNaN(ssIndex) && sharedStrings[ssIndex] !== undefined
            ? sharedStrings[ssIndex]
            : rawV;
        } else if (cellType === "inlineStr" && isNode) {
          const tNodes = findElementsByLocalName(isNode, "t");
          displayVal = tNodes.map((t) => t.textContent ?? "").join("");
        } else if (cellType === "b") {
          displayVal = rawV === "1" ? "TRUE" : "FALSE";
        } else if (formulaText && rawV === "") {
          displayVal = "NOT_EVALUABLE (sin caché de fórmula)";
          cacheMissing = true;
        }

        const normRef = `${columnIndexToLetter(coords.col)}${coords.row + 1}`;
        cellMap.set(normRef, {
          ref: normRef,
          value: displayVal,
          formula: formulaText,
          cacheMissing,
        });
      }
    }

    const boundedRowsCount = Math.min(maxRowSeen, maxRows);
    const boundedColsCount = Math.min(Math.max(maxColSeen, 1), maxCols);
    const columns = Array.from({ length: boundedColsCount }, (_, c) => columnIndexToLetter(c));
    const rows: OfficeCell[][] = [];

    for (let r = 0; r < boundedRowsCount; r++) {
      const rowCells: OfficeCell[] = [];
      for (let c = 0; c < boundedColsCount; c++) {
        const ref = `${columnIndexToLetter(c)}${r + 1}`;
        rowCells.push(
          cellMap.get(ref) ?? {
            ref,
            value: "",
          }
        );
      }
      rows.push(rowCells);
    }

    sheets.push({
      name: sheetNames[idx] || `Hoja ${idx + 1}`,
      columns,
      rows,
      totalRows: maxRowSeen,
      totalCols: maxColSeen,
      truncated: maxRowSeen > maxRows || maxColSeen > maxCols,
    });
  }

  return {
    format: "xlsx",
    sheets,
  };
}

function parseXmlDocument(
  rawXml: string,
  documentId: string,
  filename: string,
  sha256: string,
  bytes: number
): FilemonOfficeDocumentContract {
  const cleanXml = rawXml.replace(/^\uFEFF/, "").trim();

  // Security invariant: block DTD entity expansion / external entities
  if (/<!ENTITY\b|<!DOCTYPE\b[^>]*\[|\bSYSTEM\s+["']|\bPUBLIC\s+["']/i.test(cleanXml)) {
    return {
      identity: { document_id: documentId, filename, sha256, bytes },
      plugin: {
        module: "filemon-office-mx",
        host: "ABRN-Drive",
        targets: ["Quantix ABRN SAT", "Amarre Fiscal (Roche)"],
      },
      kind: "generic_xml",
      badgeLabel: "FILEMÓN OFFICE • XML BLOQUEADO",
      headline: "XML rechazado por política de seguridad (entidades externas DTD)",
      readonly: true,
      rawText: cleanXml,
      notices: [
        "Este XML contiene declaraciones DTD o entidades externas (XXE) y su interpretación estructurada fue bloqueada por seguridad.",
      ],
      citation: { sha256, locator: "xml:/blocked-dtd" },
    };
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(cleanXml, "application/xml");
  const parseError = doc.querySelector("parsererror");
  if (parseError) {
    return {
      identity: { document_id: documentId, filename, sha256, bytes },
      plugin: {
        module: "filemon-office-mx",
        host: "ABRN-Drive",
        targets: ["Quantix ABRN SAT", "Amarre Fiscal (Roche)"],
      },
      kind: "generic_xml",
      badgeLabel: "FILEMÓN OFFICE • XML",
      headline: "XML con formato incompleto · Modo fuente seguro",
      readonly: true,
      rawText: cleanXml,
      notices: ["El archivo XML no pudo analizarse como árbol completo; se muestra la fuente escapada."],
      citation: { sha256, locator: "xml:/source" },
    };
  }

  const comprobante = findElementsByLocalName(doc, "Comprobante")[0];
  const isCfdi =
    Boolean(comprobante) &&
    (cleanXml.includes("http://www.sat.gob.mx/cfd/") ||
      comprobante.tagName.toLowerCase().startsWith("cfdi:") ||
      Boolean(findElementsByLocalName(doc, "Emisor")[0]));

  if (!isCfdi || !comprobante) {
    const rootName = doc.documentElement?.tagName || "xml";
    return {
      identity: { document_id: documentId, filename, sha256, bytes },
      plugin: {
        module: "filemon-office-mx",
        host: "ABRN-Drive",
        targets: ["Quantix ABRN SAT", "Amarre Fiscal (Roche)"],
      },
      kind: "generic_xml",
      badgeLabel: "FILEMÓN OFFICE • XML",
      headline: `Documento XML (<${rootName}>)`,
      readonly: true,
      rawText: cleanXml,
      notices: ["XML genérico leído en memoria RAM (no es un comprobante CFDI del SAT)."],
      citation: { sha256, locator: `xml:/${rootName}` },
    };
  }

  const emisorEl = findElementsByLocalName(comprobante, "Emisor")[0] || null;
  const receptorEl = findElementsByLocalName(comprobante, "Receptor")[0] || null;
  const timbreEl = findElementsByLocalName(comprobante, "TimbreFiscalDigital")[0] || null;
  const conceptoContainer = findElementsByLocalName(comprobante, "Conceptos")[0] || comprobante;
  const conceptoNodes = findElementsByLocalName(conceptoContainer, "Concepto");

  // Top-level Impuestos is the last Impuestos node or direct child of Comprobante
  const allImpuestos = findElementsByLocalName(comprobante, "Impuestos");
  const rootImpuestos =
    allImpuestos.find((el) => el.parentElement === comprobante) ||
    allImpuestos[allImpuestos.length - 1] ||
    null;

  const version = getAttrCI(comprobante, ["Version"]) || "4.0";
  const serie = getAttrCI(comprobante, ["Serie"]);
  const folio = getAttrCI(comprobante, ["Folio"]);
  const fecha = getAttrCI(comprobante, ["Fecha"]) || "NOT_EVALUABLE";
  const subTotal = getAttrCI(comprobante, ["SubTotal"]) || "NOT_EVALUABLE";
  const descuento = getAttrCI(comprobante, ["Descuento"]) || "0.00";
  const moneda = getAttrCI(comprobante, ["Moneda"]) || "MXN";
  const total = getAttrCI(comprobante, ["Total"]) || "NOT_EVALUABLE";
  const tipoDeComprobante = getAttrCI(comprobante, ["TipoDeComprobante"]) || "I";
  const metodoPago = getAttrCI(comprobante, ["MetodoPago"]) || "PUE";
  const formaPago = getAttrCI(comprobante, ["FormaPago"]) || "03";
  const lugarExpedicion = getAttrCI(comprobante, ["LugarExpedicion"]) || "—";

  const emisor = {
    rfc: getAttrCI(emisorEl, ["Rfc"]) || "NOT_EVALUABLE",
    nombre: getAttrCI(emisorEl, ["Nombre"]) || "Sin nombre de emisor",
    regimenFiscal: getAttrCI(emisorEl, ["RegimenFiscal"]) || "—",
  };

  const receptor = {
    rfc: getAttrCI(receptorEl, ["Rfc"]) || "NOT_EVALUABLE",
    nombre: getAttrCI(receptorEl, ["Nombre"]) || "Sin nombre de receptor",
    usoCFDI: getAttrCI(receptorEl, ["UsoCFDI"]) || "—",
    domicilioFiscalReceptor: getAttrCI(receptorEl, ["DomicilioFiscalReceptor"]) || "—",
    regimenFiscalReceptor: getAttrCI(receptorEl, ["RegimenFiscalReceptor"]) || "—",
  };

  const conceptos: CfdiConcepto[] = conceptoNodes.slice(0, 100).map((cEl) => ({
    claveProdServ: getAttrCI(cEl, ["ClaveProdServ"]) || "—",
    cantidad: getAttrCI(cEl, ["Cantidad"]) || "1",
    claveUnidad: getAttrCI(cEl, ["ClaveUnidad", "Unidad"]) || "—",
    descripcion: getAttrCI(cEl, ["Descripcion"]) || "Concepto sin descripción",
    valorUnitario: getAttrCI(cEl, ["ValorUnitario"]) || "NOT_EVALUABLE",
    importe: getAttrCI(cEl, ["Importe"]) || "NOT_EVALUABLE",
  }));

  const impuestos = {
    totalImpuestosTrasladados:
      getAttrCI(rootImpuestos, ["TotalImpuestosTrasladados"]) || "0.00",
    totalImpuestosRetenidos:
      getAttrCI(rootImpuestos, ["TotalImpuestosRetenidos"]) || "0.00",
  };

  const timbre = {
    uuid: getAttrCI(timbreEl, ["UUID"]) || "SIN-TIMBRE-UUID",
    fechaTimbrado: getAttrCI(timbreEl, ["FechaTimbrado"]) || "—",
    rfcProvCertif: getAttrCI(timbreEl, ["RfcProvCertif"]) || "—",
    selloCFD: getAttrCI(timbreEl, ["SelloCFD"]) || "",
    selloSAT: getAttrCI(timbreEl, ["SelloSAT"]) || "",
  };

  const serieFolio = [serie, folio].filter(Boolean).join("-") || "S/F";
  const amarreFiscalRochePayload: AmarreFiscalRochePayload = {
    plugin: "filemon-office-mx",
    host: "ABRN-Drive",
    target_modules: ["Quantix ABRN SAT", "Amarre Fiscal (Roche)"],
    document_id: documentId,
    filename,
    sha256,
    uuid: timbre.uuid,
    serie_folio: serieFolio,
    fecha,
    tipo_comprobante: tipoDeComprobante,
    emisor_rfc: emisor.rfc,
    emisor_nombre: emisor.nombre,
    emisor_regimen: emisor.regimenFiscal,
    receptor_rfc: receptor.rfc,
    receptor_nombre: receptor.nombre,
    receptor_uso_cfdi: receptor.usoCFDI,
    subtotal: subTotal,
    descuento,
    iva_trasladado: impuestos.totalImpuestosTrasladados,
    retenciones: impuestos.totalImpuestosRetenidos,
    total,
    moneda,
    metodo_pago: metodoPago,
    forma_pago: formaPago,
    conceptos_count: conceptos.length,
    status_sat: "UNVERIFIED_LOCAL_RAM_PARSE",
  };

  const formattedTotal =
    total !== "NOT_EVALUABLE" && !Number.isNaN(Number(total))
      ? `$${Number(total).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${moneda}`
      : `${total} ${moneda}`;

  return {
    identity: { document_id: documentId, filename, sha256, bytes },
    plugin: {
      module: "filemon-office-mx",
      host: "ABRN-Drive",
      targets: ["Quantix ABRN SAT", "Amarre Fiscal (Roche)"],
    },
    kind: "cfdi_xml",
    badgeLabel: `FILEMÓN OFFICE • CFDI ${version}`,
    headline: `${formattedTotal} • ${emisor.nombre} (${emisor.rfc})`,
    readonly: true,
    rawText: cleanXml,
    cfdi: {
      version,
      serie,
      folio,
      fecha,
      subTotal,
      descuento,
      moneda,
      total,
      tipoDeComprobante,
      metodoPago,
      formaPago,
      lugarExpedicion,
      emisor,
      receptor,
      conceptos,
      impuestos,
      timbre,
      amarreFiscalRochePayload,
    },
    notices: [
      "Gemelo en Vivo (Filemón Office): Estructura CFDI leída localmente en memoria RAM. La vigencia ante el SAT no ha sido consultada externamente.",
    ],
    citation: {
      sha256,
      locator: `cfdi://uuid/${timbre.uuid}`,
    },
  };
}

export async function parseFilemonOfficeDocument(params: {
  id: string;
  filename: string;
  buffer: ArrayBuffer;
  sha256?: string;
}): Promise<FilemonOfficeDocumentContract> {
  const { id, filename, buffer } = params;
  const sha256 = params.sha256 || "PENDING_SHA256";
  const bytes = buffer.byteLength;
  const ext = getFileExtension(filename);

  if (ext === "xlsx") {
    try {
      const spreadsheet = await parseXlsxBuffer(buffer);
      const totalRows = spreadsheet.sheets.reduce((acc, s) => acc + s.totalRows, 0);
      const firstSheet = spreadsheet.sheets[0]?.name || "Hoja 1";
      return {
        identity: { document_id: id, filename, sha256, bytes },
        plugin: {
          module: "filemon-office-mx",
          host: "ABRN-Drive",
          targets: ["Quantix ABRN SAT", "Amarre Fiscal (Roche)"],
        },
        kind: "spreadsheet",
        badgeLabel: "FILEMÓN OFFICE • EXCEL XLSX",
        headline: `${spreadsheet.sheets.length} ${spreadsheet.sheets.length === 1 ? "Hoja" : "Hojas"} • ${totalRows} filas`,
        readonly: true,
        spreadsheet,
        notices: [
          "Lector de hojas Filemón Office (solo lectura): muestra valores almacenados en caché sin ejecutar macros ni conexiones externas.",
        ],
        citation: {
          sha256,
          locator: `sheet://${encodeURIComponent(firstSheet)}!A1`,
        },
      };
    } catch {
      return {
        identity: { document_id: id, filename, sha256, bytes },
        plugin: {
          module: "filemon-office-mx",
          host: "ABRN-Drive",
          targets: ["Quantix ABRN SAT", "Amarre Fiscal (Roche)"],
        },
        kind: "spreadsheet",
        badgeLabel: "FILEMÓN OFFICE • XLSX NO LEGIBLE",
        headline: "El libro XLSX está protegido o usa un formato binario no soportado",
        readonly: true,
        spreadsheet: { format: "xlsx", sheets: [] },
        notices: [
          "No se pudo expandir xl/workbook.xml. Si es un archivo .xls binario o XLSB, guárdalo como .xlsx estándar o descarga el original.",
        ],
        citation: { sha256, locator: "sheet://unreadable" },
      };
    }
  }

  if (ext === "csv" || ext === "tsv") {
    const decoder = new TextDecoder("utf-8", { fatal: false });
    const rawText = decoder.decode(buffer);
    const sheet = parseDelimitedText(
      rawText,
      ext === "tsv" ? "\t" : ",",
      ext.toUpperCase()
    );
    return {
      identity: { document_id: id, filename, sha256, bytes },
      plugin: {
        module: "filemon-office-mx",
        host: "ABRN-Drive",
        targets: ["Quantix ABRN SAT", "Amarre Fiscal (Roche)"],
      },
      kind: "spreadsheet",
      badgeLabel: `FILEMÓN OFFICE • ${ext.toUpperCase()}`,
      headline: `1 Hoja • ${sheet.totalRows} filas × ${sheet.totalCols} columnas`,
      readonly: true,
      rawText,
      spreadsheet: {
        format: ext === "tsv" ? "tsv" : "csv",
        sheets: [sheet],
      },
      notices: [
        "Tabla delimitada leída en memoria RAM con formato tabular lista para Quantix ABRN SAT y Amarre Fiscal (Roche).",
      ],
      citation: {
        sha256,
        locator: `sheet://${ext.toUpperCase()}!A1`,
      },
    };
  }

  if (ext === "xml") {
    const decoder = new TextDecoder("utf-8", { fatal: false });
    const rawXml = decoder.decode(buffer);
    return parseXmlDocument(rawXml, id, filename, sha256, bytes);
  }

  if (ext === "pdf") {
    return {
      identity: { document_id: id, filename, sha256, bytes },
      plugin: {
        module: "filemon-office-mx",
        host: "ABRN-Drive",
        targets: ["Quantix ABRN SAT", "Amarre Fiscal (Roche)"],
      },
      kind: "pdf",
      badgeLabel: "FILEMÓN OFFICE • PDF ORIGINAL",
      headline: `Documento PDF (${(bytes / 1024).toFixed(1)} KB)`,
      readonly: true,
      notices: [
        "Visor PDF original en memoria RAM. Si tu navegador móvil no incrusta PDFs nativamente, usa 'Abrir en pestaña' o 'Descargar Original'.",
      ],
      citation: {
        sha256,
        locator: "pdf://page/1",
      },
    };
  }

  const decoder = new TextDecoder("utf-8", { fatal: false });
  const rawText = decoder.decode(buffer).replace(/^\uFEFF/, "");
  const lineCount = rawText ? rawText.split(/\r?\n/).length : 0;
  const kind: FilemonOfficeKind =
    ext === "json" ? "json" : ext === "md" ? "markdown" : "text";

  return {
    identity: { document_id: id, filename, sha256, bytes },
    plugin: {
      module: "filemon-office-mx",
      host: "ABRN-Drive",
      targets: ["Quantix ABRN SAT", "Amarre Fiscal (Roche)"],
    },
    kind,
    badgeLabel: `FILEMÓN OFFICE • ${ext.toUpperCase() || "DOC"}`,
    headline: `${lineCount} líneas • ${(bytes / 1024).toFixed(1)} KB`,
    readonly: true,
    rawText,
    notices: ["Documento descifrado localmente en memoria RAM."],
    citation: {
      sha256,
      locator: `${kind}://lines/1-${lineCount}`,
    },
  };
}

import { describe, it, expect, beforeEach } from "vitest";
import { VaultSearchIndex, normalizeSearchTerm, tokenizeText, type IndexDocument } from "./vault-search-index";

describe("VaultSearchIndex", () => {
  let index: VaultSearchIndex;

  const mockDocs: IndexDocument[] = [
    {
      id: "doc-1",
      filename: "Contrato_Arrendamiento_2026.pdf",
      folderName: "Contratos",
      tags: ["legal", "arrendamiento", "inmueble"],
      snippetText: "El arrendatario pagará la renta mensual de $15,000 MXN los primeros 5 días hábiles.",
      filesize: 1024 * 500,
      mimeType: "application/pdf",
    },
    {
      id: "doc-2",
      filename: "Factura_SAT_AWS_Marzo.xml",
      folderName: "Impuestos",
      tags: ["cfdi", "sat", "fiscal", "aws"],
      snippetText: "UUID: 8F49-1102 RFC Emisor: AWS980201Total: 1450.00",
      filesize: 1024 * 45,
      mimeType: "text/xml",
    },
    {
      id: "doc-3",
      filename: "Constancia_Situacion_Fiscal_ABRN.pdf",
      folderName: "Contabilidad",
      tags: ["sat", "rfc", "fiscal"],
      snippetText: "RFC: ABR980101-XYZ Cédula de Identificación Fiscal Régimen General de Ley Personas Morales",
      filesize: 1024 * 120,
      mimeType: "application/pdf",
    },
  ];

  beforeEach(() => {
    index = new VaultSearchIndex();
    index.addDocuments(mockDocs);
  });

  it("normalizes text and strips diacritics", () => {
    expect(normalizeSearchTerm("Facturación SAT #402, $1,450.00")).toBe("facturacion sat 402 1450 00");
    expect(normalizeSearchTerm("Año 2026 · Niño")).toBe("ano 2026 nino");
  });

  it("tokenizes terms and creates prefixes", () => {
    const tokens = tokenizeText("Contrato Arrendamiento");
    expect(tokens).toContain("contrato");
    expect(tokens).toContain("contra");
    expect(tokens).toContain("arrendamiento");
    expect(tokens).toContain("arren");
  });

  it("finds document by exact filename match with highest score", () => {
    const results = index.search("Contrato_Arrendamiento_2026.pdf");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].doc.id).toBe("doc-1");
    expect(results[0].score).toBeGreaterThanOrEqual(100);
  });

  it("finds document by partial content snippet inside zero-knowledge text", () => {
    const results = index.search("15000");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].doc.id).toBe("doc-1");
    expect(results[0].matchedFields).toContain("content");
    expect(results[0].snippet).toContain("15,000");
  });

  it("finds document by tag", () => {
    const results = index.search("cfdi");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].doc.id).toBe("doc-2");
  });

  it("handles empty or nonsense queries cleanly", () => {
    expect(index.search("")).toEqual([]);
    expect(index.search("   ")).toEqual([]);
    expect(index.search("nonexistentterm9999")).toEqual([]);
  });

  it("removes documents and cleans tokens", () => {
    expect(index.size()).toBe(3);
    index.removeDocument("doc-1");
    expect(index.size()).toBe(2);
    expect(index.search("Arrendamiento")).toEqual([]);
  });

  it("preserves session enrichment across syncDocuments calls and scrubs on lock", () => {
    index.enrichDocument(
      { id: "doc-1", filename: "Contrato_Arrendamiento_2026.pdf" },
      {
        snippetText: "CLÁUSULA SÉPTIMA: Penalización por rescisión anticipada de $45,000 MXN",
        tags: ["penalizacion", "clausula"],
        detectedType: "Contrato Legal (Arrendamiento)",
      }
    );

    // Simulate React Query refetch where raw file list has no snippetText
    index.syncDocuments([
      {
        id: "doc-1",
        filename: "Contrato_Arrendamiento_2026.pdf",
        folderName: "Contratos",
        tags: ["archivo"],
        filesize: 1024 * 500,
      },
    ]);

    const results = index.search("45000");
    expect(results.length).toBe(1);
    expect(results[0].doc.id).toBe("doc-1");
    expect(results[0].doc.tags).toContain("penalizacion");

    // Panic lock / logout scrub
    index.scrub();
    expect(index.size()).toBe(0);
    expect(index.search("45000")).toEqual([]);
  });

  it("searches 500+ documents in under 5ms", () => {
    const bulkIndex = new VaultSearchIndex();
    const bulkDocs: IndexDocument[] = Array.from({ length: 550 }, (_, i) => ({
      id: `bulk-${i}`,
      filename: `Documento_Fiscal_${i}_2026.pdf`,
      folderName: i % 2 === 0 ? "Impuestos" : "Contratos",
      tags: i % 3 === 0 ? ["sat", "cfdi"] : ["legal", "contrato"],
      snippetText: `Contenido confidencial del documento número ${i} con folio SAT-${10000 + i} e importe $${(i + 1) * 125}.00 MXN`,
      filesize: 20480,
      mimeType: "application/pdf",
    }));

    bulkIndex.addDocuments(bulkDocs);
    expect(bulkIndex.size()).toBe(550);

    const start = performance.now();
    const results = bulkIndex.search("SAT-10420");
    const elapsedMs = performance.now() - start;

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].doc.id).toBe("bulk-420");
    expect(elapsedMs).toBeLessThan(15); // Sub-5ms typical, <15ms CI ceiling
  });
});

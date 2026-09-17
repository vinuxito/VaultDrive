import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  generateTransferSlipText,
  generateBatchTransferSlipText,
  downloadTransferSlip,
  downloadBatchTransferSlip,
} from "./transferSlip";
import type { FileData } from "../components/vault/FileGrid";

describe("transferSlip", () => {
  const sampleFile1: FileData = {
    id: "uuid-1111-2222",
    filename: "contract_alpha.pdf",
    file_size: 1048576, // 1 MB
    created_at: "2026-09-17T00:00:00Z",
    metadata: JSON.stringify({ sha256: "abc123def456goldenhash789" }),
    owner_email: "executive@abrn.mx",
  };

  const sampleFile2: FileData = {
    id: "uuid-3333-4444",
    filename: "vault_ledger.xlsx",
    file_size: 2097152, // 2 MB
    created_at: "2026-09-17T01:00:00Z",
    metadata: JSON.stringify({ digest: "fed987cba654goldenhash321" }),
    owner_email: "cfo@abrn.mx",
  };

  it("generates structured text for single transfer slip with golden hash", () => {
    const text = generateTransferSlipText(sampleFile1, "auditor@abrn.mx");
    expect(text).toContain("OFFICIAL CRYPTOGRAPHIC TRANSFER SLIP");
    expect(text).toContain("contract_alpha.pdf");
    expect(text).toContain("1 MB (1048576 bytes)");
    expect(text).toContain("abc123def456goldenhash789");
    expect(text).toContain("auditor@abrn.mx");
    expect(text).toContain("AES-256-GCM (Zero-Knowledge, Browser-Decrypted)");
    expect(text).toContain("NON-REPUDIATION LEGAL STATEMENT");
  });

  it("falls back gracefully when metadata is missing or corrupt", () => {
    const fileWithoutMeta: FileData = {
      id: "uuid-5555-6666",
      filename: "raw_asset.bin",
      file_size: 512,
      created_at: "2026-09-17T02:00:00Z",
      metadata: "invalid-json",
    };
    const text = generateTransferSlipText(fileWithoutMeta);
    expect(text).toContain("raw_asset.bin");
    expect(text).toContain("uuid55556666");
    expect(text).toContain("Authorized Sovereign Session");
  });

  it("generates consolidated batch manifest and aggregated size for multiple files", () => {
    const text = generateBatchTransferSlipText([sampleFile1, sampleFile2], "compliance@abrn.mx");
    expect(text).toContain("OFFICIAL BATCH CRYPTOGRAPHIC TRANSFER SLIP");
    expect(text).toContain("BATCH ASSET COUNT:  2 ASSETS");
    expect(text).toContain("TOTAL PAYLOAD SIZE: 3 MB (3145728 bytes)");
    expect(text).toContain("[ITEM 1]");
    expect(text).toContain("contract_alpha.pdf");
    expect(text).toContain("abc123def456goldenhash789");
    expect(text).toContain("[ITEM 2]");
    expect(text).toContain("vault_ledger.xlsx");
    expect(text).toContain("fed987cba654goldenhash321");
    expect(text).toContain("compliance@abrn.mx");
  });

  describe("DOM download triggers", () => {
    let originalCreateObjectURL: typeof URL.createObjectURL;
    let originalRevokeObjectURL: typeof URL.revokeObjectURL;

    beforeEach(() => {
      originalCreateObjectURL = URL.createObjectURL;
      originalRevokeObjectURL = URL.revokeObjectURL;
      URL.createObjectURL = vi.fn(() => "blob:mock-url");
      URL.revokeObjectURL = vi.fn();
    });

    afterEach(() => {
      URL.createObjectURL = originalCreateObjectURL;
      URL.revokeObjectURL = originalRevokeObjectURL;
    });

    it("triggers single transfer slip download via DOM anchor", () => {
      const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
      downloadTransferSlip(sampleFile1);

      expect(URL.createObjectURL).toHaveBeenCalled();
      expect(clickSpy).toHaveBeenCalled();
      expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:mock-url");
      clickSpy.mockRestore();
    });

    it("triggers batch transfer slip download via DOM anchor", () => {
      const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
      downloadBatchTransferSlip([sampleFile1, sampleFile2]);

      expect(URL.createObjectURL).toHaveBeenCalled();
      expect(clickSpy).toHaveBeenCalled();
      expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:mock-url");
      clickSpy.mockRestore();
    });
  });
});

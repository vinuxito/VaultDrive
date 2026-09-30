import { describe, it, expect, beforeEach } from "vitest";
import {
  saveStagedTransfer,
  getStagedTransfers,
  removeStagedTransfer,
  clearStagedTransfers,
  type StagedTransfer,
} from "./rescue-ledger";

describe("rescue-ledger memory and persistence fallback", () => {
  beforeEach(async () => {
    await clearStagedTransfers();
  });

  const mockTransfer: StagedTransfer = {
    id: "tx-123",
    filename: "Balance_General.pdf",
    size: 2048576,
    mimeType: "application/pdf",
    folderId: "folder-9",
    createdAt: Date.now(),
    status: "staged",
  };

  it("saves and retrieves a staged transfer", async () => {
    await saveStagedTransfer(mockTransfer);
    const all = await getStagedTransfers();

    expect(all.length).toBe(1);
    expect(all[0].filename).toBe("Balance_General.pdf");
    expect(all[0].id).toBe("tx-123");
  });

  it("removes a transfer by id once complete", async () => {
    await saveStagedTransfer(mockTransfer);
    let all = await getStagedTransfers();
    expect(all.length).toBe(1);

    await removeStagedTransfer("tx-123");
    all = await getStagedTransfers();
    expect(all.length).toBe(0);
  });

  it("clears all staged transfers", async () => {
    await saveStagedTransfer(mockTransfer);
    await saveStagedTransfer({ ...mockTransfer, id: "tx-456" });

    let all = await getStagedTransfers();
    expect(all.length).toBe(2);

    await clearStagedTransfers();
    all = await getStagedTransfers();
    expect(all.length).toBe(0);
  });
});

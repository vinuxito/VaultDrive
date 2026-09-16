import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { OfflineQueueReview } from "./OfflineQueueReview";

describe("OfflineQueueReview", () => {
  it("holds ownerless work and gives ambiguous deletes explicit choices", async () => {
    const onRetry = vi.fn();
    const onDiscard = vi.fn();
    render(
      <OfflineQueueReview
        currentOwnerId="owner-1"
        items={[
          { id: 1, type: "rename", file_id: "old", filename: "old.txt", new_filename: "new.txt", parent_hash: "h", updated_at: "now" },
          { id: 2, action_id: "delete-2", owner_id: "owner-1", status: "unknown", type: "delete", file_id: "file-2", filename: "secret.pdf", parent_hash: "h", updated_at: "now" },
        ]}
        onRetry={onRetry}
        onDiscard={onDiscard}
        onReconcileRename={vi.fn()}
      />,
    );

    expect(screen.getByText(/Older queued action.*will not be sent/i)).toBeInTheDocument();
    expect(screen.getByText(/server did not confirm whether.*secret.pdf/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Retry delete for secret.pdf/i }));
    expect(onRetry).toHaveBeenCalledWith(expect.objectContaining({ action_id: "delete-2" }));

    await userEvent.click(screen.getByRole("button", { name: "I resolved this" }));
    expect(onDiscard).toHaveBeenCalledWith(expect.objectContaining({ action_id: "delete-2", status: "unknown" }));
  });
});

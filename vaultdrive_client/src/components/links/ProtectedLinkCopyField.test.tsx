import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ProtectedLinkCopyField } from "./ProtectedLinkCopyField";

vi.mock("../../context/SessionVaultContext", () => ({
  useSessionVault: () => ({ getCredential: () => null }),
}));

describe("ProtectedLinkCopyField contrast", () => {
  it("uses semantic fields and actions even when a caller requests the legacy dark variant", async () => {
    render(
      <ProtectedLinkCopyField
        label="Upload URL"
        rawUrl="https://example.test/drop/token#key=secret"
        expectedPath="/drop/token"
        kind="upload-link"
        variant="dark"
        copyButtonLabel="Copy full upload link"
        guidanceText="Enter your PIN."
        onResolveUrl={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("Upload URL")).toHaveClass("bg-background", "text-foreground");
    expect(screen.getByRole("button", { name: "Copy full upload link" })).toHaveClass(
      "bg-primary",
      "text-primary-foreground",
    );

    await userEvent.click(screen.getByRole("button", { name: "Copy full upload link" }));
    expect(screen.getByLabelText("4-digit PIN")).toHaveClass("bg-background", "text-foreground");
  });
});

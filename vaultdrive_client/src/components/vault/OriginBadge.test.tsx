import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { OriginBadge } from "./OriginBadge";

describe("OriginBadge", () => {
  it("renders Vault label for my-upload", () => {
    render(<OriginBadge origin={{ type: "my-upload" }} />);
    expect(screen.getByText("Vault")).toBeInTheDocument();
  });

  it("renders Drop label for drop intake", () => {
    render(<OriginBadge origin={{ type: "drop", linkName: "Client Ingest" }} />);
    expect(screen.getByText("Drop: Client Ingest")).toBeInTheDocument();
  });
});

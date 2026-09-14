import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { FileSecurityTimeline } from "./FileSecurityTimeline";
import { TrustRail } from "./TrustRail";

describe("vault trust surfaces", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("keeps unavailable trust copy readable with every semantic skin", () => {
    render(<TrustRail fileId="file-one" />);

    expect(screen.getByText("Trust data is temporarily unavailable.")).toHaveClass("text-foreground");
    expect(screen.getByText("Your file remains encrypted and under your control.")).toHaveClass("text-muted-foreground");
  });

  it("keeps unavailable timeline copy readable with every semantic skin", () => {
    render(<FileSecurityTimeline fileId="file-one" />);

    expect(screen.getByText("Security history is temporarily unavailable.")).toHaveClass("text-foreground");
    expect(screen.getByText("The file remains protected; only the event feed could not be loaded.")).toHaveClass("text-muted-foreground");
  });
});

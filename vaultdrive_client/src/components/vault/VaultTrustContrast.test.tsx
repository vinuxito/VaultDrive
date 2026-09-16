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

    expect(screen.getByText("Access could not be checked. No access conclusion is available.")).toHaveClass("text-foreground");
    expect(screen.queryByText("Your file remains encrypted and under your control.")).not.toBeInTheDocument();
  });

  it("keeps unavailable timeline copy readable with every semantic skin", () => {
    render(<FileSecurityTimeline fileId="file-one" />);

    expect(screen.getByText("History could not be loaded. This does not establish whether access occurred.")).toHaveClass("text-foreground");
    expect(screen.queryByText("The file remains protected; only the event feed could not be loaded.")).not.toBeInTheDocument();
  });
});

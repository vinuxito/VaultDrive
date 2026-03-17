import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { CollapsibleSection } from "./CollapsibleSection";

describe("CollapsibleSection", () => {
  it("starts collapsed and reveals content when expanded", async () => {
    render(
      <CollapsibleSection title="Advanced docs">
        <div>Hidden content</div>
      </CollapsibleSection>,
    );

    expect(screen.queryByText("Hidden content")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /advanced docs/i }));

    expect(screen.getByText("Hidden content")).toBeInTheDocument();
  });
});

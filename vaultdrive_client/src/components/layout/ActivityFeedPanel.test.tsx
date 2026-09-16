import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ActivityFeedPanel } from "./ActivityFeedPanel";

describe("ActivityFeedPanel", () => {
  it("removes the closed panel from the accessibility tree", () => {
    render(<ActivityFeedPanel isOpen={false} onClose={vi.fn()} events={[]} />);

    expect(screen.queryByRole("dialog", { name: "Activity Feed" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Close activity feed" })).not.toBeInTheDocument();
  });

  it("exposes the open panel as a modal dialog", () => {
    render(<ActivityFeedPanel isOpen onClose={vi.fn()} events={[]} />);

    const panel = screen.getByRole("dialog", { name: "Activity Feed" });
    expect(panel).toHaveAttribute("aria-modal", "true");
    expect(screen.getByRole("button", { name: "Close activity feed" })).toBeInTheDocument();
    expect(document.querySelector("[aria-hidden='true']")).not.toHaveClass("md:hidden");
  });

  it("contains keyboard focus, closes with Escape, and returns focus to notifications", async () => {
    const user = userEvent.setup();

    function ActivityFeedHarness() {
      const [isOpen, setIsOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setIsOpen(true)}>
            Notifications
          </button>
          <ActivityFeedPanel isOpen={isOpen} onClose={() => setIsOpen(false)} events={[]} />
        </>
      );
    }

    render(<ActivityFeedHarness />);

    const notifications = screen.getByRole("button", { name: "Notifications" });
    await user.click(notifications);
    const close = screen.getByRole("button", { name: "Close activity feed" });
    expect(close).toHaveFocus();

    await user.tab();
    expect(close).toHaveFocus();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "Activity Feed" })).not.toBeInTheDocument();
    expect(notifications).toHaveFocus();
  });
});

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Trash2, Download, Share2 } from "lucide-react";

import { RowActionMenu, type RowAction } from "./row-action-menu";

function makeActions(overrides: Partial<RowAction>[] = []): RowAction[] {
  const base: RowAction[] = [
    { id: "share", label: "Share", icon: Share2, onSelect: vi.fn() },
    { id: "download", label: "Download", icon: Download, onSelect: vi.fn() },
    {
      id: "delete",
      label: "Delete",
      icon: Trash2,
      kind: "destructive",
      onSelect: vi.fn(),
    },
  ];
  for (const override of overrides) {
    const i = base.findIndex((a) => a.id === override.id);
    if (i >= 0) base[i] = { ...base[i], ...override };
  }
  return base;
}

describe("<RowActionMenu>", () => {
  it("renders nothing when actions is empty", () => {
    const { container } = render(<RowActionMenu actions={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders trigger with accessible label", () => {
    render(<RowActionMenu actions={makeActions()} triggerAriaLabel="File actions" />);
    expect(screen.getByRole("button", { name: /file actions/i })).toBeInTheDocument();
  });

  it("opens the menu and renders all actions on trigger click", async () => {
    const user = userEvent.setup();
    render(<RowActionMenu actions={makeActions()} />);
    await user.click(screen.getByRole("button", { name: /row actions/i }));
    expect(await screen.findByTestId("row-action-share")).toBeInTheDocument();
    expect(screen.getByTestId("row-action-download")).toBeInTheDocument();
    expect(screen.getByTestId("row-action-delete")).toBeInTheDocument();
  });

  it("invokes onSelect when an action is chosen", async () => {
    const user = userEvent.setup();
    const onShare = vi.fn();
    render(
      <RowActionMenu
        actions={makeActions([{ id: "share", onSelect: onShare }])}
      />,
    );
    await user.click(screen.getByRole("button", { name: /row actions/i }));
    await user.click(await screen.findByTestId("row-action-share"));
    expect(onShare).toHaveBeenCalledTimes(1);
  });

  it("flags destructive items with the destructive variant attribute", async () => {
    const user = userEvent.setup();
    render(<RowActionMenu actions={makeActions()} />);
    await user.click(screen.getByRole("button", { name: /row actions/i }));
    const deleteItem = await screen.findByTestId("row-action-delete");
    expect(deleteItem).toHaveAttribute("data-variant", "destructive");
  });

  it("disables disabled actions", async () => {
    const user = userEvent.setup();
    render(
      <RowActionMenu
        actions={makeActions([{ id: "download", disabled: true }])}
      />,
    );
    await user.click(screen.getByRole("button", { name: /row actions/i }));
    const item = await screen.findByTestId("row-action-download");
    expect(item).toHaveAttribute("data-disabled");
  });

  it("renders an optional menu label when provided", async () => {
    const user = userEvent.setup();
    render(<RowActionMenu actions={makeActions()} label="Manage file" />);
    await user.click(screen.getByRole("button", { name: /row actions/i }));
    expect(await screen.findByText("Manage file")).toBeInTheDocument();
  });

  describe("Mobile Drawer Viewport (< 640px)", () => {
    const originalInnerWidth = window.innerWidth;

    beforeEach(() => {
      Object.defineProperty(window, "innerWidth", {
        writable: true,
        configurable: true,
        value: 390,
      });
      window.dispatchEvent(new Event("resize"));
    });

    afterEach(() => {
      Object.defineProperty(window, "innerWidth", {
        writable: true,
        configurable: true,
        value: originalInnerWidth,
      });
      window.dispatchEvent(new Event("resize"));
      vi.restoreAllMocks();
    });

    it("renders as a bottom sheet drawer button under 640px", async () => {
      const user = userEvent.setup();
      render(<RowActionMenu actions={makeActions()} triggerTestId="test-trigger" />);

      const trigger = screen.getByRole("button", { name: /row actions/i });
      expect(trigger).toBeInTheDocument();

      await user.click(trigger);

      expect(await screen.findByTestId("test-trigger-content")).toBeInTheDocument();
      expect(screen.getByTestId("test-trigger-backdrop")).toBeInTheDocument();

      expect(screen.getByTestId("row-action-share")).toBeInTheDocument();
      expect(screen.getByTestId("row-action-download")).toBeInTheDocument();
      expect(screen.getByTestId("row-action-delete")).toBeInTheDocument();
    });

    it("closes the drawer when backdrop is clicked", async () => {
      const user = userEvent.setup();
      render(<RowActionMenu actions={makeActions()} triggerTestId="test-trigger" />);

      await user.click(screen.getByRole("button", { name: /row actions/i }));
      const backdrop = await screen.findByTestId("test-trigger-backdrop");

      await user.click(backdrop);

      expect(screen.queryByTestId("test-trigger-content")).not.toBeInTheDocument();
    });

    it("executes action on select and closes the drawer", async () => {
      const user = userEvent.setup();
      const onShare = vi.fn();
      render(
        <RowActionMenu
          actions={makeActions([{ id: "share", onSelect: onShare }])}
          triggerTestId="test-trigger"
        />,
      );

      await user.click(screen.getByRole("button", { name: /row actions/i }));
      const shareBtn = await screen.findByTestId("row-action-share");

      await user.click(shareBtn);
      expect(onShare).toHaveBeenCalledTimes(1);

      expect(screen.queryByTestId("test-trigger-content")).not.toBeInTheDocument();
    });
  });
});

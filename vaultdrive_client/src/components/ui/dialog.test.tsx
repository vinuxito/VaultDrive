import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ElegantModal } from "../elegant";
import { Dialog, DialogContent, DialogTitle } from "./dialog";

describe("dialog primitives", () => {
  it("gives ElegantModal dialog semantics, traps focus, and closes on Escape", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <ElegantModal isOpen onClose={onClose} title="Confirm access">
        <button type="button">Cancel</button>
        <button type="button">Confirm</button>
      </ElegantModal>,
    );

    expect(screen.getByRole("dialog", { name: "Confirm access" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Close Confirm access" })).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("makes the basic Dialog keyboard-operable", async () => {
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    render(
      <Dialog open onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogTitle>Move file</DialogTitle>
          <button type="button">Move</button>
        </DialogContent>
      </Dialog>,
    );

    expect(screen.getByRole("dialog", { name: "Move file" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Move" })).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("gives keyboard ownership to the topmost dialog and ignores hidden controls", async () => {
    const closeParent = vi.fn();
    const closeChild = vi.fn();
    const user = userEvent.setup();
    render(
      <>
        <ElegantModal isOpen onClose={closeParent} title="Parent dialog">
          <button type="button">Parent action</button>
        </ElegantModal>
        <ElegantModal isOpen onClose={closeChild} title="Child dialog">
          <div aria-hidden="true"><button type="button">Hidden action</button></div>
          <button type="button">Visible action</button>
        </ElegantModal>
      </>,
    );

    expect(screen.getByRole("button", { name: "Close Child dialog" })).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(closeChild).toHaveBeenCalledOnce();
    expect(closeParent).not.toHaveBeenCalled();
  });
});

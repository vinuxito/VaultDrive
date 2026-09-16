import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { VaultPrivacyShutter } from "./VaultPrivacyShutter";

describe("VaultPrivacyShutter", () => {
  it("does not render when isLocked is false", () => {
    const { container } = render(<VaultPrivacyShutter isLocked={false} onUnlock={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders privacy lock modal when isLocked is true and calls onScrubMemory", () => {
    const onScrubMemory = vi.fn();
    render(<VaultPrivacyShutter isLocked={true} onUnlock={vi.fn()} onScrubMemory={onScrubMemory} />);

    expect(screen.getByText("Vault Locked for Privacy")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /resume sovereign session/i })).toBeInTheDocument();
    expect(onScrubMemory).toHaveBeenCalled();
  });

  it("unlocks when resume button is clicked", async () => {
    const onUnlock = vi.fn();
    render(<VaultPrivacyShutter isLocked={true} onUnlock={onUnlock} />);

    await userEvent.click(screen.getByRole("button", { name: /resume sovereign session/i }));
    expect(onUnlock).toHaveBeenCalled();
  });
});

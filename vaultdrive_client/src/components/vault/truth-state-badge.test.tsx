import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { TruthStateBadge } from "./truth-state-badge";

describe("TruthStateBadge component", () => {
  it("renders sealed state with emerald styling", () => {
    render(<TruthStateBadge state="sealed" />);
    expect(screen.getByText("Blindado")).toBeDefined();
  });

  it("renders syncing state with animation", () => {
    render(<TruthStateBadge state="syncing" />);
    expect(screen.getByText("Subiendo...")).toBeDefined();
  });

  it("renders offline_safe state", () => {
    render(<TruthStateBadge state="offline_safe" />);
    expect(screen.getByText("A salvo en cel")).toBeDefined();
  });

  it("renders calculating state without false zeros", () => {
    render(<TruthStateBadge state="calculating" />);
    expect(screen.getByText("Calculando...")).toBeDefined();
    expect(screen.queryByText("0")).toBeNull();
  });

  it("displays custody receipt tooltip and triggers onClickReceipt on click", () => {
    const handleReceipt = vi.fn();
    render(<TruthStateBadge state="sealed" onClickReceipt={handleReceipt} />);

    const badge = screen.getByText("Blindado");
    fireEvent.click(badge);

    expect(handleReceipt).toHaveBeenCalledTimes(1);
    expect(
      screen.getByText("Cifrado en tu chip con AES-256 y sellado en el servidor.")
    ).toBeDefined();
  });
});

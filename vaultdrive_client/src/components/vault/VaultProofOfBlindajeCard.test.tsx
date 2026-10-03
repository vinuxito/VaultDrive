import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { VaultProofOfBlindajeCard } from "./VaultProofOfBlindajeCard";

describe("VaultProofOfBlindajeCard", () => {
  it("renders empty vault proof card with call to action", () => {
    const onUploadClick = vi.fn();
    render(<VaultProofOfBlindajeCard onUploadClick={onUploadClick} />);

    expect(screen.getByText("Tu Bóveda está Lista y Vaciada")).toBeInTheDocument();
    expect(screen.getByText(/⚡ Probar Blindaje en Vivo/)).toBeInTheDocument();
    expect(screen.getByText("Subir mi primer archivo blindado")).toBeInTheDocument();
  });

  it("calls onUploadClick when upload button is clicked", () => {
    const onUploadClick = vi.fn();
    render(<VaultProofOfBlindajeCard onUploadClick={onUploadClick} />);

    fireEvent.click(screen.getByText("Subir mi primer archivo blindado"));
    expect(onUploadClick).toHaveBeenCalled();
  });
});

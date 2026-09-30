import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { BottomSheet } from "./bottom-sheet";

describe("BottomSheet component", () => {
  it("does not render when isOpen is false", () => {
    render(
      <BottomSheet isOpen={false} onClose={vi.fn()}>
        <div>Content</div>
      </BottomSheet>
    );

    expect(screen.queryByText("Content")).toBeNull();
  });

  it("renders title, description and children when isOpen is true", () => {
    render(
      <BottomSheet
        isOpen={true}
        onClose={vi.fn()}
        title="Opciones de archivo"
        description="Elige una acción"
      >
        <div>Contenido del fondo</div>
      </BottomSheet>
    );

    expect(screen.getByText("Opciones de archivo")).toBeDefined();
    expect(screen.getByText("Elige una acción")).toBeDefined();
    expect(screen.getByText("Contenido del fondo")).toBeDefined();
  });

  it("calls onClose when Escape key is pressed", () => {
    const handleClose = vi.fn();
    render(
      <BottomSheet isOpen={true} onClose={handleClose}>
        <div>Modal content</div>
      </BottomSheet>
    );

    fireEvent.keyDown(window, { key: "Escape" });
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when close button is clicked", () => {
    const handleClose = vi.fn();
    render(
      <BottomSheet isOpen={true} onClose={handleClose}>
        <div>Modal content</div>
      </BottomSheet>
    );

    const closeBtn = screen.getByLabelText("Cerrar");
    fireEvent.click(closeBtn);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});

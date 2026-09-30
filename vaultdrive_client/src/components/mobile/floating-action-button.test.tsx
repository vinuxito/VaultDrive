import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { FloatingActionButton } from "./floating-action-button";

describe("FloatingActionButton component", () => {
  it("renders the primary action button closed by default", () => {
    render(
      <FloatingActionButton
        onUploadClick={vi.fn()}
        onNewFolderClick={vi.fn()}
      />
    );

    const trigger = screen.getByLabelText("Crear o subir archivo");
    expect(trigger).toBeDefined();
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByText("Subir Archivo")).toBeNull();
  });

  it("expands speed dial menu when clicked", () => {
    render(
      <FloatingActionButton
        onUploadClick={vi.fn()}
        onNewFolderClick={vi.fn()}
      />
    );

    const trigger = screen.getByLabelText("Crear o subir archivo");
    fireEvent.click(trigger);

    expect(screen.getByText("Subir Archivo")).toBeDefined();
    expect(screen.getByText("Nueva Carpeta")).toBeDefined();
  });

  it("triggers onUploadClick and closes menu when upload is selected", () => {
    const handleUpload = vi.fn();
    render(
      <FloatingActionButton
        onUploadClick={handleUpload}
        onNewFolderClick={vi.fn()}
      />
    );

    fireEvent.click(screen.getByLabelText("Crear o subir archivo"));
    fireEvent.click(screen.getByLabelText("Subir Archivo"));

    expect(handleUpload).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Subir Archivo")).toBeNull();
  });

  it("triggers onNewFolderClick and closes menu when folder is selected", () => {
    const handleNewFolder = vi.fn();
    render(
      <FloatingActionButton
        onUploadClick={vi.fn()}
        onNewFolderClick={handleNewFolder}
      />
    );

    fireEvent.click(screen.getByLabelText("Crear o subir archivo"));
    fireEvent.click(screen.getByLabelText("Nueva Carpeta"));

    expect(handleNewFolder).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Nueva Carpeta")).toBeNull();
  });
});

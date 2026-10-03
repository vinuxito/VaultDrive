import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MobileShareSheet } from "./MobileShareSheet";
import { SessionVaultProvider } from "../../context/SessionVaultContext";

describe("MobileShareSheet", () => {
  const sampleFile = {
    id: "file-123",
    filename: "Balance_General_2026.pdf",
    metadata: JSON.stringify({ credential_scheme: "pin" }),
    pin_wrapped_key: null,
    is_owner: true,
  };

  it("renders when open and shows filename and trust badge", () => {
    render(
      <SessionVaultProvider>
        <MobileShareSheet
          isOpen={true}
          onClose={vi.fn()}
          file={sampleFile}
        />
      </SessionVaultProvider>
    );

    expect(screen.getByText("Compartir Archivo Seguro")).toBeInTheDocument();
    expect(screen.getByText(/Balance_General_2026\.pdf/)).toBeInTheDocument();
    expect(screen.getByText(/La llave de apertura viaja en el enlace/)).toBeInTheDocument();
  });

  it("does not render when closed", () => {
    const { container } = render(
      <SessionVaultProvider>
        <MobileShareSheet
          isOpen={false}
          onClose={vi.fn()}
          file={sampleFile}
        />
      </SessionVaultProvider>
    );

    expect(container).toBeEmptyDOMElement();
  });
});

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { WhatsAppDropRequestModal } from "./WhatsAppDropRequestModal";

vi.mock("../../context/SessionVaultContext", () => ({
  useSessionVault: () => ({
    getCredential: () => ({ type: "pin", value: "1234" }),
    setCredential: vi.fn(),
  }),
}));

vi.mock("../../context/ToastContext", () => ({
  useToast: () => ({
    addToast: vi.fn(),
  }),
}));

describe("WhatsAppDropRequestModal", () => {
  it("renders accountant checklist, marks already-received files, and copies existing active Secure Drop link", async () => {
    const onClose = vi.fn();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: { writeText },
    });

    render(
      <WhatsAppDropRequestModal
        isOpen={true}
        onClose={onClose}
        clientName="Grupo Roche SA de CV"
        folderId="fol-roche"
        existingFiles={[
          {
            id: "file-csf",
            filename: "Constancia_Situacion_Fiscal_Roche_2026.pdf",
            file_size: 420000,
            created_at: new Date().toISOString(),
            metadata: "{}",
          },
        ]}
        existingDropTokens={[
          {
            id: "drop-1",
            token: "roche-nov-9f41c",
            link_name: "Buzón Mensual — Grupo Roche SA de CV",
          },
        ]}
      />
    );

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Solicitar Documentos por WhatsApp")).toBeInTheDocument();
    expect(screen.getByText("Ya recibido")).toBeInTheDocument();
    expect(screen.getByText(/\/drop\/roche-nov-9f41c/i)).toBeInTheDocument();

    // Toggle CLABE item on and verify bullet preview updates
    await userEvent.click(screen.getByTestId("drop-check-clabe"));
    expect(screen.getByText(/• Carátula Bancaria con CLABE visible/i)).toBeInTheDocument();

    // Copy Drop Link
    await userEvent.click(screen.getByTestId("drop-modal-copy-btn"));
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining("/drop/roche-nov-9f41c"));
  });
});

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TrashSection } from "./TrashSection";

const trashedPayload = {
  folders: [
    {
      id: "fol-1",
      name: "CFDI 2025 Vencidos",
      deleted_at: "2026-11-15T15:00:00Z",
      deleted_by_actor_type: "human_jwt",
      deleted_reason: "Cierre anual archivado",
      created_at: "2026-01-10T10:00:00Z",
    },
  ],
  files: [
    {
      id: "file-1",
      filename: "factura-duplicada.xml",
      file_size: 4096,
      deleted_at: "2026-11-15T15:30:00Z",
      deleted_by_actor_type: "agent_delete_key",
      deleted_by_key_name: "Robot Limpieza",
      deleted_by_key_prefix: "abrnak_del_99",
      deleted_reason: "Duplicado detectado",
      created_at: "2026-11-01T10:00:00Z",
      updated_at: "2026-11-15T15:30:00Z",
    },
  ],
};

describe("TrashSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    localStorage.setItem("token", "human-jwt-token");
  });

  it("displays agent_delete_key attribution and restores / permanently purges items", async () => {
    const user = userEvent.setup();
    const onRestored = vi.fn();
    const onCountChange = vi.fn();
    let currentPayload = structuredClone(trashedPayload);

    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";

      if (url.endsWith("/trash") && method === "GET") {
        return new Response(JSON.stringify(currentPayload), { status: 200 });
      }
      if (url.endsWith("/trash/files/file-1/restore") && method === "POST") {
        currentPayload.files = [];
        return new Response(JSON.stringify({ restored: true }), { status: 200 });
      }
      if (url.endsWith("/trash/folders/fol-1") && method === "DELETE") {
        currentPayload.folders = [];
        return new Response(JSON.stringify({ purged: true }), { status: 200 });
      }
      throw new Error(`Unexpected request: ${method} ${url}`);
    }) as typeof fetch;

    render(<TrashSection onRestored={onRestored} onCountChange={onCountChange} />);

    expect(await screen.findByText("factura-duplicada.xml")).toBeInTheDocument();
    expect(screen.getByText(/Llave Solo Papelera: Robot Limpieza/)).toBeInTheDocument();
    expect(screen.getByText("abrnak_del_99")).toBeInTheDocument();
    expect(screen.getByText("Duplicado detectado")).toBeInTheDocument();
    expect(onCountChange).toHaveBeenCalledWith(2);

    await user.click(screen.getByRole("button", { name: /^Restaurar$/i }));
    await waitFor(() => {
      expect(screen.getByText(/"factura-duplicada.xml" volvió a tu bóveda tal como estaba\./)).toBeInTheDocument();
    });
    expect(onRestored).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: /Eliminar para siempre/i }));
    await user.click(screen.getByRole("button", { name: /Confirmar borrado definitivo/i }));
    await waitFor(() => {
      expect(screen.getByText(/"CFDI 2025 Vencidos" se borró para siempre del servidor\./)).toBeInTheDocument();
    });
    expect(onCountChange).toHaveBeenLastCalledWith(0);
  });

  it("degrades gracefully when backend returns 404", async () => {
    globalThis.fetch = vi.fn(async () => new Response("not found", { status: 404 })) as typeof fetch;

    render(<TrashSection />);

    expect(
      await screen.findByText(/La Papelera recuperable se activará cuando este servidor esté corriendo/)
    ).toBeInTheDocument();
  });
});

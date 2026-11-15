import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AgentApiKeysSection } from "./AgentApiKeysSection";

describe("AgentApiKeysSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    localStorage.setItem("token", "human-jwt");
  });

  it("renders standard vs Special Delete-Only badges and creates a delete_only key without other scopes", async () => {
    const user = userEvent.setup();
    let createdPayload: Record<string, unknown> | null = null;

    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";

      if (url.endsWith("/folders") && method === "GET") {
        return new Response(JSON.stringify([]), { status: 200 });
      }

      if (url.endsWith("/v1/agent-keys") && method === "GET") {
        return new Response(
          JSON.stringify({
            success: true,
            data: [
              {
                id: "k-std",
                name: "Sync Contable",
                key_prefix: "abrnak_std1",
                key_kind: "standard",
                scopes: ["files:list", "files:upload_ciphertext"],
                status: "active",
                created_at: "2026-11-15T10:00:00Z",
                usage_count: 4,
              },
            ],
          }),
          { status: 200 }
        );
      }

      if (url.endsWith("/v1/agent-keys") && method === "POST") {
        createdPayload = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
        return new Response(
          JSON.stringify({
            success: true,
            data: {
              id: "k-del",
              name: createdPayload.name,
              key_prefix: "abrnak_del_abc",
              key_kind: "delete_only",
              scopes: ["files:soft_delete"],
              status: "active",
              created_at: "2026-11-15T12:00:00Z",
              usage_count: 0,
              plaintext_key: "abrnak_del_abc_secret_value",
            },
          }),
          { status: 201 }
        );
      }

      throw new Error(`Unexpected request: ${method} ${url}`);
    }) as typeof fetch;

    render(<AgentApiKeysSection />);

    expect(await screen.findByText("Sync Contable")).toBeInTheDocument();
    expect(screen.getByText("Estándar · Nunca borra")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Nueva llave/i }));
    await user.click(screen.getByTestId("key-kind-delete-only"));
    expect(screen.getByText(/Alcance único fijo: Solo mover a Papelera/)).toBeInTheDocument();

    await user.type(screen.getByLabelText("Nombre de la llave"), "Limpieza Nocturna");
    await user.click(screen.getByRole("button", { name: /Crear llave Solo Papelera/i }));

    await waitFor(() => {
      expect(screen.getByText(/Llave especial Solo Papelera lista/)).toBeInTheDocument();
    });

    expect(createdPayload).toMatchObject({
      name: "Limpieza Nocturna",
      key_kind: "delete_only",
      scopes: ["files:soft_delete"],
    });

    await user.click(screen.getByRole("checkbox", { name: /Ya guardé esta llave/i }));
    await user.click(screen.getByRole("button", { name: /^Listo$/i }));

    expect(await screen.findByText("Solo Papelera · 100% recuperable")).toBeInTheDocument();
  });

  it("configures folder jailing, IP allowlist, and rate-limit RPM guardrails cleanly", async () => {
    const user = userEvent.setup();
    let createdPayload: Record<string, unknown> | null = null;

    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";

      if (url.endsWith("/folders") && method === "GET") {
        return new Response(
          JSON.stringify([
            { id: "fld-1", name: "Facturas", parentId: null },
            { id: "fld-2", name: "2026", parentId: "fld-1" },
          ]),
          { status: 200 }
        );
      }

      if (url.endsWith("/v1/agent-keys") && method === "GET") {
        return new Response(JSON.stringify({ success: true, data: [] }), { status: 200 });
      }

      if (url.endsWith("/v1/agent-keys") && method === "POST") {
        createdPayload = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
        return new Response(
          JSON.stringify({
            success: true,
            data: {
              id: "k-guarded",
              name: createdPayload.name,
              key_prefix: "abrnak_guard",
              key_kind: "standard",
              scopes: createdPayload.scopes,
              allowed_folder_ids: createdPayload.allowed_folder_ids,
              allowed_ips: createdPayload.allowed_ips,
              rate_limit_rpm: createdPayload.rate_limit_rpm,
              status: "active",
              created_at: "2026-11-15T12:00:00Z",
              usage_count: 0,
              plaintext_key: "abrnak_guard_secret_value",
            },
          }),
          { status: 201 }
        );
      }

      throw new Error(`Unexpected request: ${method} ${url}`);
    }) as typeof fetch;

    render(<AgentApiKeysSection />);
    await user.click(await screen.findByRole("button", { name: /Nueva llave/i }));

    await user.type(screen.getByLabelText("Nombre de la llave"), "Facturador Enjaulado");
    await user.click(screen.getByRole("checkbox", { name: "Facturas → 2026" }));
    expect(screen.getByText("Carpeta limitada")).toBeInTheDocument();

    await user.type(screen.getByLabelText("IPs o redes permitidas (opcional)"), "10.20.0.0/16");
    await user.click(screen.getByRole("button", { name: "120" }));
    await user.click(screen.getByRole("button", { name: /Crear llave$/i }));

    await waitFor(() => {
      expect(createdPayload).toMatchObject({
        name: "Facturador Enjaulado",
        allowed_folder_ids: ["fld-2"],
        allowed_ips: ["10.20.0.0/16"],
        rate_limit_rpm: 120,
      });
    });

    await user.click(screen.getByRole("checkbox", { name: /Ya guardé esta llave/i }));
    await user.click(screen.getByRole("button", { name: /^Listo$/i }));

    expect(await screen.findByText(/Carpeta limitada · 1/)).toBeInTheDocument();
    expect(screen.getByText(/IP fija · 1/)).toBeInTheDocument();
    expect(screen.getByText(/120 req\/min/)).toBeInTheDocument();
  });
});

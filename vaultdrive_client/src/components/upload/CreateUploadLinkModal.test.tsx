import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CreateUploadLinkModal } from "./CreateUploadLinkModal";

const getCredential = vi.fn();

vi.mock("../../context/SessionVaultContext", () => ({
  useSessionVault: () => ({ getCredential }),
}));

describe("CreateUploadLinkModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    localStorage.setItem("token", "session-token");

    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url.endsWith("/folders")) {
        if (init?.method === "POST") {
          return new Response(JSON.stringify({ id: "folder-2", name: "Clients" }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }

        return new Response(JSON.stringify([{ id: "folder-1", name: "Inbox" }]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (url.endsWith("/drop/create")) {
        return new Response(JSON.stringify({ upload_url: "/abrn/drop/abc#key=secret" }), {
          status: 201,
          headers: { "Content-Type": "application/json" },
        });
      }

      throw new Error(`Unhandled fetch: ${url}`);
    }) as typeof fetch;
  });

  it("uses the cached pin for secure drop creation without asking again", async () => {
    getCredential.mockReturnValue({ type: "pin", value: "1234" });

    render(<CreateUploadLinkModal open={true} onClose={() => undefined} />);

    await screen.findByText("Inbox");

    expect(screen.queryByLabelText(/your 4-digit pin/i)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /create link/i }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/drop/create"),
        expect.objectContaining({ method: "POST" }),
      );
    });

    const dropCall = vi.mocked(fetch).mock.calls.find(([url]) =>
      String(url).includes("/drop/create"),
    );
    expect(dropCall).toBeDefined();

    const body = JSON.parse(String(dropCall?.[1]?.body ?? "{}")) as { pin?: string };
    expect(body.pin).toBe("1234");
  });
});

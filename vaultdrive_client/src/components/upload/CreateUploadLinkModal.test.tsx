import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CreateUploadLinkModal } from "./CreateUploadLinkModal";

const getCredential = vi.fn();
const setCredential = vi.fn();
const clipboardWriteText = vi.fn();

vi.mock("../../context/SessionVaultContext", () => ({
  useSessionVault: () => ({ getCredential, setCredential }),
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

        return new Response(JSON.stringify([
          { id: "folder-1", name: "Inbox" },
          { id: "folder-2", name: "Client Inbox" },
        ]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (url.endsWith("/drop/create")) {
        return new Response(JSON.stringify({ upload_url: "/quantix/drop/abc#key=secret" }), {
          status: 201,
          headers: { "Content-Type": "application/json" },
        });
      }

      throw new Error(`Unhandled fetch: ${url}`);
    }) as typeof fetch;

    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: clipboardWriteText },
      configurable: true,
    });
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

    expect(await screen.findByText(/underlying api call/i)).toBeInTheDocument();
    expect(screen.getByText("POST /api/drop/create")).toBeInTheDocument();
  });

  it("preselects the target folder and shows guidance context when opened from an empty folder handoff", async () => {
    getCredential.mockReturnValue({ type: "pin", value: "1234" });

    render(
      <CreateUploadLinkModal
        open={true}
        onClose={() => undefined}
        initialFolderId="folder-2"
        initialFolderName="Client Inbox"
        introMessage="Use this link when you want someone else to upload files into Client Inbox."
      />,
    );

    await screen.findByText("Inbox");

    expect(screen.getByText(/someone else to upload files into Client Inbox/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/destination folder/i)).toHaveValue("folder-2");
  });

  it("keeps the created upload URL masked until the correct PIN is entered for copy", async () => {
    getCredential.mockReturnValue({ type: "pin", value: "1234" });

    render(<CreateUploadLinkModal open={true} onClose={() => undefined} />);

    await screen.findByText("Inbox");
    await userEvent.click(screen.getByRole("button", { name: /create link/i }));

    expect(await screen.findByDisplayValue(/#key=••••••••/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /copy full upload link/i }));
    await userEvent.type(await screen.findByLabelText(/4-digit pin/i), "0000");
    await userEvent.click(screen.getByRole("button", { name: /verify pin and copy/i }));

    expect(await screen.findByText(/that pin didn't match/i)).toBeInTheDocument();
    expect(clipboardWriteText).not.toHaveBeenCalled();

    await userEvent.type(screen.getByLabelText(/4-digit pin/i), "1234");
    await userEvent.click(screen.getByRole("button", { name: /verify pin and copy/i }));

    await waitFor(() => {
      expect(clipboardWriteText).toHaveBeenCalledWith("/quantix/drop/abc#key=secret");
    });
    expect(screen.getByText("Copied!")).toBeInTheDocument();
  });

  it("falls back to manual copy when clipboard write is denied after PIN verification", async () => {
    getCredential.mockReturnValue({ type: "pin", value: "1234" });
    clipboardWriteText.mockRejectedValueOnce(new Error("Write permission denied"));

    render(<CreateUploadLinkModal open={true} onClose={() => undefined} />);

    await screen.findByText("Inbox");
    await userEvent.click(screen.getByRole("button", { name: /create link/i }));

    await screen.findByDisplayValue(/#key=••••••••/i);
    await userEvent.click(screen.getByRole("button", { name: /copy full upload link/i }));
    await userEvent.type(await screen.findByLabelText(/4-digit pin/i), "1234");
    await userEvent.click(screen.getByRole("button", { name: /verify pin and copy/i }));

    expect(await screen.findByText(/clipboard is unavailable/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue("/quantix/drop/abc#key=secret")).toBeInTheDocument();
  });
});

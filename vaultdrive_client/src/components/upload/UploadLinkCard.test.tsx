import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { UploadLinkCard } from "./UploadLinkCard";
import type { UploadTokenWithFiles } from "./types";

vi.mock("../../context/SessionVaultContext", () => ({
  useSessionVault: () => ({
    getCredential: () => null,
    setCredential: () => null,
  }),
}));

const clipboardWriteText = vi.fn();

const baseToken: UploadTokenWithFiles = {
  id: "upload-link-1",
  token: "drop-token-1",
  upload_url: "/quantix/drop/drop-token-1",
  expires_at: null,
  max_files: null,
  files_uploaded: 0,
  used: false,
  created_at: "2026-04-10T10:00:00.000Z",
  folder_name: "Client Intake",
};

describe("UploadLinkCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    localStorage.setItem("token", "session-token");
    Object.assign(window, {
      location: {
        ...window.location,
        origin: "https://quantixdrive.example.com",
      },
    });

    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: clipboardWriteText },
      configurable: true,
    });

    globalThis.fetch = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as { pin?: string };

      if (body.pin === "1234") {
        return new Response(JSON.stringify({ encryption_key: "secret-key" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ error: "Wrong PIN. Try again." }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch;
  });

  it("blocks copy until the correct PIN is entered and then copies the full URL", async () => {
    render(
      <UploadLinkCard
        token={baseToken}
        isExpanded={false}
        status={{ label: "Active", variant: "default" }}
        onExpand={vi.fn()}
        onDeactivate={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.getByDisplayValue(/#key=••••••••/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /copy full upload link/i }));

    const pinInput = await screen.findByLabelText(/4-digit pin/i);
    await userEvent.type(pinInput, "0000");
    await userEvent.click(screen.getByRole("button", { name: /verify pin and copy/i }));

    await waitFor(() => {
      expect(screen.getByText(/wrong pin/i)).toBeInTheDocument();
    });
    expect(clipboardWriteText).not.toHaveBeenCalled();
    expect(screen.getByLabelText(/4-digit pin/i)).toHaveValue("");

    await userEvent.type(screen.getByLabelText(/4-digit pin/i), "1234");
    await userEvent.click(screen.getByRole("button", { name: /verify pin and copy/i }));

    await waitFor(() => {
      expect(clipboardWriteText).toHaveBeenCalledWith(
        "https://quantixdrive.example.com/quantix/drop/drop-token-1#key=secret-key",
      );
    });
    expect(screen.getAllByText("Copied!").length).toBeGreaterThan(0);
  });

  it("invokes onDeactivate when Seal route is chosen from the row action menu", async () => {
    const onDeactivate = vi.fn();
    const onDelete = vi.fn();
    render(
      <UploadLinkCard
        token={baseToken}
        isExpanded={false}
        status={{ label: "Active", variant: "default" }}
        onExpand={vi.fn()}
        onDeactivate={onDeactivate}
        onDelete={onDelete}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /upload link actions/i }));
    await userEvent.click(await screen.findByTestId("row-action-seal-route"));

    expect(onDeactivate).toHaveBeenCalledTimes(1);
    expect(onDelete).not.toHaveBeenCalled();
  });

  it("invokes onDelete when Remove route (destructive) is chosen", async () => {
    const onDeactivate = vi.fn();
    const onDelete = vi.fn();
    render(
      <UploadLinkCard
        token={baseToken}
        isExpanded={false}
        status={{ label: "Active", variant: "default" }}
        onExpand={vi.fn()}
        onDeactivate={onDeactivate}
        onDelete={onDelete}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /upload link actions/i }));
    const remove = await screen.findByTestId("row-action-remove-route");
    expect(remove).toHaveAttribute("data-variant", "destructive");
    await userEvent.click(remove);

    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onDeactivate).not.toHaveBeenCalled();
  });

  it("hides Seal route when the link is already used (sealed)", async () => {
    render(
      <UploadLinkCard
        token={{ ...baseToken, used: true }}
        isExpanded={false}
        status={{ label: "Inactive", variant: "secondary" }}
        onExpand={vi.fn()}
        onDeactivate={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /upload link actions/i }));
    expect(screen.queryByTestId("row-action-seal-route")).not.toBeInTheDocument();
    expect(await screen.findByTestId("row-action-remove-route")).toBeInTheDocument();
  });
});

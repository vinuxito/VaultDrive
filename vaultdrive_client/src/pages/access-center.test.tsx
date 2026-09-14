import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import AccessCenter from "./access-center";

const recoveryMocks = vi.hoisted(() => ({
  recoverVerifiedOwnerFileKey: vi.fn(),
}));

const sessionVaultMocks = vi.hoisted(() => ({
  getFileKey: vi.fn(),
  getFolderKey: vi.fn(),
  getPrivateKey: vi.fn(),
  setFileKey: vi.fn(),
}));

const ownerPrivateKeyMocks = vi.hoisted(() => ({
  resolveOwnerPrivateKeyFromSession: vi.fn(),
}));

const cryptoMocks = vi.hoisted(() => ({
  unwrapKeyWithRSA: vi.fn(),
  arrayBufferToBase64: vi.fn(),
}));

vi.mock("../utils/access-link-recovery", () => ({
  recoverVerifiedOwnerFileKey: recoveryMocks.recoverVerifiedOwnerFileKey,
}));

vi.mock("../context/SessionVaultContext", () => ({
  useSessionVault: () => sessionVaultMocks,
}));

vi.mock("../utils/owner-private-key", () => ({
  resolveOwnerPrivateKeyFromSession: ownerPrivateKeyMocks.resolveOwnerPrivateKeyFromSession,
}));

vi.mock("../utils/crypto", async () => {
  const actual = await vi.importActual<typeof import("../utils/crypto")>("../utils/crypto");
  return {
    ...actual,
    unwrapKeyWithRSA: cryptoMocks.unwrapKeyWithRSA,
    arrayBufferToBase64: cryptoMocks.arrayBufferToBase64,
  };
});

vi.mock("../components/layout/dashboard-layout", () => ({
  DashboardLayout: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="unexpected-dashboard-layout">{children}</div>
  ),
}));

const share = {
  id: "share-1",
  type: "file",
  token: "share-token",
  resource_name: "proposal.pdf",
  resource_id: "file-1",
  is_active: true,
  created_at: "2026-09-14T12:00:00Z",
  access_count: 0,
  status: "active",
};

const drop = {
  id: "drop-1",
  token: "drop-token",
  link_name: "Client intake",
  files_uploaded: 1,
  used: false,
  created_at: "2026-09-14T12:00:00Z",
  has_password: false,
};

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("AccessCenter truthful source states", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    localStorage.clear();
    localStorage.setItem("token", "session-token");
    localStorage.setItem("user", JSON.stringify({ pin_set: true }));
    recoveryMocks.recoverVerifiedOwnerFileKey.mockResolvedValue({
      key: {} as CryptoKey,
      fragment: "verified-file-key",
    });
    sessionVaultMocks.getFileKey.mockReturnValue(null);
    sessionVaultMocks.getFolderKey.mockReturnValue(null);
    sessionVaultMocks.getPrivateKey.mockReturnValue(null);
    ownerPrivateKeyMocks.resolveOwnerPrivateKeyFromSession.mockResolvedValue({} as CryptoKey);
    cryptoMocks.unwrapKeyWithRSA.mockResolvedValue({} as CryptoKey);
    cryptoMocks.arrayBufferToBase64.mockReturnValue("verified-folder-key");
  });

  it("keeps a successful source visible while the other source offers retry", async () => {
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/v1/shares")) return jsonResponse([share]);
      if (url.endsWith("/drop/tokens")) return jsonResponse({ message: "unavailable" }, 503);
      throw new Error(`Unhandled fetch: ${url}`);
    }) as typeof fetch;

    render(
      <MemoryRouter>
        <AccessCenter />
      </MemoryRouter>,
    );

    expect(await screen.findByText("proposal.pdf")).toBeInTheDocument();
    expect(screen.getByText("Drop routes are unavailable.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try drop routes again" })).toBeInTheDocument();
    expect(screen.queryByText("No access grants match this filter.")).not.toBeInTheDocument();
  });

  it("preserves loaded data and marks only the failed refreshed source stale", async () => {
    let dropRequests = 0;
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/v1/shares")) return jsonResponse([share]);
      if (url.endsWith("/drop/tokens")) {
        dropRequests += 1;
        return dropRequests === 1
          ? jsonResponse([drop])
          : jsonResponse({ message: "unavailable" }, 503);
      }
      throw new Error(`Unhandled fetch: ${url}`);
    }) as typeof fetch;

    render(
      <MemoryRouter>
        <AccessCenter />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Client intake")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Refresh drop routes" }));

    expect(await screen.findByText("Drop routes may be out of date.")).toBeInTheDocument();
    expect(screen.getByText("Client intake")).toBeInTheDocument();
    expect(screen.getByText("proposal.pdf")).toBeInTheDocument();
    const shareCard = screen.getByText("proposal.pdf").closest("div.rounded-xl");
    expect(within(shareCard as HTMLElement).getByRole("button", { name: "Copy full link" })).toBeEnabled();
  });

  it("does not render its own authenticated application shell", async () => {
    globalThis.fetch = vi.fn(async () => jsonResponse([])) as typeof fetch;

    render(
      <MemoryRouter>
        <AccessCenter />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.queryByText("Loading access data…")).not.toBeInTheDocument());
    expect(screen.queryByTestId("unexpected-dashboard-layout")).not.toBeInTheDocument();
  });

  it("describes an inactive drop route as closed rather than inventing revocation", async () => {
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/v1/shares")) return jsonResponse([]);
      if (url.endsWith("/drop/tokens")) return jsonResponse([{ ...drop, is_active: false }]);
      throw new Error(`Unhandled fetch: ${url}`);
    }) as typeof fetch;

    render(
      <MemoryRouter>
        <AccessCenter />
      </MemoryRouter>,
    );

    const card = (await screen.findByText("Client intake")).closest("div.rounded-xl");
    expect(card).not.toBeNull();
    expect(within(card as HTMLElement).getByText("Closed")).toBeInTheDocument();
    expect(within(card as HTMLElement).queryByText("Revoked")).not.toBeInTheDocument();
  });

  it("does not present an unrecognized server status as active", async () => {
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/v1/shares")) return jsonResponse([{ ...share, status: "unexpected" }]);
      if (url.endsWith("/drop/tokens")) return jsonResponse([]);
      throw new Error(`Unhandled fetch: ${url}`);
    }) as typeof fetch;

    render(
      <MemoryRouter>
        <AccessCenter />
      </MemoryRouter>,
    );

    const card = (await screen.findByText("proposal.pdf")).closest("div.rounded-xl");
    expect(card).not.toBeNull();
    expect(within(card as HTMLElement).getByText("Unknown")).toBeInTheDocument();
    expect(within(card as HTMLElement).queryByText("Active")).not.toBeInTheDocument();
  });

  it("asks for the file credential and copies only the complete verified file URL", async () => {
    const clipboardWriteText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: clipboardWriteText },
    });

    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/v1/shares")) return jsonResponse([share]);
      if (url.endsWith("/drop/tokens")) return jsonResponse([]);
      if (url.endsWith("/files")) {
        return jsonResponse([{
          id: "file-1",
          filename: "proposal.pdf",
          metadata: JSON.stringify({ credential_scheme: "pin", iv: "iv", salt: "salt" }),
          is_owner: true,
        }]);
      }
      if (url.endsWith("/files/file-1/download")) {
        return new Response(new Uint8Array([1, 2, 3]), { status: 200 });
      }
      throw new Error(`Unhandled fetch: ${url}`);
    }) as typeof fetch;

    render(
      <MemoryRouter>
        <AccessCenter />
      </MemoryRouter>,
    );

    const card = (await screen.findByText("proposal.pdf")).closest("div.rounded-xl");
    expect(card).not.toBeNull();
    await userEvent.click(within(card as HTMLElement).getByRole("button", { name: "Copy full link" }));
    expect(await screen.findByRole("dialog", { name: "Recover file share link" })).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText("Current PIN"), "1111");
    await userEvent.click(screen.getByRole("button", { name: "Verify and copy" }));

    await waitFor(() => expect(clipboardWriteText).toHaveBeenCalledWith(
      "http://localhost:3000/quantix/share/share-token#verified-file-key",
    ));
    expect(screen.getByRole("status")).toHaveTextContent("Full link copied");
  });

  it("requires confirmation and preserves the confirmed row when revocation fails", async () => {
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/v1/shares")) return jsonResponse([share]);
      if (url.endsWith("/drop/tokens")) return jsonResponse([]);
      if (url.endsWith("/share-links/share-1") && init?.method === "DELETE") {
        return jsonResponse({ error: "unavailable" }, 503);
      }
      throw new Error(`Unhandled fetch: ${url}`);
    }) as typeof fetch;

    render(
      <MemoryRouter>
        <AccessCenter />
      </MemoryRouter>,
    );

    const card = (await screen.findByText("proposal.pdf")).closest("div.rounded-xl");
    expect(card).not.toBeNull();
    await userEvent.click(within(card as HTMLElement).getByRole("button", { name: "Revoke proposal.pdf link" }));
    expect(screen.getByText("Revoke this file share link?")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Confirm revoke" }));

    expect(await screen.findByText("Could not revoke this link. Try again.")).toBeInTheDocument();
    expect(screen.getByText("proposal.pdf")).toBeInTheDocument();
    expect(within(card as HTMLElement).getByText("Active")).toBeInTheDocument();
  });

  it("offers the complete URL for manual copy when clipboard permission is denied", async () => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn().mockRejectedValue(new Error("denied")) },
    });
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/v1/shares")) return jsonResponse([share]);
      if (url.endsWith("/drop/tokens")) return jsonResponse([]);
      if (url.endsWith("/files")) return jsonResponse([{ id: "file-1", filename: "proposal.pdf", metadata: JSON.stringify({ credential_scheme: "pin", iv: "iv", salt: "salt" }), is_owner: true }]);
      if (url.endsWith("/files/file-1/download")) return new Response(new Uint8Array([1]), { status: 200 });
      throw new Error(`Unhandled fetch: ${url}`);
    }) as typeof fetch;

    render(<MemoryRouter><AccessCenter /></MemoryRouter>);
    const card = (await screen.findByText("proposal.pdf")).closest("div.rounded-xl");
    await userEvent.click(within(card as HTMLElement).getByRole("button", { name: "Copy full link" }));
    const pinField = await screen.findByLabelText("Current PIN");
    await userEvent.type(pinField, "1111");
    expect(pinField).toHaveValue("1111");
    expect(screen.getByRole("button", { name: "Verify and copy" })).toBeEnabled();
    await userEvent.click(screen.getByRole("button", { name: "Verify and copy" }));

    expect(await screen.findByDisplayValue("http://localhost:3000/quantix/share/share-token#verified-file-key")).toBeInTheDocument();
    expect(screen.getByText("Clipboard access was denied. Select the full URL and copy it manually.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Cancel link recovery" }));
    expect(screen.queryByDisplayValue(/verified-file-key/)).not.toBeInTheDocument();
  });

  it("does not copy or expose a recovered key after the owner cancels", async () => {
    let finishRecovery: ((value: { key: CryptoKey; fragment: string }) => void) | undefined;
    recoveryMocks.recoverVerifiedOwnerFileKey.mockImplementation(() => new Promise((resolve) => {
      finishRecovery = resolve;
    }));
    const clipboardWriteText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: clipboardWriteText } });
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/v1/shares")) return jsonResponse([share]);
      if (url.endsWith("/drop/tokens")) return jsonResponse([]);
      if (url.endsWith("/files")) return jsonResponse([{ id: "file-1", filename: "proposal.pdf", metadata: JSON.stringify({ credential_scheme: "pin", iv: "iv", salt: "salt" }), is_owner: true }]);
      if (url.endsWith("/files/file-1/download")) return new Response(new Uint8Array([1]), { status: 200 });
      throw new Error(`Unhandled fetch: ${url}`);
    }) as typeof fetch;

    render(<MemoryRouter><AccessCenter /></MemoryRouter>);
    const card = (await screen.findByText("proposal.pdf")).closest("div.rounded-xl");
    await userEvent.click(within(card as HTMLElement).getByRole("button", { name: "Copy full link" }));
    await userEvent.type(await screen.findByLabelText("Current PIN"), "1111");
    await userEvent.click(screen.getByRole("button", { name: "Verify and copy" }));
    await waitFor(() => expect(recoveryMocks.recoverVerifiedOwnerFileKey).toHaveBeenCalled());
    await userEvent.click(screen.getByRole("button", { name: "Cancel link recovery" }));

    finishRecovery?.({ key: {} as CryptoKey, fragment: "must-not-escape" });
    await Promise.resolve();
    await Promise.resolve();

    expect(clipboardWriteText).not.toHaveBeenCalled();
    expect(screen.queryByText(/must-not-escape/)).not.toBeInTheDocument();
  });

  it("does not reopen a recovered URL when a pending clipboard write fails after cancel", async () => {
    let rejectClipboard: ((reason?: unknown) => void) | undefined;
    const clipboardWriteText = vi.fn(() => new Promise<void>((_, reject) => {
      rejectClipboard = reject;
    }));
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: clipboardWriteText } });
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/v1/shares")) return jsonResponse([share]);
      if (url.endsWith("/drop/tokens")) return jsonResponse([]);
      if (url.endsWith("/files")) return jsonResponse([{ id: "file-1", filename: "proposal.pdf", metadata: JSON.stringify({ credential_scheme: "pin", iv: "iv", salt: "salt" }), is_owner: true }]);
      if (url.endsWith("/files/file-1/download")) return new Response(new Uint8Array([1]), { status: 200 });
      throw new Error(`Unhandled fetch: ${url}`);
    }) as typeof fetch;

    render(<MemoryRouter><AccessCenter /></MemoryRouter>);
    const card = (await screen.findByText("proposal.pdf")).closest("div.rounded-xl") as HTMLElement;
    await userEvent.click(within(card).getByRole("button", { name: "Copy full link" }));
    await userEvent.type(await screen.findByLabelText("Current PIN"), "1111");
    await userEvent.click(screen.getByRole("button", { name: "Verify and copy" }));
    await waitFor(() => expect(clipboardWriteText).toHaveBeenCalled());

    await userEvent.click(screen.getByRole("button", { name: "Cancel link recovery" }));
    await act(async () => {
      rejectClipboard?.(new Error("denied"));
      await Promise.resolve();
    });

    expect(screen.queryByRole("dialog", { name: "Recover file share link" })).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue(/verified-file-key/)).not.toBeInTheDocument();
  });

  it("recovers an existing folder link from its owner-wrapped key without creating a grant", async () => {
    const folderShare = { ...share, id: "folder-link-1", type: "folder", token: "folder-token", resource_id: "folder-1", resource_name: "Contracts" };
    const clipboardWriteText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: clipboardWriteText } });
    Object.defineProperty(globalThis, "crypto", {
      configurable: true,
      value: { subtle: { exportKey: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3]).buffer) } },
    });
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      expect(init?.method).not.toBe("POST");
      if (url.endsWith("/v1/shares")) return jsonResponse([folderShare]);
      if (url.endsWith("/drop/tokens")) return jsonResponse([]);
      if (url.endsWith("/folders/folder-1/share-links")) return jsonResponse([{ id: "folder-link-1", token: "folder-token", owner_wrapped_folder_key: "owner-wrapped" }]);
      throw new Error(`Unhandled fetch: ${url}`);
    }) as typeof fetch;

    render(<MemoryRouter><AccessCenter /></MemoryRouter>);
    const card = (await screen.findByText("Contracts")).closest("div.rounded-xl");
    await userEvent.click(within(card as HTMLElement).getByRole("button", { name: "Copy full link" }));
    const folderPinField = await screen.findByLabelText("Current PIN");
    await userEvent.type(folderPinField, "1111");
    expect(folderPinField).toHaveValue("1111");
    expect(screen.getByRole("button", { name: "Verify and copy" })).toBeEnabled();
    await userEvent.click(screen.getByRole("button", { name: "Verify and copy" }));

    expect(recoveryMocks.recoverVerifiedOwnerFileKey).not.toHaveBeenCalled();
    await waitFor(() => expect(ownerPrivateKeyMocks.resolveOwnerPrivateKeyFromSession).toHaveBeenCalled());
    await waitFor(() => expect(cryptoMocks.unwrapKeyWithRSA).toHaveBeenCalled());
    await waitFor(() => expect(clipboardWriteText).toHaveBeenCalledWith(
      "http://localhost:3000/quantix/folder-share/folder-token#verified-folder-key",
    ));
  });

  it("routes Drop recovery to its existing Files manager instead of copying a fragmentless URL", async () => {
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/v1/shares")) return jsonResponse([]);
      if (url.endsWith("/drop/tokens")) return jsonResponse([drop]);
      throw new Error(`Unhandled fetch: ${url}`);
    }) as typeof fetch;

    render(
      <MemoryRouter>
        <AccessCenter />
      </MemoryRouter>,
    );

    const card = (await screen.findByText("Client intake")).closest("div.rounded-xl");
    expect(card).not.toBeNull();
    expect(within(card as HTMLElement).queryByRole("button", { name: /copy/i })).not.toBeInTheDocument();
    expect(within(card as HTMLElement).getByRole("link", { name: "Manage Drop route" })).toHaveAttribute("href", "/files");
  });
});

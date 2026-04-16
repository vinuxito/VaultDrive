import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { FolderSharedLinksSection } from "./FolderSharedLinksSection";

const sessionVaultMocks = vi.hoisted(() => ({
  getCredential: vi.fn(),
  getPrivateKey: vi.fn(),
  setCredential: vi.fn(),
}));

const cryptoMocks = vi.hoisted(() => ({
  decryptPrivateKeyWithPIN: vi.fn(),
  importRSAPrivateKey: vi.fn(),
  unwrapKeyWithRSA: vi.fn(),
  arrayBufferToBase64: vi.fn(),
}));

const exportKeyMock = vi.fn();
const clipboardWriteText = vi.fn();

vi.mock("../../context/SessionVaultContext", () => ({
  useSessionVault: () => ({
    getCredential: sessionVaultMocks.getCredential,
    getPrivateKey: sessionVaultMocks.getPrivateKey,
    setCredential: sessionVaultMocks.setCredential,
  }),
}));

vi.mock("../../utils/crypto", async () => {
  const actual = await vi.importActual<typeof import("../../utils/crypto")>("../../utils/crypto");
  return {
    ...actual,
    decryptPrivateKeyWithPIN: cryptoMocks.decryptPrivateKeyWithPIN,
    importRSAPrivateKey: cryptoMocks.importRSAPrivateKey,
    unwrapKeyWithRSA: cryptoMocks.unwrapKeyWithRSA,
    arrayBufferToBase64: cryptoMocks.arrayBufferToBase64,
  };
});

describe("FolderSharedLinksSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    localStorage.setItem("token", "session-token");
    localStorage.setItem(
      "user",
      JSON.stringify({
        pin_set: true,
        private_key_pin_encrypted: "wrapped-private-key",
      }),
    );

    sessionVaultMocks.getCredential.mockReturnValue(null);
    sessionVaultMocks.getPrivateKey.mockReturnValue(null);
    cryptoMocks.decryptPrivateKeyWithPIN.mockImplementation(async (pin: string) => {
      if (pin !== "1111") {
        throw new Error("That PIN didn't match. Try again.");
      }

      return "private-key-pem";
    });
    cryptoMocks.importRSAPrivateKey.mockResolvedValue({} as CryptoKey);
    cryptoMocks.unwrapKeyWithRSA.mockResolvedValue({} as CryptoKey);
    cryptoMocks.arrayBufferToBase64.mockReturnValue("folder-share-secret");

    Object.defineProperty(globalThis, "crypto", {
      value: {
        subtle: {
          exportKey: exportKeyMock.mockResolvedValue(new ArrayBuffer(8)),
        },
      },
      configurable: true,
    });

    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: clipboardWriteText },
      configurable: true,
    });

    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/folders/folder-1/share-links")) {
        return new Response(
          JSON.stringify([
            {
              id: "share-link-1",
              token: "folder-token-1",
              folder_id: "folder-1",
              is_active: true,
              created_at: "2026-04-10T10:00:00.000Z",
              expires_at: "2026-04-30T10:00:00.000Z",
              access_count: 2,
              last_accessed_at: "2026-04-11T10:00:00.000Z",
              owner_wrapped_folder_key: "wrapped-folder-key",
            },
          ]),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }

      throw new Error(`Unhandled fetch: ${url}`);
    }) as typeof fetch;
  });

  it("uses the masked PIN-gated copy flow for existing folder-share links and removes direct open", async () => {
    render(
      <FolderSharedLinksSection
        folder={{ id: "folder-1", name: "ABRN CSD" }}
        onCreateLink={() => undefined}
      />,
    );

    expect(await screen.findByDisplayValue(/#••••••••/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /open link/i })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /copy full folder share link/i }));
    await userEvent.type(await screen.findByLabelText(/4-digit pin/i), "1111");
    await userEvent.click(screen.getByRole("button", { name: /verify pin and copy/i }));

    await waitFor(() => {
      expect(clipboardWriteText).toHaveBeenCalledWith(
        "http://localhost:3000/abrn/folder-share/folder-token-1#folder-share-secret",
      );
    });
  });

  it("falls back to manual selectable text when clipboard is unavailable", async () => {
    Object.defineProperty(navigator, "clipboard", {
      value: {},
      configurable: true,
    });

    render(
      <FolderSharedLinksSection
        folder={{ id: "folder-1", name: "ABRN CSD" }}
        onCreateLink={() => undefined}
      />,
    );

    await userEvent.click(await screen.findByRole("button", { name: /copy full folder share link/i }));
    await userEvent.type(await screen.findByLabelText(/4-digit pin/i), "1111");
    await userEvent.click(screen.getByRole("button", { name: /verify pin and copy/i }));

    expect(await screen.findByText(/clipboard is unavailable/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/4-digit pin/i)).not.toBeInTheDocument();
    expect(screen.getByDisplayValue("http://localhost:3000/abrn/folder-share/folder-token-1#folder-share-secret")).toBeInTheDocument();
  });

  it("shows an explicit unavailable reason for revoked links", async () => {
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/folders/folder-1/share-links")) {
        return new Response(
          JSON.stringify([
            {
              id: "share-link-2",
              token: "folder-token-2",
              folder_id: "folder-1",
              is_active: false,
              created_at: "2026-04-10T10:00:00.000Z",
              expires_at: "2026-04-30T10:00:00.000Z",
              access_count: 2,
              last_accessed_at: "2026-04-11T10:00:00.000Z",
              owner_wrapped_folder_key: "wrapped-folder-key",
            },
          ]),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }

      throw new Error(`Unhandled fetch: ${url}`);
    }) as typeof fetch;

    render(
      <FolderSharedLinksSection
        folder={{ id: "folder-1", name: "ABRN CSD" }}
        onCreateLink={() => undefined}
      />,
    );

    expect(await screen.findByText(/revoked and can no longer be copied/i)).toBeInTheDocument();
  });
});

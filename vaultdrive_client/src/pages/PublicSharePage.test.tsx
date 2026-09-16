import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import PublicSharePage from "./PublicSharePage";

const cryptoMocks = vi.hoisted(() => ({
  decryptFile: vi.fn(),
  base64ToArrayBuffer: vi.fn(() => new ArrayBuffer(32)),
}));

vi.mock("react-router-dom", () => ({
  useParams: () => ({ token: "share-token" }),
}));

vi.mock("../components/branding/brand-logo", () => ({
  default: () => <div>ABRN</div>,
}));

vi.mock("../utils/crypto", () => ({
  decryptFile: cryptoMocks.decryptFile,
  base64ToArrayBuffer: cryptoMocks.base64ToArrayBuffer,
}));

const shareInfo = {
  filename: "contract.pdf",
  file_size: 123,
  expires_at: null,
  is_expired: false,
  owner_display_name: "Owner",
  owner_organization: "ABRN",
  access_count: 0,
};

describe("PublicSharePage recoverable errors", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cryptoMocks.base64ToArrayBuffer.mockReturnValue(new ArrayBuffer(32));
    window.location.hash = "#share-key";
  });

  it("offers retry for a temporary info failure without showing missing-key advice", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(shareInfo), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }));

    render(<PublicSharePage />);

    expect(await screen.findByText("The service is temporarily unavailable."))
      .toBeInTheDocument();
    expect(screen.queryByText(/complete share link/i)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(await screen.findByRole("button", { name: /download file/i })).toBeInTheDocument();
  });

  it("does not offer retry or key advice for terminal access", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response(null, { status: 410 }));

    render(<PublicSharePage />);

    expect(await screen.findByText("This link has expired or is no longer available."))
      .toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /try again/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/complete share link/i)).not.toBeInTheDocument();
  });

  it("identifies an invalid fragment as a key problem before fetching", async () => {
    cryptoMocks.base64ToArrayBuffer.mockReturnValueOnce(new ArrayBuffer(0));
    globalThis.fetch = vi.fn();

    render(<PublicSharePage />);

    expect(await screen.findByText(/link has an invalid decryption key/i)).toBeInTheDocument();
    expect(screen.getByText(/complete share link/i)).toBeInTheDocument();
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("requires an explicit retry after a one-time authorized fetch fails", async () => {
    const oneTimeInfo = { ...shareInfo, max_downloads: 1 };
    cryptoMocks.decryptFile.mockResolvedValue(new ArrayBuffer(8));
    vi.stubGlobal("crypto", {
      subtle: { importKey: vi.fn().mockResolvedValue({}) },
    });
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:test");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    const anchorClick = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(oneTimeInfo), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }))
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(new Response(new Uint8Array([1, 2, 3]), {
        status: 200,
        headers: {
          "X-File-Name": "contract.pdf",
          "X-File-Metadata": JSON.stringify({ iv: "AA==" }),
        },
      }));

    render(<PublicSharePage />);
    await userEvent.click(await screen.findByRole("button", { name: /download file/i }));

    expect(await screen.findByText(/authorized fetch may have consumed the one-time link/i))
      .toBeInTheDocument();
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);

    await userEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(await screen.findByText("Browser save started")).toBeInTheDocument();
    expect(anchorClick).toHaveBeenCalledTimes(1);
  });

  it("explains a consumed limited-use link without claiming any file copy was deleted", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      ...shareInfo,
      is_shredded: true,
      max_downloads: 1,
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));

    render(<PublicSharePage />);

    expect(await screen.findByRole("heading", { name: /link has already been used/i }))
      .toBeInTheDocument();
    expect(screen.getByText(/owner's file and any copies already saved are unaffected/i))
      .toBeInTheDocument();
    expect(screen.getByText(/ask the owner for a new link/i)).toBeInTheDocument();
    expect(screen.queryByText(/key.*deleted|shredded/i)).not.toBeInTheDocument();
  });
});

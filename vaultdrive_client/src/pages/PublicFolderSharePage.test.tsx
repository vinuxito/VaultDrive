import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import PublicFolderSharePage from "./PublicFolderSharePage";

const cryptoMocks = vi.hoisted(() => ({
  importKey: vi.fn().mockResolvedValue({ id: "folder-key" }),
  unwrapKeyWithAES: vi.fn().mockResolvedValue({ id: "file-key" }),
  decryptFile: vi.fn(),
}));

vi.mock("react-router-dom", () => ({
  useParams: () => ({ token: "share-token" }),
}));

vi.mock("../utils/crypto", () => ({
  importKey: cryptoMocks.importKey,
  unwrapKeyWithAES: cryptoMocks.unwrapKeyWithAES,
  decryptFile: cryptoMocks.decryptFile,
  base64ToArrayBuffer: vi.fn(),
}));

vi.mock("../context/SessionVaultContext", () => ({
  useSessionVault: () => ({
    getCredential: () => null,
    getPrivateKey: () => null,
    setCredential: vi.fn(),
  }),
}));

vi.mock("../context/ToastContext", () => ({
  useToast: () => ({ addToast: vi.fn() }),
}));

vi.mock("../components/branding/brand-logo", () => ({
  default: () => <div>ABRN</div>,
}));

describe("PublicFolderSharePage ZIP download", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.location.hash = "#folder-key";

    globalThis.fetch = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/info")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              folder_name: "GLM Ampliación",
              owner_display_name: "Owner",
              owner_organization: "ABRN",
              expires_at: null,
              is_expired: false,
              access_count: 0,
              total_files: 1,
              total_size: 123,
              tree: {
                id: "folder-1",
                name: "GLM Ampliación",
                files: [{
                  id: "file-1",
                  filename: "contract.pdf",
                  file_size: 123,
                  encrypted_metadata: "{}",
                  folder_id: "folder-1",
                }],
                subfolders: [],
              },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          ),
        );
      }
      if (url.endsWith("/keys")) {
        return Promise.resolve(
          new Response(JSON.stringify({ "file-1": "wrapped-key" }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );
      }
      if (url.includes("/file/file-1")) {
        return Promise.resolve(new Response('{"error":"storage unavailable"}', { status: 500 }));
      }
      throw new Error(`Unexpected fetch: ${url}`);
    }) as typeof fetch;
  });

  it("does not create or report a ZIP when any file fetch fails", async () => {
    const anchorClick = vi.spyOn(HTMLAnchorElement.prototype, "click");
    const createObjectURL = vi.spyOn(URL, "createObjectURL");

    render(<PublicFolderSharePage />);

    await userEvent.click(await screen.findByRole("button", { name: /download all as zip/i }));

    expect(await screen.findByText(/contract.pdf: file is temporarily unavailable from storage/i))
      .toBeInTheDocument();
    expect(screen.queryByText(/zip saved/i)).not.toBeInTheDocument();
    expect(anchorClick).not.toHaveBeenCalled();
    expect(createObjectURL).not.toHaveBeenCalled();
  });
});

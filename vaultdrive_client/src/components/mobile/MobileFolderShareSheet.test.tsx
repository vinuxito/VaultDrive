import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MobileFolderShareSheet } from "./MobileFolderShareSheet";
import { encodeQrMatrix } from "../../utils/qr-svg";

const sessionVaultMocks = vi.hoisted(() => ({
  getCredential: vi.fn(),
  getFolderKey: vi.fn(),
  setFolderKey: vi.fn(),
  getPrivateKey: vi.fn(),
  setPrivateKey: vi.fn(),
}));

const cryptoMocks = vi.hoisted(() => ({
  decryptPrivateKeyWithPIN: vi.fn(),
  importRSAPrivateKey: vi.fn(),
  importRSAPublicKey: vi.fn(),
  generateFileKey: vi.fn(),
  wrapKeyWithRSA: vi.fn(),
  wrapKeyWithAES: vi.fn(),
  exportKey: vi.fn(),
}));

const folderShareMocks = vi.hoisted(() => ({
  resolveFolderShareFileKey: vi.fn(),
}));

vi.mock("../../context/SessionVaultContext", () => ({
  useSessionVault: () => sessionVaultMocks,
}));

vi.mock("../../utils/crypto", async () => {
  const actual = await vi.importActual<typeof import("../../utils/crypto")>("../../utils/crypto");
  return {
    ...actual,
    decryptPrivateKeyWithPIN: cryptoMocks.decryptPrivateKeyWithPIN,
    importRSAPrivateKey: cryptoMocks.importRSAPrivateKey,
    importRSAPublicKey: cryptoMocks.importRSAPublicKey,
    generateFileKey: cryptoMocks.generateFileKey,
    wrapKeyWithRSA: cryptoMocks.wrapKeyWithRSA,
    wrapKeyWithAES: cryptoMocks.wrapKeyWithAES,
    exportKey: cryptoMocks.exportKey,
  };
});

vi.mock("../../utils/folder-share", () => ({
  resolveFolderShareFileKey: folderShareMocks.resolveFolderShareFileKey,
}));

vi.mock("../../utils/audioHaptics", () => ({
  playTumblerClick: vi.fn(),
}));

describe("encodeQrMatrix (Sovereign RAM QR Encoder)", () => {
  it("encodes a #key share URL into a valid ISO/IEC 18004 matrix with 3 intact 7x7 finder patterns", () => {
    const url = "https://abrndrive.filemonprime.net/abrn/folder-share/tok123#k9mP2xLz8Qw4vRn7s";
    const matrix = encodeQrMatrix(url);

    expect(matrix.length).toBeGreaterThanOrEqual(21);
    expect(matrix[0].length).toBe(matrix.length);

    // Top-left finder corners and center module must be dark
    expect(matrix[0][0]).toBe(true);
    expect(matrix[0][6]).toBe(true);
    expect(matrix[6][0]).toBe(true);
    expect(matrix[3][3]).toBe(true);
    // Ring inside finder must be light
    expect(matrix[1][1]).toBe(false);

    // Top-right and bottom-left finder centers must be dark
    const size = matrix.length;
    expect(matrix[3][size - 4]).toBe(true);
    expect(matrix[size - 4][3]).toBe(true);
  });
});

describe("MobileFolderShareSheet", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    localStorage.setItem("token", "session-token");
    localStorage.setItem(
      "user",
      JSON.stringify({
        id: "owner-1",
        username: "brenda",
        private_key_pin_encrypted: "wrapped-private-key",
        public_key: "owner-public-key",
      }),
    );

    sessionVaultMocks.getCredential.mockReturnValue({ type: "pin", value: "1234" });
    cryptoMocks.decryptPrivateKeyWithPIN.mockResolvedValue("private-key-pem");
    cryptoMocks.importRSAPrivateKey.mockResolvedValue({} as CryptoKey);
    cryptoMocks.importRSAPublicKey.mockResolvedValue({} as CryptoKey);
    cryptoMocks.generateFileKey.mockResolvedValue({} as CryptoKey);
    cryptoMocks.wrapKeyWithRSA.mockResolvedValue("owner-wrapped-folder-key");
    cryptoMocks.wrapKeyWithAES.mockResolvedValue("wrapped-file-key");
    cryptoMocks.exportKey.mockResolvedValue("k9mP2xLz8Qw4");
    folderShareMocks.resolveFolderShareFileKey.mockResolvedValue({} as CryptoKey);

    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });

    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  it("auto-generates a #key folder link, renders the Live Glass Twin and Sovereign QR SVG, and copies cleanly", async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/folders/f-fiscales/share-links")) {
        return Promise.resolve(
          new Response(JSON.stringify([{ id: "l1", token: "tok1", is_active: true }]), { status: 200 }),
        );
      }
      if (url.endsWith("/folders/f-fiscales/shares")) {
        return Promise.resolve(
          new Response(
            JSON.stringify([
              {
                id: "s1",
                user_id: "collab-2",
                username: "Despacho Contable MX",
                wrapped_key: "wk",
                shared_by: "owner-1",
                created_at: "2026-11-12T00:00:00Z",
              },
            ]),
            { status: 200 },
          ),
        );
      }
      if (url.endsWith("/folders/f-fiscales/files-recursive")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              files: [
                { id: "file-1", filename: "Acta.pdf", encrypted_metadata: "{}" },
                { id: "file-2", filename: "CFDI.xml", encrypted_metadata: "{}" },
              ],
              total_count: 2,
            }),
            { status: 200 },
          ),
        );
      }
      if (url.endsWith("/files/access-keys-batch") && init?.method === "POST") {
        return Promise.resolve(
          new Response(JSON.stringify({ "file-1": "wk1", "file-2": "wk2" }), { status: 200 }),
        );
      }
      if (url.endsWith("/folders/f-fiscales/share-link") && init?.method === "POST") {
        return Promise.resolve(new Response(JSON.stringify({ token: "abrn77" }), { status: 200 }));
      }
      return Promise.resolve(new Response(JSON.stringify({}), { status: 200 }));
    });

    render(
      <MobileFolderShareSheet
        isOpen={true}
        onClose={vi.fn()}
        folder={{ id: "f-fiscales", name: "Expedientes Fiscales 2026" }}
        fileCount={2}
      />,
    );

    expect(screen.getByText(/Compartir «Expedientes Fiscales 2026»/)).toBeInTheDocument();
    expect(screen.getByTestId("mobile-folder-glass-twin")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("#k9mP2xLz8Qw4")).toBeInTheDocument();
    });

    // Collaborator count pill updates in Tab 3
    await waitFor(() => {
      expect(screen.getByTestId("mobile-folder-tab-team")).toHaveTextContent("Equipo RSA (1)");
    });

    // Toggle Sovereign QR SVG
    await userEvent.click(screen.getByTestId("mobile-folder-qr-cta"));
    expect(screen.getByTestId("mobile-folder-qr-card")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /Código QR de carpeta cifrada/i })).toBeInTheDocument();

    // Copy #key URL
    await userEvent.click(screen.getByTestId("mobile-folder-copy-cta"));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.stringContaining("/folder-share/abrn77#k9mP2xLz8Qw4"),
    );

    // Switch to Equipo RSA tab and inspect collaborator
    await userEvent.click(screen.getByTestId("mobile-folder-tab-team"));
    expect(screen.getByText("Despacho Contable MX")).toBeInTheDocument();
  });

  it("pivots cleanly from an empty folder to Buzón Drop without dead-ending the user", async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/folders/f-empty/files-recursive")) {
        return Promise.resolve(
          new Response(JSON.stringify({ files: [], total_count: 0 }), { status: 200 }),
        );
      }
      if (url.endsWith("/drop/create") && init?.method === "POST") {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              upload_url: "https://abrndrive.filemonprime.net/abrn/drop/aud26#pub_key_abrn",
            }),
            { status: 200 },
          ),
        );
      }
      return Promise.resolve(new Response(JSON.stringify([]), { status: 200 }));
    });

    render(
      <MobileFolderShareSheet
        isOpen={true}
        onClose={vi.fn()}
        folder={{ id: "f-empty", name: "Auditoría Externa Q4" }}
        fileCount={0}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("mobile-folder-empty-handoff")).toBeInTheDocument();
    });

    await userEvent.click(screen.getByTestId("switch-to-drop-btn"));

    await waitFor(() => {
      expect(screen.getByText("#pub_key_abrn")).toBeInTheDocument();
    });
    expect(screen.getByTestId("mobile-folder-whatsapp-cta")).toHaveTextContent(
      "Enviar Buzón Drop por WhatsApp",
    );
  });
});

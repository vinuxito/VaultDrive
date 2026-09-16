import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ShareModal from "./share-modal";

const mocks = vi.hoisted(() => ({
  recover: vi.fn(),
  clear: vi.fn(),
  setFileKey: vi.fn(),
  getUserPublicKey: vi.fn(),
  importRSAPublicKey: vi.fn(),
  wrapKeyWithRSA: vi.fn(),
}));
vi.mock("../context/SessionVaultContext", () => ({ useSessionVault: () => ({
  getCredential: () => ({ type: "pin", value: "1111" }),
  clearCredential: mocks.clear,
  getFileKey: () => null,
  getFolderKey: () => null,
  setFileKey: mocks.setFileKey,
}) }));
vi.mock("../utils/access-link-recovery", () => ({ recoverVerifiedOwnerFileKey: mocks.recover }));
vi.mock("../utils/api", async (importOriginal) => ({
  ...await importOriginal<typeof import("../utils/api")>(),
  getUserPublicKey: mocks.getUserPublicKey,
}));
vi.mock("../utils/crypto", async (importOriginal) => ({
  ...await importOriginal<typeof import("../utils/crypto")>(),
  importRSAPublicKey: mocks.importRSAPublicKey,
  wrapKeyWithRSA: mocks.wrapKeyWithRSA,
}));

const recipient = { id: "recipient", username: "ada", email: "ada@example.com", first_name: "Ada", last_name: "Lovelace" };

describe("direct sharing uses the real lookup and verifies file access", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem("token", "fixture");
    mocks.getUserPublicKey.mockResolvedValue({ public_key: "fixture-public-key" });
    mocks.importRSAPublicKey.mockResolvedValue({});
    mocks.wrapKeyWithRSA.mockResolvedValue("wrapped-for-recipient");
  });
  it("accepts the server's single recipient object and blocks grants when decryption fails", async () => {
    const requests: string[] = [];
    mocks.recover.mockRejectedValue(new Error("That credential didn't unlock this file. Check it and try again."));
    vi.stubGlobal("fetch", vi.fn(async (input: string) => {
      requests.push(input);
      return input.includes("user-by-username") ? new Response(JSON.stringify(recipient)) : new Response(new Uint8Array([1]));
    }));
    render(<ShareModal isOpen onClose={vi.fn()} fileId="file" fileName="example.txt" fileMetadata='{"credential_scheme":"pin","iv":"iv","salt":"salt"}' onShareComplete={vi.fn()} />);
    await userEvent.type(screen.getByLabelText("Search users by username"), "ada");
    await userEvent.click(await screen.findByRole("button", { name: /Ada Lovelace/ }));
    await userEvent.click(screen.getByRole("button", { name: "Share File" }));
    await screen.findByText(/didn't unlock this file/);
    expect(mocks.recover).toHaveBeenCalledOnce();
    expect(requests.some((url) => url.endsWith("/share"))).toBe(false);
    expect(mocks.clear).toHaveBeenCalledOnce();
    expect(screen.getByLabelText("Your PIN")).toBeInTheDocument();
    expect(screen.queryByText(/Credential cached/)).not.toBeInTheDocument();
  });
  it("reports lookup unavailability instead of pretending no recipient exists", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 503 })));
    render(<ShareModal isOpen onClose={vi.fn()} fileId="file" fileName="example.txt" onShareComplete={vi.fn()} />);
    await userEvent.type(screen.getByLabelText("Search users by username"), "ada");
    await waitFor(() => expect(screen.getByText(/User lookup is unavailable/)).toBeInTheDocument());
  });

  it("rejects an incomplete recipient instead of rendering fields that can crash", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ id: "missing-fields" }))));
    render(<ShareModal isOpen onClose={vi.fn()} fileId="file" fileName="example.txt" onShareComplete={vi.fn()} />);
    await userEvent.type(screen.getByLabelText("Search users by username"), "ada");
    expect(await screen.findByText(/incomplete recipient details/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /missing-fields/i })).not.toBeInTheDocument();
  });

  it("treats a direct-share 503 as unconfirmed access and requires review", async () => {
    mocks.recover.mockResolvedValue({ key: {}, fragment: "unused" });
    vi.stubGlobal("fetch", vi.fn(async (input: string, init?: RequestInit) => {
      if (input.includes("user-by-username")) return new Response(JSON.stringify(recipient));
      if (input.endsWith("/files/file/download")) return new Response(new Uint8Array([1, 2, 3]));
      if (input.endsWith("/files/file/share") && init?.method === "POST") return new Response("{}", { status: 503 });
      return new Response("{}", { status: 404 });
    }));
    render(<ShareModal isOpen onClose={vi.fn()} fileId="file" fileName="example.txt" fileMetadata='{"credential_scheme":"pin","iv":"iv"}' onShareComplete={vi.fn()} />);
    await userEvent.type(screen.getByLabelText("Search users by username"), "ada");
    await userEvent.click(await screen.findByRole("button", { name: /Ada Lovelace/ }));
    await userEvent.click(screen.getByRole("button", { name: "Share File" }));
    expect(await screen.findByText(/share outcome was not confirmed.*Review file access before retrying/i)).toBeInTheDocument();
  });

  it("does not let an older lookup response restore a previous recipient", async () => {
    let resolveAda!: (response: Response) => void;
    const adaResponse = new Promise<Response>((resolve) => { resolveAda = resolve; });
    vi.stubGlobal("fetch", vi.fn(async (input: string) => {
      if (input.includes("username=ada")) return adaResponse;
      if (input.includes("username=grace")) {
        return new Response(JSON.stringify({ ...recipient, id: "grace", username: "grace", first_name: "Grace", last_name: "Hopper" }));
      }
      return new Response("{}", { status: 404 });
    }));

    render(<ShareModal isOpen onClose={vi.fn()} fileId="file" fileName="example.txt" onShareComplete={vi.fn()} />);
    const search = screen.getByLabelText("Search users by username");
    await userEvent.type(search, "ada");
    await new Promise((resolve) => setTimeout(resolve, 350));
    await userEvent.clear(search);
    await userEvent.type(search, "grace");
    expect(await screen.findByRole("button", { name: /Grace Hopper/ })).toBeInTheDocument();
    resolveAda(new Response(JSON.stringify(recipient)));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(screen.queryByRole("button", { name: /Ada Lovelace/ })).not.toBeInTheDocument();
  });

  it("reports confirmed partial group grants and directs the owner to review access", async () => {
    mocks.recover.mockResolvedValue({ key: {}, fragment: "unused" });
    localStorage.setItem("user", JSON.stringify({ public_key: "owner-public-key" }));
    let memberGrant = 0;
    vi.stubGlobal("fetch", vi.fn(async (input: string, init?: RequestInit) => {
      if (input.endsWith("/groups")) {
        return new Response(JSON.stringify([{ id: "group-1", name: "Reviewers", member_count: 2 }]));
      }
      if (input.endsWith("/groups/group-1/members")) {
        return new Response(JSON.stringify([
          { user_id: "member-1", username: "one", email: "one@example.com", first_name: "One", last_name: "Member" },
          { user_id: "member-2", username: "two", email: "two@example.com", first_name: "Two", last_name: "Member" },
        ]));
      }
      if (input.endsWith("/files/file/download")) return new Response(new Uint8Array([1, 2, 3]));
      if (input.endsWith("/files/file/share") && init?.method === "POST") {
        memberGrant += 1;
        return memberGrant === 1
          ? new Response("{}")
          : new Response(JSON.stringify({ error: "second grant failed" }), { status: 503 });
      }
      return new Response("{}", { status: 404 });
    }));

    render(<ShareModal isOpen onClose={vi.fn()} fileId="file" fileName="example.txt" fileMetadata='{"credential_scheme":"pin","iv":"iv"}' onShareComplete={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Share with Group" }));
    await userEvent.click(await screen.findByRole("button", { name: /Reviewers/ }));
    await userEvent.click(screen.getByRole("button", { name: "Share File" }));

    expect(await screen.findByText(/Shared with 1 of 2 group members.*Review file access before retrying/i)).toBeInTheDocument();
    expect(mocks.recover).toHaveBeenCalledOnce();
  });

  it("treats an unconfirmed first group grant as possible access, not a safe failure", async () => {
    mocks.recover.mockResolvedValue({ key: {}, fragment: "unused" });
    localStorage.setItem("user", JSON.stringify({ public_key: "owner-public-key" }));
    vi.stubGlobal("fetch", vi.fn(async (input: string, init?: RequestInit) => {
      if (input.endsWith("/groups")) return new Response(JSON.stringify([{ id: "group-1", name: "Reviewers", member_count: 1 }]));
      if (input.endsWith("/groups/group-1/members")) return new Response(JSON.stringify([
        { user_id: "member-1", username: "one", email: "one@example.com", first_name: "One", last_name: "Member" },
      ]));
      if (input.endsWith("/files/file/download")) return new Response(new Uint8Array([1, 2, 3]));
      if (input.endsWith("/files/file/share") && init?.method === "POST") return new Response("{}", { status: 503 });
      return new Response("{}", { status: 404 });
    }));
    render(<ShareModal isOpen onClose={vi.fn()} fileId="file" fileName="example.txt" fileMetadata='{"credential_scheme":"pin","iv":"iv"}' onShareComplete={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Share with Group" }));
    await userEvent.click(await screen.findByRole("button", { name: /Reviewers/ }));
    await userEvent.click(screen.getByRole("button", { name: "Share File" }));
    expect(await screen.findByText(/first group member grant outcome is unconfirmed.*Review file access before retrying/i)).toBeInTheDocument();
  });
});

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import FileRequestPage from "./FileRequestPage";

const cryptoMocks = vi.hoisted(() => ({
  deriveKeyFromPassword: vi.fn().mockResolvedValue({}),
  generateSalt: vi.fn(() => new Uint8Array(16)),
  arrayBufferToBase64: vi.fn(() => "encoded"),
}));

vi.mock("react-router-dom", () => ({
  useParams: () => ({ token: "request-token" }),
}));

vi.mock("../components/branding/brand-logo", () => ({
  default: () => <div>ABRN</div>,
}));

vi.mock("../utils/crypto", () => cryptoMocks);

type XhrScenario =
  | { event: "load"; status: number; responseText: string }
  | { event: "network" }
  | { event: "pending" };

let xhrScenarios: XhrScenario[] = [];
let xhrInstances: FakeXMLHttpRequest[] = [];

class FakeXMLHttpRequest {
  upload: { onprogress: ((event: ProgressEvent) => void) | null } = { onprogress: null };
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  ontimeout: (() => void) | null = null;
  onabort: (() => void) | null = null;
  status = 0;
  responseText = "";
  timeout = 0;
  aborted = false;

  constructor() {
    xhrInstances.push(this);
  }

  open() {}

  send() {
    const scenario = xhrScenarios.shift();
    if (!scenario || scenario.event === "pending") return;
    queueMicrotask(() => {
      if (scenario.event === "network") {
        this.onerror?.();
        return;
      }
      this.status = scenario.status;
      this.responseText = scenario.responseText;
      this.onload?.();
    });
  }

  abort() {
    this.aborted = true;
    this.onabort?.();
  }
}

const requestInfo = {
  description: "Please send the records",
  expires_at: null,
  is_expired: false,
  owner_display_name: "Recipient",
  owner_organization: "ABRN",
  uploaded_count: 0,
  max_file_size: 10_000_000,
};

function acceptedReceipt(id: string, filename: string) {
  return JSON.stringify({ count: 1, uploaded: [{ file_id: id, filename }] });
}

async function selectFilesAndSend(files: File[]) {
  const user = userEvent.setup();
  const view = render(<FileRequestPage />);
  await screen.findByText("Secure File Request");
  await user.type(screen.getByPlaceholderText("Enter a secure password…"), "correct horse battery staple");
  await user.upload(screen.getByLabelText("Select Files", { selector: "input" }), files);
  await user.click(screen.getByRole("button", { name: "Send Securely" }));
  return { user, unmount: view.unmount };
}

describe("FileRequestPage upload recovery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    xhrScenarios = [];
    xhrInstances = [];
    globalThis.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify(requestInfo), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));
    vi.stubGlobal("XMLHttpRequest", FakeXMLHttpRequest);
    vi.stubGlobal("crypto", {
      randomUUID: vi.fn()
        .mockReturnValueOnce("row-1")
        .mockReturnValueOnce("row-2"),
      getRandomValues: (value: Uint8Array) => value,
      subtle: { encrypt: vi.fn().mockResolvedValue(new ArrayBuffer(8)) },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("continues a mixed batch, preserves the accepted row, and retries only the confirmed failure", async () => {
    xhrScenarios = [
      { event: "load", status: 429, responseText: JSON.stringify({ error: "Wait before retrying" }) },
      { event: "load", status: 201, responseText: acceptedReceipt("file-2", "two.txt") },
      { event: "load", status: 201, responseText: acceptedReceipt("file-1", "one.txt") },
    ];

    const { user } = await selectFilesAndSend([
      new File(["one"], "one.txt", { type: "text/plain" }),
      new File(["two"], "two.txt", { type: "text/plain" }),
    ]);

    expect(await screen.findByText("1 accepted · 1 failed · 0 need confirmation")).toBeInTheDocument();
    expect(xhrInstances).toHaveLength(2);

    await user.click(screen.getByRole("button", { name: "Retry confirmed failures (1)" }));

    expect(await screen.findByRole("heading", { name: "Files sent securely" })).toBeInTheDocument();
    expect(xhrInstances).toHaveLength(3);
  });

  it("does not offer a blind retry when a post-send failure has unknown acceptance", async () => {
    xhrScenarios = [
      { event: "load", status: 503, responseText: JSON.stringify({ error: "Service unavailable" }) },
    ];

    await selectFilesAndSend([new File(["one"], "one.txt", { type: "text/plain" })]);

    expect(await screen.findByText("0 accepted · 0 failed · 1 need confirmation")).toBeInTheDocument();
    expect(screen.getByText(/do not resend files marked/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /retry confirmed failures/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Files sent securely" })).not.toBeInTheDocument();
  });

  it("aborts an in-flight request when the page closes", async () => {
    xhrScenarios = [{ event: "pending" }];
    const { unmount } = await selectFilesAndSend([new File(["one"], "one.txt", { type: "text/plain" })]);

    await waitFor(() => expect(xhrInstances).toHaveLength(1));
    unmount();

    expect(xhrInstances[0]?.aborted).toBe(true);
  });
});

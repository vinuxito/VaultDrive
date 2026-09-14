import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import DropUpload from "./drop-upload";

vi.mock("react-router-dom", () => ({
  useParams: () => ({ token: "drop-token" }),
  useNavigate: () => vi.fn(),
}));

vi.mock("../components/branding/brand-logo", () => ({
  default: () => <div>ABRN</div>,
}));

vi.mock("../utils/crypto", () => ({
  hexToBytes: () => new Uint8Array(32),
}));

type XhrScenario = { status: number; responseText: string };
let xhrScenarios: XhrScenario[] = [];
let xhrCount = 0;

class FakeXMLHttpRequest {
  upload = { onprogress: null as ((event: ProgressEvent) => void) | null };
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  ontimeout: (() => void) | null = null;
  onabort: (() => void) | null = null;
  status = 0;
  responseText = "";
  timeout = 0;

  constructor() {
    xhrCount += 1;
  }

  open() {}

  send() {
    const scenario = xhrScenarios.shift();
    if (!scenario) return;
    queueMicrotask(() => {
      this.status = scenario.status;
      this.responseText = scenario.responseText;
      this.onload?.();
    });
  }

  abort() {
    this.onabort?.();
  }
}

const tokenInfo = {
  valid: true,
  folder_name: "Client inbox",
  link_name: "Records",
  description: "Send records",
  files_limit: 10,
  uploaded: 0,
  expires_at: null,
  has_password: false,
  owner_display_name: "Recipient",
  owner_organization: "ABRN",
  checklist_items: [],
};

function acceptedReceipt(id: string) {
  return JSON.stringify({
    success: true,
    uploaded: 1,
    count: 1,
    files: [{ file_id: id, file_name: `${id}.txt`, path: "" }],
  });
}

describe("DropUpload batch recovery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    xhrScenarios = [];
    xhrCount = 0;
    window.location.hash = `#key=${"11".repeat(32)}`;
    globalThis.fetch = vi.fn().mockImplementation(async () =>
      new Response(JSON.stringify(tokenInfo), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }));
    vi.stubGlobal("XMLHttpRequest", FakeXMLHttpRequest);
    vi.stubGlobal("crypto", {
      randomUUID: vi.fn()
        .mockReturnValueOnce("drop-row-1")
        .mockReturnValueOnce("drop-row-2"),
      getRandomValues: (value: Uint8Array) => value,
      subtle: {
        importKey: vi.fn().mockResolvedValue({}),
        encrypt: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("keeps a successful row while retrying only a confirmed failed row", async () => {
    xhrScenarios = [
      { status: 429, responseText: JSON.stringify({ error: "Wait before retrying" }) },
      { status: 201, responseText: acceptedReceipt("file-2") },
      { status: 201, responseText: acceptedReceipt("file-1") },
    ];
    const user = userEvent.setup();
    render(<DropUpload />);

    await screen.findByText("Secure File Delivery");
    await user.upload(screen.getByLabelText("Select Files", { selector: "input" }), [
      new File(["one"], "one.txt", { type: "text/plain" }),
      new File(["two"], "two.txt", { type: "text/plain" }),
    ]);

    expect(await screen.findByText("1 accepted · 1 failed · 0 need confirmation")).toBeInTheDocument();
    expect(xhrCount).toBe(2);
    await user.click(screen.getByRole("button", { name: "Retry confirmed failures (1)" }));

    expect(await screen.findByText("Your files have been delivered securely.")).toBeInTheDocument();
    expect(xhrCount).toBe(3);
  });

  it("does not present a service-failed POST as either delivered or safe to retry", async () => {
    xhrScenarios = [{ status: 503, responseText: JSON.stringify({ error: "Service unavailable" }) }];
    const user = userEvent.setup();
    render(<DropUpload />);

    await screen.findByText("Secure File Delivery");
    await user.upload(screen.getByLabelText("Select Files", { selector: "input" }),
      new File(["one"], "one.txt", { type: "text/plain" }));

    expect(await screen.findByText("0 accepted · 0 failed · 1 need confirmation")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /retry confirmed failures/i })).not.toBeInTheDocument();
    expect(screen.queryByText("Your files have been delivered securely.")).not.toBeInTheDocument();
  });
});

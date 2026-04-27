import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { FileRequestsSection } from "./FileRequestsSection";

const clipboardWriteText = vi.fn();

const sampleRequest = {
  id: "req-1",
  token: "tok-1",
  description: "Q1 statements please",
  expires_at: null,
  is_active: true,
  uploaded_count: 0,
  request_url: "/request/tok-1",
  created_at: "2026-04-10T10:00:00.000Z",
};

describe("FileRequestsSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    localStorage.setItem("token", "session-token");

    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: clipboardWriteText },
      configurable: true,
    });

    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";

      if (url.endsWith("/file-requests") && method === "GET") {
        return new Response(JSON.stringify([sampleRequest]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (url.endsWith("/file-requests/req-1") && method === "DELETE") {
        return new Response(null, { status: 204 });
      }

      throw new Error(`Unhandled fetch: ${method} ${url}`);
    }) as typeof fetch;
  });

  it("renders requests through the RowActionMenu trigger", async () => {
    render(<FileRequestsSection />);

    expect(await screen.findByText("Q1 statements please")).toBeInTheDocument();
    expect(screen.getByTestId("file-request-actions-req-1")).toBeInTheDocument();
  });

  it("opens RowActionMenu and surfaces the delete-request destructive action", async () => {
    render(<FileRequestsSection />);

    await screen.findByText("Q1 statements please");
    await userEvent.click(screen.getByTestId("file-request-actions-req-1"));

    expect(await screen.findByTestId("row-action-delete-request")).toBeInTheDocument();
    expect(screen.getByTestId("row-action-copy-url")).toBeInTheDocument();
  });

  it("requests centralised destructive confirmation copy before revoking", async () => {
    render(<FileRequestsSection />);

    await screen.findByText("Q1 statements please");
    await userEvent.click(screen.getByTestId("file-request-actions-req-1"));
    await userEvent.click(await screen.findByTestId("row-action-delete-request"));

    expect(await screen.findByText(/Delete this file request\?/i)).toBeInTheDocument();
    expect(
      screen.getByText(/recipient will no longer be able to upload through this request/i),
    ).toBeInTheDocument();
  });

  it("shows the empty state CTA when no requests exist", async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(JSON.stringify([]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    ) as typeof fetch;

    render(<FileRequestsSection />);

    await waitFor(() => {
      expect(screen.getByTestId("data-state-empty")).toBeInTheDocument();
    });
    expect(screen.getByTestId("data-state-empty-action")).toHaveTextContent(/Create first request/i);
  });
});

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AccessPanel } from "./AccessPanel";

describe("AccessPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    localStorage.setItem("token", "session-token");
  });

  it("renders DataState empty when no entries", async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ summary: "Only owner", entries: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    ) as typeof fetch;

    render(<AccessPanel fileId="file-1" filename="hello.txt" onClose={() => undefined} />);

    await waitFor(() => {
      expect(screen.getByTestId("data-state-empty")).toBeInTheDocument();
    });
  });

  it("renders DataState error with retry when access summary fails", async () => {
    globalThis.fetch = vi.fn(async () => new Response(null, { status: 500 })) as typeof fetch;

    render(<AccessPanel fileId="file-1" filename="hello.txt" onClose={() => undefined} />);

    await waitFor(() => {
      expect(screen.getByTestId("data-state-error")).toBeInTheDocument();
    });
    expect(screen.getByTestId("data-state-retry")).toBeInTheDocument();
  });

  it("uses centralised destructive copy when revoking external access", async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          summary: "1 active",
          entries: [
            {
              kind: "share_link",
              label: "https://example.test/share/abc",
              since: "2026-04-10T10:00:00.000Z",
              state: "active",
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    ) as typeof fetch;

    render(<AccessPanel fileId="file-1" filename="hello.txt" onClose={() => undefined} />);

    await screen.findByText(/https:\/\/example.test\/share\/abc/i);
    await userEvent.click(screen.getByRole("button", { name: /Revoke all external access/i }));

    expect(await screen.findByText(/Revoke every external link to this file\?/i)).toBeInTheDocument();
    expect(
      screen.getByText(/All public share links and folder shares pointing to this file/i),
    ).toBeInTheDocument();
  });
});

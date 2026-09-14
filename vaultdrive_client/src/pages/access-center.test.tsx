import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import AccessCenter from "./access-center";

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
    localStorage.clear();
    localStorage.setItem("token", "session-token");
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
});

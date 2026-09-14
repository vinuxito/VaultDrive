import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import Dashboard from "./dashboard";

vi.mock("../components/dashboard/StatusPanel", () => ({
  StatusPanel: () => null,
}));

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("Dashboard truthful overview counts", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    localStorage.setItem("token", "session-token");
    localStorage.setItem("user", JSON.stringify({ first_name: "Ada", email: "ada@example.test" }));
  });

  it("shows an unavailable file count while preserving successful zero and non-zero counts", async () => {
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/files")) return jsonResponse({ message: "unavailable" }, 503);
      if (url.endsWith("/drop/tokens")) return jsonResponse([]);
      if (url.endsWith("/files/shared")) return jsonResponse([{ id: "shared-1" }]);
      if (url.endsWith("/groups")) return jsonResponse([]);
      if (url.endsWith("/activity")) return jsonResponse([]);
      if (url.endsWith("/security-posture")) return jsonResponse(null);
      throw new Error(`Unhandled fetch: ${url}`);
    }) as typeof fetch;

    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
    );

    const filesCard = await screen.findByTestId("dashboard-stat-files");
    expect(within(filesCard).getByText("—")).toBeInTheDocument();
    expect(within(filesCard).getByRole("button", { name: "Try Total Files again" })).toBeInTheDocument();
    expect(within(screen.getByTestId("dashboard-stat-links")).getByText("0")).toBeInTheDocument();
    expect(within(screen.getByTestId("dashboard-stat-shared")).getByText("1")).toBeInTheDocument();
    expect(within(screen.getByTestId("dashboard-stat-groups")).getByText("0")).toBeInTheDocument();
  });

  it("retries only the failed count source", async () => {
    const requestCounts = new Map<string, number>();
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      const path = new URL(url, "http://localhost").pathname;
      requestCounts.set(path, (requestCounts.get(path) ?? 0) + 1);
      if (path.endsWith("/files")) {
        return requestCounts.get(path) === 1
          ? jsonResponse({ message: "unavailable" }, 503)
          : jsonResponse([{ id: "file-1" }, { id: "file-2" }]);
      }
      if (path.endsWith("/drop/tokens") || path.endsWith("/files/shared") || path.endsWith("/groups") || path.endsWith("/activity")) {
        return jsonResponse([]);
      }
      if (path.endsWith("/security-posture")) return jsonResponse(null);
      throw new Error(`Unhandled fetch: ${url}`);
    }) as typeof fetch;

    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
    );

    const filesCard = await screen.findByTestId("dashboard-stat-files");
    await userEvent.click(within(filesCard).getByRole("button", { name: "Try Total Files again" }));

    await waitFor(() => expect(within(screen.getByTestId("dashboard-stat-files")).getByText("2")).toBeInTheDocument());
    const callsFor = (suffix: string) => Array.from(requestCounts.entries())
      .filter(([path]) => path.endsWith(suffix))
      .reduce((total, [, count]) => total + count, 0);
    expect(callsFor("/files")).toBe(2);
    expect(callsFor("/drop/tokens")).toBe(1);
    expect(callsFor("/files/shared")).toBe(1);
    expect(callsFor("/groups")).toBe(1);
  });

  it("keeps the last successful count and marks it stale when refresh fails", async () => {
    let fileRequests = 0;
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/files")) {
        fileRequests += 1;
        return fileRequests === 1
          ? jsonResponse([{ id: "file-1" }])
          : jsonResponse({ message: "unavailable" }, 503);
      }
      if (url.endsWith("/drop/tokens") || url.endsWith("/files/shared") || url.endsWith("/groups") || url.endsWith("/activity")) {
        return jsonResponse([]);
      }
      if (url.endsWith("/security-posture")) return jsonResponse(null);
      throw new Error(`Unhandled fetch: ${url}`);
    }) as typeof fetch;

    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
    );

    const filesCard = await screen.findByTestId("dashboard-stat-files");
    expect(within(filesCard).getByText("1")).toBeInTheDocument();
    await userEvent.click(within(filesCard).getByRole("button", { name: "Refresh Total Files" }));

    const refreshedFilesCard = await screen.findByTestId("dashboard-stat-files");
    expect(await within(refreshedFilesCard).findByText("May be out of date")).toBeInTheDocument();
    expect(within(refreshedFilesCard).getByText("1")).toBeInTheDocument();
  });
});

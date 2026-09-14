import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import Profile from "./profile";
import AdminTests from "./admin-tests";
import HelpCenter from "./help";

vi.mock("../components/layout/dashboard-layout", () => ({
  DashboardLayout: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="nested-dashboard-layout">{children}</div>
  ),
}));

describe("authenticated route pages", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("token", "test-token");
    localStorage.setItem(
      "user",
      JSON.stringify({
        username: "ada",
        first_name: "Ada",
        last_name: "Lovelace",
        email: "ada@example.com",
      }),
    );
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          username: "ada",
          first_name: "Ada",
          last_name: "Lovelace",
          email: "ada@example.com",
        }),
      }),
    );
  });

  it.each([
    ["profile", <Profile />],
    ["admin tests", <AdminTests />],
    ["help", <HelpCenter />],
  ])("lets ProtectedRoute own the shell for %s", (_name, page) => {
    render(<MemoryRouter>{page}</MemoryRouter>);

    expect(screen.queryByTestId("nested-dashboard-layout")).not.toBeInTheDocument();
  });
});

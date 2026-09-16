import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { Sidebar } from "./sidebar";

const { logout } = vi.hoisted(() => ({ logout: vi.fn() }));

vi.mock("../../hooks", () => ({
  useTransitionNavigate: () => vi.fn(),
  useLogout: () => logout,
}));

describe("Sidebar", () => {
  it("marks nested group routes active and exposes role-appropriate destinations", () => {
    localStorage.setItem("user", JSON.stringify({ username: "ada", is_admin: true }));
    render(
      <MemoryRouter initialEntries={["/groups/group-1"]}>
        <Sidebar />
      </MemoryRouter>,
    );

    expect(screen.getByRole("button", { name: "Groups" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: "Profile" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Admin" })).toBeInTheDocument();
  });

  it("uses the shared logout operation", async () => {
    logout.mockClear();
    render(
      <MemoryRouter initialEntries={["/files"]}>
        <Sidebar />
      </MemoryRouter>,
    );

    await userEvent.click(screen.getByRole("button", { name: "Logout" }));

    expect(logout).toHaveBeenCalledOnce();
  });
});

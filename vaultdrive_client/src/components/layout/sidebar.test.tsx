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

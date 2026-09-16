import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MobileNav } from "./mobile-nav";

const { logout } = vi.hoisted(() => ({ logout: vi.fn() }));

vi.mock("../../hooks", () => ({
  useTransitionNavigate: () => vi.fn(),
  useLogout: () => logout,
}));

describe("MobileNav", () => {
  beforeEach(() => {
    logout.mockClear();
    localStorage.clear();
    localStorage.setItem(
      "user",
      JSON.stringify({
        username: "ada",
        first_name: "Ada",
        last_name: "Lovelace",
        email: "ada@example.com",
      }),
    );
  });

  it("offers every primary owner destination in the phone drawer", () => {
    render(
      <MemoryRouter initialEntries={["/files"]}>
        <MobileNav isOpen onClose={vi.fn()} />
      </MemoryRouter>,
    );

    expect(screen.getByRole("dialog", { name: "Main navigation" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute("href", "/dashboard");
    expect(screen.getByRole("link", { name: "Access Center" })).toHaveAttribute("href", "/access-center");
    expect(screen.getByRole("link", { name: "Help Center" })).toHaveAttribute("href", "/help");
  });

  it("traps focus, closes with Escape, and restores the opener", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    const { rerender } = render(
      <MemoryRouter initialEntries={["/groups/group-1"]}>
        <button type="button">Open navigation</button>
        <MobileNav isOpen={false} onClose={onClose} />
      </MemoryRouter>,
    );
    const opener = screen.getByRole("button", { name: "Open navigation" });
    opener.focus();

    rerender(
      <MemoryRouter initialEntries={["/groups/group-1"]}>
        <button type="button">Open navigation</button>
        <MobileNav isOpen onClose={onClose} />
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: "Groups" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Home" })).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledOnce();

    rerender(
      <MemoryRouter initialEntries={["/groups/group-1"]}>
        <button type="button">Open navigation</button>
        <MobileNav isOpen={false} onClose={onClose} />
      </MemoryRouter>,
    );
    expect(screen.getByRole("button", { name: "Open navigation" })).toHaveFocus();
  });

  it("uses the shared logout operation and closes the drawer", async () => {
    const onClose = vi.fn();
    render(
      <MemoryRouter initialEntries={["/files"]}>
        <MobileNav isOpen onClose={onClose} />
      </MemoryRouter>,
    );

    await userEvent.click(screen.getByRole("button", { name: "Logout" }));

    expect(logout).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });
});

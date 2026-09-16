import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { CommandPalette } from "./command-palette";

const { logout } = vi.hoisted(() => ({ logout: vi.fn() }));

vi.mock("../../hooks/useFileSearch", () => ({
  useFileSearch: () => [],
}));

vi.mock("../../hooks/useLogout", () => ({
  useLogout: () => logout,
}));

beforeAll(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  Element.prototype.scrollIntoView = vi.fn();
});

describe("CommandPalette", () => {
  it("does not open on public routes without an authenticated session", async () => {
    localStorage.clear();
    render(
      <MemoryRouter initialEntries={["/share/public-token"]}>
        <CommandPalette />
      </MemoryRouter>,
    );

    await userEvent.keyboard("{Control>}k{/Control}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes with Escape and restores focus to the opener", async () => {
    localStorage.setItem("token", "session-token");
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <button type="button">Open search</button>
        <CommandPalette />
      </MemoryRouter>,
    );

    const opener = screen.getByRole("button", { name: "Open search" });
    opener.focus();
    await user.keyboard("{Control>}k{/Control}");

    expect(screen.getByRole("dialog", { name: "Search and commands" })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Search .* or type a command/i)).toHaveFocus();

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog", { name: "Search and commands" })).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });

  it("keeps tab focus inside the open dialog", async () => {
    localStorage.setItem("token", "session-token");
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <button type="button">Outside</button>
        <CommandPalette />
      </MemoryRouter>,
    );

    screen.getByRole("button", { name: "Outside" }).focus();
    await user.keyboard("{Control>}k{/Control}");
    const search = screen.getByPlaceholderText(/Search .* or type a command/i);

    await user.tab();

    expect(search).toHaveFocus();
  });

  it("uses the shared logout operation", async () => {
    localStorage.setItem("token", "session-token");
    logout.mockClear();
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <button type="button">Open search</button>
        <CommandPalette />
      </MemoryRouter>,
    );

    await user.keyboard("{Control>}k{/Control}");
    await user.click(screen.getByText("Logout"));

    expect(logout).toHaveBeenCalledOnce();
  });

  it("uses the same navigation names and exposes all owner destinations", async () => {
    localStorage.setItem("token", "session-token");
    localStorage.setItem("user", JSON.stringify({ username: "ada", is_admin: true }));
    render(
      <MemoryRouter initialEntries={["/files"]}>
        <CommandPalette />
      </MemoryRouter>,
    );

    await userEvent.keyboard("{Control>}k{/Control}");

    expect(screen.getByText("Files", { selector: "[cmdk-item]" })).toBeInTheDocument();
    expect(screen.getByText("Shared with Me", { selector: "[cmdk-item]" })).toBeInTheDocument();
    expect(screen.getByText("Profile", { selector: "[cmdk-item]" })).toBeInTheDocument();
    expect(screen.getByText("Help Center", { selector: "[cmdk-item]" })).toBeInTheDocument();
    expect(screen.getByText("Admin", { selector: "[cmdk-item]" })).toBeInTheDocument();
    expect(screen.getByText("Logout", { selector: "[cmdk-item]" })).toBeInTheDocument();
  });
});

import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MobileNav } from "./mobile-nav";

vi.mock("../../hooks", () => ({
  useTransitionNavigate: () => vi.fn(),
}));

describe("MobileNav", () => {
  beforeEach(() => {
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

    expect(screen.getByRole("menuitem", { name: "Dashboard" })).toHaveAttribute("href", "/dashboard");
    expect(screen.getByRole("menuitem", { name: "Access Center" })).toHaveAttribute("href", "/access-center");
    expect(screen.getByRole("menuitem", { name: "Help Center" })).toHaveAttribute("href", "/help");
  });
});

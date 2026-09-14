import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";

import NotFound from "./not-found";

describe("NotFound", () => {
  beforeEach(() => localStorage.clear());

  it("gives a signed-out visitor a safe route back to the product", () => {
    render(
      <MemoryRouter>
        <NotFound />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "Page not found" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to home" })).toHaveAttribute("href", "/");
  });

  it("returns an authenticated user to their files", () => {
    localStorage.setItem("token", "access-token");

    render(
      <MemoryRouter>
        <NotFound />
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: "Go to my files" })).toHaveAttribute("href", "/files");
  });
});

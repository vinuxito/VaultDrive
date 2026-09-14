import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import App from "./App";

vi.mock("./components/ui/command-palette", () => ({
  CommandPalette: () => null,
}));

describe("App routes", () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState({}, "", "/quantix/a-route-that-does-not-exist");
  });

  it("renders a useful recovery screen for an unknown route", async () => {
    render(<App />);

    expect(await screen.findByRole("heading", { name: "Page not found" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to home" })).toHaveAttribute("href", "/quantix");
  });
});

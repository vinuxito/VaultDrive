import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation, useNavigate } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import HelpCenter from ".";

vi.mock("./components/HelpSidebar", () => ({
  HelpSidebar: ({ onSelect }: { onSelect: (section: string) => void }) => (
    <button type="button" onClick={() => onSelect("uploads_shares")}>Uploads help</button>
  ),
}));

vi.mock("./components/HelpContent", () => ({
  HelpContent: ({ activeSection }: { activeSection: string }) => <output>{activeSection}</output>,
}));

function HistoryControls() {
  const navigate = useNavigate();
  const location = useLocation();
  return (
    <>
      <button type="button" onClick={() => navigate(-1)}>Back</button>
      <output data-testid="search">{location.search}</output>
    </>
  );
}

describe("HelpCenter section URLs", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("user", JSON.stringify({ username: "ada", is_admin: false }));
  });

  it("keeps a selected section through its URL and browser Back", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/help?section=vault_pin"]}>
        <HelpCenter />
        <HistoryControls />
      </MemoryRouter>,
    );

    expect(screen.getByText("vault_pin")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Uploads help" }));
    expect(screen.getByText("uploads_shares")).toBeInTheDocument();
    expect(screen.getByTestId("search")).toHaveTextContent("?section=uploads_shares");

    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByText("vault_pin")).toBeInTheDocument();
  });

  it("does not expose an admin-only section to a regular owner", () => {
    render(
      <MemoryRouter initialEntries={["/help?section=user_management"]}>
        <HelpCenter />
      </MemoryRouter>,
    );

    expect(screen.getByText("getting_started")).toBeInTheDocument();
    expect(screen.queryByText("user_management")).not.toBeInTheDocument();
  });
});

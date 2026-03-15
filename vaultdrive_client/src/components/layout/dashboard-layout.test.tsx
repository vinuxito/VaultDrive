import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DashboardLayout } from "./dashboard-layout";

vi.mock("../../context/SessionVaultContext", () => ({
  useSessionVault: () => ({ clearVault: vi.fn() }),
}));

vi.mock("../../hooks", () => ({
  useSSE: () => undefined,
}));

vi.mock("./sidebar", () => ({
  Sidebar: () => <div data-testid="sidebar" />,
}));

vi.mock("./mobile-nav", () => ({
  MobileNav: () => <div data-testid="mobile-nav" />,
}));

vi.mock("../mobile/bottom-nav", () => ({
  BottomNav: () => <div data-testid="bottom-nav" />,
}));

vi.mock("./command-palette", () => ({
  CommandPalette: () => null,
}));

vi.mock("./ActivityFeedPanel", () => ({
  ActivityFeedPanel: () => null,
}));

vi.mock("./Toast", () => ({
  Toast: () => null,
}));

vi.mock("../onboarding/OnboardingWizard", () => ({
  OnboardingWizard: () => <div>PIN setup wizard</div>,
}));

describe("DashboardLayout", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();

    localStorage.setItem(
      "user",
      JSON.stringify({
        pin_set: false,
        first_name: "Ada",
        last_name: "Lovelace",
        email: "ada@example.com",
      }),
    );

  });

  it("still blocks the authenticated shell when the user has not set a pin", () => {
    render(
      <MemoryRouter>
        <DashboardLayout>
          <div>Vault content</div>
        </DashboardLayout>
      </MemoryRouter>,
    );

    expect(screen.getByText("PIN setup wizard")).toBeInTheDocument();
  });
});

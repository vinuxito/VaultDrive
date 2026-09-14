import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { OnboardingWizard } from "./OnboardingWizard";

vi.mock("../../context/SessionVaultContext", () => ({
  useSessionVault: () => ({ setCredential: vi.fn() }),
}));

vi.mock("../../utils/pin-enrollment", () => ({
  createPinProtectedPrivateKey: vi.fn().mockResolvedValue({
    privateKeyPinEncrypted: "pin-wrapped-key",
    reEncryptedPrivateKey: null,
  }),
  getPinEnrollmentErrorMessage: (error: unknown) => String(error),
}));

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{JSON.stringify({ pathname: location.pathname, state: location.state })}</output>;
}

describe("OnboardingWizard first-task handoff", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("token", "test-token");
    localStorage.setItem(
      "user",
      JSON.stringify({ username: "ada", pin_set: false, private_key_encrypted: "wrapped-key" }),
    );
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }),
    );
  });

  it("offers a real first task instead of marking unperformed work complete", async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <OnboardingWizard onComplete={onComplete} />
        <LocationProbe />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: /Continue/i }));
    await user.type(screen.getByLabelText("4-Digit PIN"), "1234");
    await user.type(screen.getByLabelText("Confirm PIN"), "1234");
    await user.type(screen.getByLabelText("Account Password"), "correct-password");
    await user.click(screen.getByRole("button", { name: /Set PIN/i }));
    await screen.findByRole("heading", { name: "Create a client folder" });
    await user.click(screen.getByRole("button", { name: "Skip for now" }));

    expect(screen.queryByText("Ready checklist")).not.toBeInTheDocument();
    expect(screen.queryByText(/You can see, review, and revoke/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "drive:onboarding.firstTaskUpload" }));

    expect(onComplete).toHaveBeenCalledOnce();
    await waitFor(() => {
      expect(screen.getByTestId("location")).toHaveTextContent('"pathname":"/files"');
      expect(screen.getByTestId("location")).toHaveTextContent('"onboardingTask":"upload"');
    });
  });
});

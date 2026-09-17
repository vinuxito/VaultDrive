import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { OnboardingWizard } from "./OnboardingWizard";

const pinEnrollmentMocks = vi.hoisted(() => ({
  createPinProtectedPrivateKey: vi.fn(),
}));

vi.mock("../../context/SessionVaultContext", () => ({
  useSessionVault: () => ({ setCredential: vi.fn() }),
}));

vi.mock("../../utils/pin-enrollment", () => ({
  createPinProtectedPrivateKey: pinEnrollmentMocks.createPinProtectedPrivateKey,
  getPinEnrollmentErrorMessage: (error: unknown) => String(error),
}));

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{JSON.stringify({ pathname: location.pathname, state: location.state })}</output>;
}

describe("OnboardingWizard first-task handoff", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    localStorage.setItem("token", "test-token");
    localStorage.setItem(
      "user",
      JSON.stringify({ username: "ada", pin_set: false, private_key_encrypted: "wrapped-key", kek_envelope_version: 2 }),
    );
    pinEnrollmentMocks.createPinProtectedPrivateKey.mockResolvedValue({
      privateKeyPinEncrypted: "pin-wrapped-key",
    });
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

    const request = vi.mocked(fetch).mock.calls[0][1] as RequestInit;
    expect(JSON.parse(String(request.body))).toEqual({
      pin: "1234",
      private_key_pin_encrypted: "pin-wrapped-key",
      kek_envelope_version: 2,
    });

    await user.click(screen.getByRole("button", { name: "Skip for now" }));

    expect(screen.queryByText("Ready checklist")).not.toBeInTheDocument();
    expect(screen.queryByText(/You can see, review, and revoke/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Upload a file" }));

    expect(onComplete).toHaveBeenCalledOnce();
    await waitFor(() => {
      expect(screen.getByTestId("location")).toHaveTextContent('"pathname":"/files"');
      expect(screen.getByTestId("location")).toHaveTextContent('"onboardingTask":"upload"');
    });
  });

  it("provides named reveal controls for every setup credential", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <OnboardingWizard onComplete={vi.fn()} />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: /Continue/i }));

    const pin = screen.getByLabelText("4-Digit PIN");
    const confirmPin = screen.getByLabelText("Confirm PIN");
    const password = screen.getByLabelText("Account Password");
    expect(pin).toHaveAttribute("type", "password");
    expect(confirmPin).toHaveAttribute("type", "password");
    expect(password).toHaveAttribute("type", "password");

    await user.click(screen.getByRole("button", { name: /^show pin$/i }));
    await user.click(screen.getByRole("button", { name: /^show pin confirmation$/i }));
    await user.click(screen.getByRole("button", { name: /show account password/i }));

    expect(pin).toHaveAttribute("type", "text");
    expect(confirmPin).toHaveAttribute("type", "text");
    expect(password).toHaveAttribute("type", "text");
  });

  it("persists a repaired password envelope with its version in the atomic PIN request", async () => {
    const user = userEvent.setup();
    pinEnrollmentMocks.createPinProtectedPrivateKey.mockResolvedValue({
      privateKeyPinEncrypted: "pin-wrapped-key-v2",
      reEncryptedPrivateKey: "repaired-password-wrapper-v2",
    });
    const fetchMock = vi.mocked(fetch);

    render(
      <MemoryRouter>
        <OnboardingWizard onComplete={vi.fn()} />
      </MemoryRouter>,
    );
    await user.click(screen.getByRole("button", { name: /Continue/i }));
    await user.type(screen.getByLabelText("4-Digit PIN"), "1234");
    await user.type(screen.getByLabelText("Confirm PIN"), "1234");
    await user.type(screen.getByLabelText("Account Password"), "new-account-password");
    await user.click(screen.getByRole("button", { name: /Set PIN/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const request = fetchMock.mock.calls[0][1] as RequestInit;
    expect(JSON.parse(String(request.body))).toEqual({
      pin: "1234",
      private_key_pin_encrypted: "pin-wrapped-key-v2",
      private_key_encrypted: "repaired-password-wrapper-v2",
      kek_envelope_version: 2,
    });
  });
});

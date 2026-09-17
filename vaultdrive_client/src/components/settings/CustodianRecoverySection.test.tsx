import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";

import { CustodianRecoverySection } from "./CustodianRecoverySection";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key }),
}));
vi.mock("../../context/SessionVaultContext", () => ({
  useSessionVault: () => ({ getCredential: () => null }),
}));

describe("custodian recovery request boundaries", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("token", "jwt-token");
    localStorage.setItem("user", JSON.stringify({ id: "custodian-1", username: "custodian" }));
  });

  it("loads configuration through JWT auth and shows only active attempt verification details", async () => {
    const fetchMock = vi.fn((input: string, _init?: RequestInit) => {
      if (input.endsWith("/v1/recovery/config")) {
        return Promise.resolve(new Response(JSON.stringify({ threshold: 1, shares: [] }), { status: 200 }));
      }
      return Promise.resolve(new Response(JSON.stringify([{
        id: "approval-1",
        attempt_id: "attempt-1",
        challenge: "challenge-1234567890",
        verification_code: "A1B2C3D4",
        expires_at: "2026-09-17T12:00:00Z",
        owner_username: "owner",
        owner_first_name: "Owner",
        owner_last_name: "User",
        wrapped_share_payload: "{}",
      }]), { status: 200 }));
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<CustodianRecoverySection />);

    expect(await screen.findByTestId("custodian-recovery-code-attempt-1")).toHaveTextContent("A1B2C3D4");
    expect(screen.getByText(/confirm this exact code/i)).toBeInTheDocument();
    const approve = screen.getByRole("button", { name: "Approve Recovery" });
    expect(approve).toBeDisabled();
    await userEvent.click(screen.getByRole("checkbox"));
    expect(approve).toBeEnabled();
    expect(screen.queryByText(/owner@example/i)).not.toBeInTheDocument();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(fetchMock.mock.calls[0][0]).toContain("/v1/recovery/config");
    expect((fetchMock.mock.calls[0][1] as RequestInit).headers).toEqual({ Authorization: "Bearer jwt-token" });
    expect(String(fetchMock.mock.calls[0][0])).not.toContain("username=");
  });
});

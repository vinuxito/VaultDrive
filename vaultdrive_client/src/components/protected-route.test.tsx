import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ProtectedRoute } from "./protected-route";

const vaultMocks = vi.hoisted(() => ({ clearVault: vi.fn() }));

vi.mock("../context/SessionVaultContext", () => ({
  useSessionVault: () => vaultMocks,
}));

vi.mock("./layout/dashboard-layout", () => ({
  DashboardLayout: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

function LoginProbe() {
  const location = useLocation();
  return <pre>login:{JSON.stringify(location.state)}</pre>;
}

function renderRoute(entry = "/files?folder=mine#client-secret") {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/login" element={<LoginProbe />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/files" element={<div>private files</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe("ProtectedRoute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
  });

  it("clears malformed session material and preserves a safe fragment-free login intent", async () => {
    localStorage.setItem("token", "not-a-jwt");
    localStorage.setItem("refresh_token", "refresh");
    localStorage.setItem("user", "{bad-json");
    sessionStorage.setItem("vault_cached_credential", "secret");

    renderRoute();

    expect(await screen.findByText(/login:/)).toHaveTextContent('/files');
    expect(screen.getByText(/login:/)).not.toHaveTextContent('?folder=mine');
    expect(screen.getByText(/login:/)).not.toHaveTextContent('client-secret');
    await waitFor(() => expect(vaultMocks.clearVault).toHaveBeenCalled());
    expect(localStorage.getItem("refresh_token")).toBeNull();
    expect(sessionStorage.getItem("vault_cached_credential")).toBeNull();
  });

  it("keeps opaque fixture sessions server-authoritative", async () => {
    localStorage.setItem("token", "visual-fixture-token");
    localStorage.setItem("user", JSON.stringify({ id: "owner" }));

    renderRoute("/files");

    expect(await screen.findByText("private files")).toBeInTheDocument();
    expect(vaultMocks.clearVault).not.toHaveBeenCalled();
  });

  it("clears an explicitly expired JWT", async () => {
    const payload = btoa(JSON.stringify({ exp: 1 })).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
    localStorage.setItem("token", `header.${payload}.signature`);
    localStorage.setItem("refresh_token", "refresh");
    localStorage.setItem("user", JSON.stringify({ id: "owner" }));

    renderRoute("/files");

    expect(await screen.findByText(/login:/)).toBeInTheDocument();
    await waitFor(() => expect(localStorage.getItem("token")).toBeNull());
    expect(vaultMocks.clearVault).toHaveBeenCalled();
  });
});

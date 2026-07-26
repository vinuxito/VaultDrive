import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SessionVaultProvider, useSessionVault } from "./SessionVaultContext";
import { useEffect, useState } from "react";
import { webcrypto } from "crypto";

// Mock global crypto in jsdom environment using Node's native WebCrypto
Object.defineProperty(globalThis, "crypto", {
  value: webcrypto,
  configurable: true,
  writable: true,
});

interface CachedCredential {
  value: string;
  type: "pin" | "password";
}

function TestComponent() {
  const vault = useSessionVault();
  const [cred, setCred] = useState<CachedCredential | null>(null);

  useEffect(() => {
    vault.setCredential("9876", "pin");
  }, [vault]);

  return (
    <div>
      <span data-testid="cred-val">{cred?.value || ""}</span>
      <span data-testid="cred-type">{cred?.type || ""}</span>
      <button onClick={() => setCred(vault.getCredential())}>Fetch</button>
      <button onClick={() => vault.clearVault()}>Clear</button>
    </div>
  );
}

function VaultProbe() {
  const vault = useSessionVault();
  const [credential, setCredential] = useState<CachedCredential | null>(null);
  return (
    <div>
      <span data-testid="probe-value">{credential?.value ?? ""}</span>
      <button onClick={() => vault.setCredential("12x4", "pin")}>Set invalid PIN</button>
      <button onClick={() => vault.setCredential("4321", "pin")}>Set valid PIN</button>
      <button onClick={() => {
        vault.setCredential("1234", "pin");
        vault.clearCredential();
      }}>Set then clear PIN</button>
      <button onClick={() => vault.clearCredential()}>Clear credential only</button>
      <button onClick={() => setCredential(vault.getCredential())}>Read credential</button>
    </div>
  );
}

describe("SessionVaultContext", () => {
  it("caches and retrieves credentials in memory and sessionStorage", async () => {
    sessionStorage.clear();
    render(
      <SessionVaultProvider>
        <TestComponent />
      </SessionVaultProvider>
    );

    // waitFor will retry until sessionStorage is updated asynchronously
    await waitFor(() => {
      fireEvent.click(screen.getByText("Fetch"));
      expect(screen.getByTestId("cred-val").textContent).toBe("9876");
      expect(screen.getByTestId("cred-type").textContent).toBe("pin");
      expect(sessionStorage.getItem("vault_cached_credential")).not.toBeNull();
    }, { timeout: 6000 });
  });

  it("removes corrupted cached credentials during restore", async () => {
    sessionStorage.clear();
    sessionStorage.setItem("vault_cached_credential", "not-valid-ciphertext");

    render(
      <SessionVaultProvider>
        <VaultProbe />
      </SessionVaultProvider>
    );

    await waitFor(() => {
      expect(sessionStorage.getItem("vault_cached_credential")).toBeNull();
    });
    fireEvent.click(screen.getByText("Read credential"));
    expect(screen.getByTestId("probe-value")).toHaveTextContent("");
  });

  it("does not cache a PIN unless it is exactly four digits", async () => {
    sessionStorage.clear();
    render(
      <SessionVaultProvider>
        <VaultProbe />
      </SessionVaultProvider>
    );

    fireEvent.click(screen.getByText("Set invalid PIN"));
    fireEvent.click(screen.getByText("Read credential"));

    expect(screen.getByTestId("probe-value")).toHaveTextContent("");
    expect(sessionStorage.getItem("vault_cached_credential")).toBeNull();
  });

  it("does not let a pending encrypted write restore a cleared credential", async () => {
    sessionStorage.clear();
    render(
      <SessionVaultProvider>
        <VaultProbe />
      </SessionVaultProvider>
    );

    fireEvent.click(screen.getByText("Set then clear PIN"));

    await waitFor(() => {
      expect(sessionStorage.getItem("vault_cached_credential")).toBeNull();
    });
    fireEvent.click(screen.getByText("Read credential"));
    expect(screen.getByTestId("probe-value")).toBeEmptyDOMElement();
  });

  it("does not let an in-flight restore overwrite a newer clear", async () => {
    sessionStorage.clear();
    const seeded = render(
      <SessionVaultProvider>
        <TestComponent />
      </SessionVaultProvider>
    );
    await waitFor(() => {
      expect(sessionStorage.getItem("vault_cached_credential")).not.toBeNull();
    });
    seeded.unmount();

    render(
      <SessionVaultProvider>
        <VaultProbe />
      </SessionVaultProvider>
    );
    fireEvent.click(screen.getByText("Clear credential only"));

    await new Promise((resolve) => setTimeout(resolve, 50));
    fireEvent.click(screen.getByText("Read credential"));
    expect(screen.getByTestId("probe-value")).toBeEmptyDOMElement();
    expect(sessionStorage.getItem("vault_cached_credential")).toBeNull();
  });

  it("does not let a failed stale restore clear a newer valid credential", async () => {
    sessionStorage.clear();
    sessionStorage.setItem("vault_cached_credential", "corrupted-old-cache");
    const decryptSpy = vi.spyOn(window.crypto.subtle, "decrypt").mockImplementationOnce(
      () => new Promise((_, reject) => {
        setTimeout(() => reject(new Error("stale restore failed")), 50);
      }),
    );

    render(
      <SessionVaultProvider>
        <VaultProbe />
      </SessionVaultProvider>
    );
    fireEvent.click(screen.getByText("Set valid PIN"));

    await new Promise((resolve) => setTimeout(resolve, 100));
    fireEvent.click(screen.getByText("Read credential"));
    expect(screen.getByTestId("probe-value")).toHaveTextContent("4321");
    expect(sessionStorage.getItem("vault_cached_credential")).not.toBeNull();
    decryptSpy.mockRestore();
  });
});

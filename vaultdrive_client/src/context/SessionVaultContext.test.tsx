import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
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
});

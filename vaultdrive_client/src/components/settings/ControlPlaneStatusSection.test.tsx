import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ControlPlaneStatusSection } from "./ControlPlaneStatusSection";

vi.mock("../../hooks/useSSE", () => ({
  useSSE: () => undefined,
}));

describe("ControlPlaneStatusSection", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("token", "token-1");
  });

  it("cancels its snapshot requests when unmounted", async () => {
    const signals: AbortSignal[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string | URL | Request, init?: RequestInit) => {
        if (init?.signal) signals.push(init.signal);
        return new Promise<Response>(() => undefined);
      }),
    );

    const { unmount } = render(<ControlPlaneStatusSection />);
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    unmount();

    expect(signals).toHaveLength(2);
    expect(signals.every((signal) => signal.aborted)).toBe(true);
  });
});

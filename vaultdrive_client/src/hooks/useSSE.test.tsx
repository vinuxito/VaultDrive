import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ActivityEvent } from "./useSSE";

const unauthorizedMock = vi.hoisted(() => vi.fn());

vi.mock("../utils/auth-session", () => ({
  handleUnauthorized: unauthorizedMock,
}));

class FakeEventSource {
  static instances: FakeEventSource[] = [];

  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: (() => void) | null = null;
  readonly close = vi.fn();
  readonly url: string;

  constructor(url: string) {
    this.url = url;
    FakeEventSource.instances.push(this);
  }

  emit(data: Record<string, unknown>) {
    this.onmessage?.({ data: JSON.stringify(data) } as MessageEvent);
  }
}

describe("useSSE", () => {
  beforeEach(() => {
    vi.resetModules();
    FakeEventSource.instances = [];
    localStorage.clear();
    localStorage.setItem("token", "token-1");
    vi.stubGlobal("EventSource", FakeEventSource);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ ticket: "ticket-1" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("delivers events to the latest callback without reconnecting", async () => {
    const first = vi.fn();
    const latest = vi.fn();
    const { useSSE } = await import("./useSSE");

    function Subscriber({ onEvent }: { onEvent: (event: ActivityEvent) => void }) {
      useSSE(onEvent);
      return null;
    }

    const { rerender } = render(<Subscriber onEvent={first} />);
    await vi.waitFor(() => expect(FakeEventSource.instances).toHaveLength(1));

    rerender(<Subscriber onEvent={latest} />);
    act(() => {
      FakeEventSource.instances[0].emit({
        id: "event-1",
        event_type: "file_uploaded",
        payload: {},
        created_at: "2026-09-14T00:00:00Z",
      });
    });

    expect(first).not.toHaveBeenCalled();
    expect(latest).toHaveBeenCalledWith(
      expect.objectContaining({ id: "event-1", event_type: "file_uploaded" }),
    );
    expect(FakeEventSource.instances).toHaveLength(1);
  });

  it("closes the shared connection when the final subscriber unmounts", async () => {
    const { useSSE } = await import("./useSSE");

    function Subscriber() {
      useSSE(() => undefined);
      return null;
    }

    const { unmount } = render(<Subscriber />);
    await vi.waitFor(() => expect(FakeEventSource.instances).toHaveLength(1));
    const source = FakeEventSource.instances[0];

    unmount();

    expect(source.close).toHaveBeenCalledTimes(1);
  });
});

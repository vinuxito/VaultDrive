import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ActivityEvent } from "./useSSE";

const unauthorizedMock = vi.hoisted(() => vi.fn());

vi.mock("../utils/auth-session", () => ({
  handleUnauthorized: unauthorizedMock,
}));

class FakeEventSource {
  static instances: FakeEventSource[] = [];

  onmessage: ((event: MessageEvent) => void) | null = null;
  onopen: (() => void) | null = null;
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
    vi.useRealTimers();
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

  it("does not open a stream from a ticket returned after unmount", async () => {
    let resolve!: (value: Response) => void;
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>((done) => { resolve = done; })));
    const { useSSE } = await import("./useSSE");
    function Subscriber() { useSSE(() => undefined); return null; }
    const { unmount } = render(<Subscriber />);
    unmount();
    await act(async () => resolve(new Response(JSON.stringify({ ticket: "late-ticket" }))));
    expect(FakeEventSource.instances).toHaveLength(0);
  });

  it("reports ticket failure as reconnecting and retries without a health claim", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(new Response("{}", { status: 503 })).mockResolvedValueOnce(new Response(JSON.stringify({ ticket: "retry-ticket" }))));
    const { useSSE } = await import("./useSSE");
    function Subscriber() { const status = useSSE(() => undefined); return <output>{String(status)}</output>; }
    render(<Subscriber />);
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(screen.getByRole("status")).toHaveTextContent("reconnecting");
    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
    expect(FakeEventSource.instances).toHaveLength(1);
    act(() => FakeEventSource.instances[0].onopen?.());
    expect(screen.getByRole("status")).toHaveTextContent("live");
  });

  it("ignores an old account ticket response after auth changes", async () => {
    let resolve!: (value: Response) => void;
    vi.stubGlobal("fetch", vi.fn().mockImplementationOnce(() => new Promise<Response>((done) => { resolve = done; })).mockResolvedValueOnce(new Response(JSON.stringify({ ticket: "new-account" }))));
    const { useSSE } = await import("./useSSE");
    function Subscriber() { useSSE(() => undefined); return null; }
    render(<Subscriber />);
    await act(async () => { localStorage.setItem("token", "token-2"); window.dispatchEvent(new Event("auth-change")); });
    await act(async () => resolve(new Response("{}", { status: 401 })));
    expect(unauthorizedMock).not.toHaveBeenCalled();
    expect(FakeEventSource.instances).toHaveLength(1);
    expect(FakeEventSource.instances[0].url).toContain("new-account");
  });

  it("keeps forbidden live updates distinct from reconnecting without a retry loop", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 403 }));
    vi.stubGlobal("fetch", fetchMock);
    const { useSSE } = await import("./useSSE");
    function Subscriber() { const status = useSSE(() => undefined); return <output>{status}</output>; }
    render(<Subscriber />);
    await act(async () => { await vi.advanceTimersByTimeAsync(30000); });
    expect(screen.getByRole("status")).toHaveTextContent("forbidden");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(FakeEventSource.instances).toHaveLength(0);
  });
});

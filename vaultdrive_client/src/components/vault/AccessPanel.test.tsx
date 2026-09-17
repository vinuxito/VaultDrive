import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AccessPanel } from "./AccessPanel";

describe("AccessPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    localStorage.setItem("token", "session-token");
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders DataState empty when no entries", async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ summary: "Only owner", entries: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    ) as typeof fetch;

    render(<AccessPanel fileId="file-1" filename="hello.txt" onClose={() => undefined} />);

    await waitFor(() => {
      expect(screen.getByTestId("data-state-empty")).toBeInTheDocument();
    });
  });

  it("renders DataState error with retry when access summary fails", async () => {
    globalThis.fetch = vi.fn(async () => new Response(null, { status: 500 })) as typeof fetch;

    render(<AccessPanel fileId="file-1" filename="hello.txt" onClose={() => undefined} />);

    await waitFor(() => {
      expect(screen.getByTestId("data-state-error")).toBeInTheDocument();
    });
    expect(screen.getByTestId("data-state-retry")).toBeInTheDocument();
  });

  it("DataState retry button re-fetches the access summary", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 500 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            summary: "1 active",
            entries: [
              {
                kind: "share_link",
                label: "https://example.test/share/r",
                since: "2026-04-10T10:00:00.000Z",
                state: "active",
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    render(<AccessPanel fileId="file-1" filename="hello.txt" onClose={() => undefined} />);

    const retry = await screen.findByTestId("data-state-retry");
    await userEvent.click(retry);
    await screen.findByText(/https:\/\/example.test\/share\/r/i);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("uses centralised destructive copy when revoking external access", async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          summary: "1 active",
          entries: [
            {
              kind: "share_link",
              label: "https://example.test/share/abc",
              since: "2026-04-10T10:00:00.000Z",
              state: "active",
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    ) as typeof fetch;

    render(<AccessPanel fileId="file-1" filename="hello.txt" onClose={() => undefined} />);

    await screen.findByText(/https:\/\/example.test\/share\/abc/i);
    await userEvent.click(screen.getByRole("button", { name: /Revoke direct access and file links/i }));

    expect(await screen.findByText(/Close direct shares and file links\?/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Folder permissions, copies already downloaded/i),
    ).toBeInTheDocument();
  });

  it("times out an access check and exposes only sanitized support details", async () => {
    vi.useFakeTimers();
    let requestSignal: AbortSignal | undefined;
    globalThis.fetch = vi.fn((_input, init) => {
      requestSignal = init?.signal ?? undefined;
      return Promise.resolve({
        ok: true,
        headers: new Headers(),
        json: () => new Promise<unknown>(() => undefined),
      } as Response);
    }) as typeof fetch;

    render(<AccessPanel fileId="file-1" filename="secret-filename.txt" onClose={() => undefined} />);
    await act(async () => { await Promise.resolve(); });
    await act(async () => { await vi.advanceTimersByTimeAsync(15_000); });

    expect(screen.getByTestId("data-state-error")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Show support details" }));
    const preview = screen.getByRole("textbox", { name: "Support details preview" });
    expect((preview as HTMLTextAreaElement).value).toContain("Operation: access_check");
    expect((preview as HTMLTextAreaElement).value).toContain("Error class: timeout");
    expect((preview as HTMLTextAreaElement).value).not.toContain("secret-filename.txt");
    expect(requestSignal?.aborted).toBe(true);
  });

  it("turns a revoke timeout into an unknown outcome and releases the dialog", async () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ entries: [{ kind: "direct", label: "Recipient", since: "2026-09-16", state: "active" }] }), { status: 200 }))
      .mockImplementationOnce(() => new Promise<Response>(() => undefined));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    render(<AccessPanel fileId="file-1" filename="hello.txt" onClose={onClose} />);
    await act(async () => { await Promise.resolve(); });
    expect(screen.getByText("Recipient")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Revoke direct access/i }));
    fireEvent.click(screen.getByRole("button", { name: "Revoke now" }));
    await act(async () => { await vi.advanceTimersByTimeAsync(15_000); });

    expect(screen.getByRole("alert")).toHaveTextContent("Revocation was not confirmed");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByRole("button", { name: "Close access details" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("aborts a pending access response body when the panel unmounts", async () => {
    let requestSignal: AbortSignal | undefined;
    globalThis.fetch = vi.fn((_input, init) => {
      requestSignal = init?.signal ?? undefined;
      return Promise.resolve({
        ok: true,
        headers: new Headers(),
        json: () => new Promise<unknown>(() => undefined),
      } as Response);
    }) as typeof fetch;

    const view = render(<AccessPanel fileId="file-1" filename="hello.txt" onClose={() => undefined} />);
    await act(async () => { await Promise.resolve(); });
    view.unmount();

    expect(requestSignal?.aborted).toBe(true);
  });

  it("keeps a confirmed revoke distinct when the following access check fails", async () => {
    const requestId = "13376c6d-62bb-40af-a3ef-748e42352274";
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ entries: [{ kind: "direct", label: "Recipient", since: "2026-09-16", state: "active" }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true }), { status: 200, headers: { "X-Request-ID": requestId } }))
      .mockResolvedValueOnce(new Response(null, { status: 503, headers: { "X-Request-ID": requestId } }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    render(<AccessPanel fileId="file-1" filename="hello.txt" onClose={() => undefined} />);
    await screen.findByText("Recipient");
    await userEvent.click(screen.getByRole("button", { name: /Revoke direct access/i }));
    await userEvent.click(screen.getByRole("button", { name: "Revoke now" }));

    expect(await screen.findByRole("status")).toHaveTextContent("latest access list could not be refreshed");
    await userEvent.click(screen.getByRole("button", { name: "Show support details" }));
    const preview = screen.getByRole("textbox", { name: "Support details preview" });
    expect((preview as HTMLTextAreaElement).value).toContain("Operation: access_revoke");
    expect((preview as HTMLTextAreaElement).value).toContain("Confirmation: confirmed_stale");
    expect((preview as HTMLTextAreaElement).value).toContain(`Request ID: ${requestId}`);
  });
});

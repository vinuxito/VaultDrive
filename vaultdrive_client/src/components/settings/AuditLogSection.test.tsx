import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";
import { AuditLogSection } from "./AuditLogSection";

const page = (id: string) => new Response(JSON.stringify({ success: true, data: [{ id, action: "file.uploaded", resource_type: "file", created_at: "2026-09-14T12:00:00Z" }], meta: { pagination: { count: 40, offset: 0, limit: 20 } } }));
beforeEach(() => { vi.restoreAllMocks(); });

it("offers recovery instead of inventing an empty audit history", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(new Response("{}", { status: 503 })).mockResolvedValueOnce(page("first")));
  render(<AuditLogSection />);
  expect(await screen.findByRole("alert")).toHaveTextContent("could not be loaded");
  expect(screen.queryByText(/No audit events recorded/)).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: /retry/i }));
  expect(await screen.findByText("File uploaded")).toBeInTheDocument();
});

it("retains the last confirmed page and retries the same failed offset", async () => {
  const fetchMock = vi.fn().mockResolvedValueOnce(page("first")).mockRejectedValueOnce(new TypeError("offline")).mockResolvedValueOnce(page("second"));
  vi.stubGlobal("fetch", fetchMock);
  render(<AuditLogSection />);
  await screen.findByText("File uploaded");
  await userEvent.click(screen.getByRole("button", { name: "Load more" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("last confirmed");
  expect(screen.getByText("File uploaded")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: /retry/i }));
  await waitFor(() => expect(screen.getAllByText("File uploaded")).toHaveLength(2));
  expect(String(fetchMock.mock.calls[1][0])).toContain("offset=20");
  expect(String(fetchMock.mock.calls[2][0])).toContain("offset=20");
});

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";
import Admin from "./admin";

vi.mock("../context/ToastContext", () => ({ useToast: () => ({ addToast: vi.fn() }) }));
beforeEach(() => { vi.restoreAllMocks(); localStorage.clear(); });

it("keeps an unavailable admin inventory distinct from an empty user list and retries", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(new Response("{}", { status: 503 })).mockResolvedValueOnce(new Response("[]")));
  render(<Admin />);
  expect(await screen.findByRole("alert")).toHaveTextContent("could not be loaded");
  expect(screen.queryByRole("table")).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: /retry/i }));
  expect(await screen.findByRole("table")).toBeInTheDocument();
});

it("does not offer user mutations after a forbidden inventory response", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 403 })));
  render(<Admin />);
  expect(await screen.findByRole("alert")).toHaveTextContent("permission");
  expect(screen.queryByRole("table")).not.toBeInTheDocument();
});

import { render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { StatusPanel } from "./StatusPanel";

const health = vi.hoisted(() => ({ data: undefined as unknown, error: undefined as unknown, isLoading: false, mutate: vi.fn() }));
vi.mock("swr", () => ({ default: () => health }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key }) }));

beforeEach(() => { health.data = undefined; health.error = undefined; health.isLoading = false; localStorage.clear(); });

it("distinguishes API response from a failed database dependency", () => {
  health.data = { status: "ok", db_ping_ms: -1, memory_mb: 1 };
  render(<StatusPanel />);
  expect(screen.getByText("Service degraded")).toBeInTheDocument();
  expect(screen.queryByText("ONLINE")).not.toBeInTheDocument();
  expect(screen.getByText(/Some file actions may be unavailable/)).toBeInTheDocument();
});

it("does not crash or invent healthy status for an incomplete response", () => {
  health.data = {};
  render(<StatusPanel />);
  expect(screen.getByText("Service status unknown")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Check again" })).toBeInTheDocument();
});

it("offers recovery when reachability fails and keeps metrics out of the primary owner view", () => {
  health.error = new Error("offline");
  render(<StatusPanel />);
  expect(screen.getByText("Service unreachable")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Check again" })).toBeInTheDocument();
  expect(screen.queryByText("Goroutines")).not.toBeInTheDocument();
});

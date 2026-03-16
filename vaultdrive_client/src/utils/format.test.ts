import { describe, expect, it, vi } from "vitest";

import { relativeTime } from "./format";

describe("relativeTime", () => {
  it("returns 'Just now' for very recent timestamps", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-15T12:00:00.000Z"));

    expect(relativeTime("2026-03-15T11:59:15.000Z")).toBe("Just now");

    vi.useRealTimers();
  });

  it("returns minute and hour labels for recent activity", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-15T12:00:00.000Z"));

    expect(relativeTime("2026-03-15T11:40:00.000Z")).toBe("20m ago");
    expect(relativeTime("2026-03-15T07:00:00.000Z")).toBe("5h ago");

    vi.useRealTimers();
  });

  it("returns day-oriented labels for older recent activity", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-15T12:00:00.000Z"));

    expect(relativeTime("2026-03-14T06:00:00.000Z")).toBe("Yesterday");
    expect(relativeTime("2026-03-12T12:00:00.000Z")).toBe("3 days ago");

    vi.useRealTimers();
  });

  it("falls back to a locale date string for older timestamps", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-15T12:00:00.000Z"));

    expect(relativeTime("2026-03-05T12:00:00.000Z")).toBe(
      new Date("2026-03-05T12:00:00.000Z").toLocaleDateString(),
    );

    vi.useRealTimers();
  });

  it("treats future timestamps as just now instead of exposing negative time", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-15T12:00:00.000Z"));

    expect(relativeTime("2026-03-15T13:00:00.000Z")).toBe("Just now");

    vi.useRealTimers();
  });
});

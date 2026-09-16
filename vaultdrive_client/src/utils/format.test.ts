import { describe, expect, it, vi } from "vitest";

import { relativeTime, formatDate } from "./format";

describe("relativeTime", () => {
  it("returns 'now' for very recent timestamps", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-15T12:00:00.000Z"));

    expect(relativeTime("2026-03-15T11:59:15.000Z")).toBe("now");

    vi.useRealTimers();
  });

  it("returns minute and hour labels for recent activity", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-15T12:00:00.000Z"));

    expect(relativeTime("2026-03-15T11:40:00.000Z")).toBe("20 minutes ago");
    expect(relativeTime("2026-03-15T07:00:00.000Z")).toBe("5 hours ago");

    vi.useRealTimers();
  });

  it("returns day-oriented labels for older recent activity", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-15T12:00:00.000Z"));

    expect(relativeTime("2026-03-14T06:00:00.000Z")).toBe("yesterday");
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

  it("describes future timestamps as future instead of treating them as recent events", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-15T12:00:00.000Z"));

    expect(relativeTime("2026-03-15T13:00:00.000Z")).toBe("in 1 hour");

    vi.useRealTimers();
  });
});

it("formats relative time in the selected language", () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date("2026-09-16T12:00:00Z"));
  expect(relativeTime("2026-09-16T11:00:00Z", "es")).toBe("hace 1 hora");
  vi.useRealTimers();
});
it("does not turn invalid dates into a recent event", () => {
  expect(relativeTime("invalid", "en")).toBe("—");
  expect(formatDate("invalid", "es")).toBe("—");
});

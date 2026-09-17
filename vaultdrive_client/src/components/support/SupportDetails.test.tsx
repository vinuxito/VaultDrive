import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SupportDetails } from "./SupportDetails";
import { createSupportDetails, serializeSupportDetails, type SanitizedSupportDetails } from "./support-details-data";

describe("SupportDetails", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("serializes only allowlisted support fields and rejects an invalid build identifier", () => {
    const details = createSupportDetails({
      operation: "access_check",
      confirmation: "unknown",
      requestId: "13376c6d-62bb-40af-a3ef-748e42352274",
      errorClass: "http_5xx",
      buildId: "release-candidate-with-secret",
      now: new Date("2026-09-16T12:34:56.000Z"),
      filename: "secret.pdf",
      email: "person@example.test",
      token: "bearer-secret",
      url: "https://example.test/share#private-key",
      rawError: "database connection string",
    } as unknown as Parameters<typeof createSupportDetails>[0]);
    const serialized = serializeSupportDetails(details);

    expect(details.build).toBe("unknown");
    expect(serialized).toContain("App: ABRN Drive");
    expect(serialized).toContain("Request ID: 13376c6d-62bb-40af-a3ef-748e42352274");
    expect(serialized).not.toMatch(/secret\.pdf|person@|bearer-secret|private-key|database connection/i);
    expect(Object.keys(details)).toEqual(["app", "build", "time", "operation", "confirmation", "requestId", "errorClass"]);
  });

  it("re-sanitizes runtime-cast props before rendering or serializing", async () => {
    const forged = {
      app: "secret@example.test",
      build: "deadbeef",
      time: "2020-01-01T00:00:00.000Z",
      operation: "download_secret_file",
      confirmation: "definitely_worked",
      requestId: "13376c6d-62bb-40af-a3ef-748e42352274",
      errorClass: "postgres://credentials",
      filename: "payroll.pdf",
    } as unknown as SanitizedSupportDetails;

    const serialized = serializeSupportDetails(forged);
    expect(serialized).toContain("App: ABRN Drive");
    expect(serialized).toContain("Build: unknown");
    expect(serialized).toContain("Operation: service_status");
    expect(serialized).toContain("Confirmation: unknown");
    expect(serialized).toContain("Request ID: unknown");
    expect(serialized).toContain("Error class: unknown");
    expect(serialized).not.toContain("Time: 2020-01-01T00:00:00.000Z");
    expect(serialized).not.toMatch(/secret@|deadbeef|13376c6d|download_secret|definitely|postgres|payroll/i);

    render(<SupportDetails details={forged} />);
    await userEvent.click(screen.getByRole("button", { name: "Show support details" }));
    const rendered = (screen.getByRole("textbox", { name: "Support details preview" }) as HTMLTextAreaElement).value;
    expect(rendered).toContain("App: ABRN Drive");
    expect(rendered).toContain("Build: unknown");
    expect(rendered).not.toMatch(/secret@|deadbeef|13376c6d|download_secret|definitely|postgres|payroll/i);
  });

  it("previews the exact text and keeps it selectable when clipboard access is denied", async () => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn().mockRejectedValue(new Error("denied")) },
    });
    const details = createSupportDetails({
      operation: "access_revoke",
      confirmation: "unknown",
      requestId: "unknown",
      errorClass: "timeout",
      buildId: "0123456789abcdef",
      now: new Date("2026-09-16T12:34:56.000Z"),
    });

    render(<SupportDetails details={details} />);
    await userEvent.click(screen.getByRole("button", { name: "Show support details" }));
    const preview = screen.getByRole("textbox", { name: "Support details preview" });
    expect(preview).toHaveValue(serializeSupportDetails(details));
    await userEvent.click(screen.getByRole("button", { name: "Copy support details" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Select and copy the text manually");
    expect(preview).toHaveAttribute("readonly");
  });
});

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import Groups from "./groups";

describe("Groups data state", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("token", "session-token");
  });

  it("shows forbidden as a retryable source failure instead of an empty account", async () => {
    globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({ error: "forbidden" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    })) as typeof fetch;

    render(
      <MemoryRouter>
        <Groups />
      </MemoryRouter>,
    );

    expect(await screen.findByText("You do not have access to groups for this account.")).toBeInTheDocument();
    expect(screen.queryByText("No groups yet")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("keeps group details, members, and files as independent source states", async () => {
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const path = new URL(String(input), "http://localhost").pathname;
      if (path.endsWith("/groups")) return new Response(JSON.stringify([]), { status: 200 });
      if (path.endsWith("/groups/group-1")) return new Response(JSON.stringify({ error: "forbidden" }), { status: 403 });
      if (path.endsWith("/groups/group-1/members")) return new Response(JSON.stringify([]), { status: 200 });
      if (path.endsWith("/groups/group-1/files")) return new Response(JSON.stringify([]), { status: 200 });
      throw new Error(`Unhandled fetch: ${path}`);
    }) as typeof fetch;

    render(
      <MemoryRouter initialEntries={["/groups/group-1"]}>
        <Routes>
          <Route path="/groups/:id" element={<Groups />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText("You do not have access to this group's details.")).toBeInTheDocument();
    expect(screen.queryByText("Group not found")).not.toBeInTheDocument();
  });

  it("uses an accessible create dialog that closes with Escape", async () => {
    globalThis.fetch = vi.fn(async () => new Response(JSON.stringify([]), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })) as typeof fetch;
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/groups"]}>
        <Groups />
      </MemoryRouter>,
    );

    const create = await screen.findByRole("button", { name: "Create group" });
    create.focus();
    await user.click(create);
    expect(screen.getByRole("dialog", { name: "Create group" })).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "Create group" })).not.toBeInTheDocument();
    expect(create).toHaveFocus();
  });
});

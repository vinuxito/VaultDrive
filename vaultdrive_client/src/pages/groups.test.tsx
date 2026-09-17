import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import Groups from "./groups";

describe("Groups data state", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("token", "session-token");
    localStorage.setItem("user", JSON.stringify({ id: "owner-1" }));
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

  it("does not show owner mutation controls to an ordinary group member", async () => {
    localStorage.setItem("user", JSON.stringify({ id: "member-1" }));
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const path = new URL(String(input), "http://localhost").pathname;
      if (path.endsWith("/groups")) return Response.json([]);
      if (path.endsWith("/groups/group-1")) return Response.json({ id: "group-1", user_id: "owner-1", name: "Reviewers", description: "Review", member_count: 2, file_count: 1 });
      if (path.endsWith("/groups/group-1/members")) return Response.json([
        { id: "membership-1", user_id: "owner-1", username: "owner", email: "owner@example.test", first_name: "Owner", last_name: "One", role: "owner" },
        { id: "membership-2", user_id: "member-1", username: "member", email: "member@example.test", first_name: "Member", last_name: "One", role: "member" },
      ]);
      if (path.endsWith("/groups/group-1/files")) return Response.json([{ id: "file-1", file_id: "file-1", filename: "review.txt", file_size: 10, created_at: "2026-09-16T00:00:00Z", shared_at: "2026-09-16T00:00:00Z", shared_by: "owner", is_owner: false }]);
      throw new Error(`Unhandled fetch: ${path}`);
    }) as typeof fetch;

    render(
      <MemoryRouter initialEntries={["/groups/group-1"]}>
        <Routes><Route path="/groups/:id" element={<Groups />} /></Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByRole("heading", { name: "Reviewers" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add member" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Delete$/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Remove .* from group/i })).not.toBeInTheDocument();
  });

  it("confirms member-removal scope and reports only a confirmed mutation", async () => {
    let removed = false;
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = new URL(String(input), "http://localhost").pathname;
      if (path.endsWith("/groups")) return Response.json([]);
      if (path.endsWith("/groups/group-1")) return Response.json({ id: "group-1", user_id: "owner-1", name: "Reviewers", description: "Review", member_count: 2, file_count: 0 });
      if (path.endsWith("/groups/group-1/members/target-1") && init?.method === "DELETE") {
        removed = true;
        return Response.json({ message: "Member removed" });
      }
      if (path.endsWith("/groups/group-1/members")) return Response.json(removed ? [
        { id: "membership-1", user_id: "owner-1", username: "owner", email: "owner@example.test", first_name: "Owner", last_name: "One", role: "owner" },
      ] : [
        { id: "membership-1", user_id: "owner-1", username: "owner", email: "owner@example.test", first_name: "Owner", last_name: "One", role: "owner" },
        { id: "membership-2", user_id: "target-1", username: "target", email: "target@example.test", first_name: "Target", last_name: "One", role: "member" },
      ]);
      if (path.endsWith("/groups/group-1/files")) return Response.json([]);
      throw new Error(`Unhandled fetch: ${path}`);
    }) as typeof fetch;
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/groups/group-1"]}>
        <Routes>
          <Route path="/groups/:id" element={<Groups />} />
          <Route path="/files" element={<p>Files destination</p>} />
        </Routes>
      </MemoryRouter>,
    );

    await user.click(await screen.findByRole("button", { name: "Remove target" }));
    const dialog = screen.getByRole("dialog", { name: "Remove this member from the group?" });
    expect(dialog).toHaveTextContent("Existing direct file grants and downloaded copies are unchanged");
    await user.click(screen.getByRole("button", { name: "Remove member" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Existing direct file grants were not changed");
    await user.click(screen.getByRole("button", { name: "Review file access" }));
    expect(await screen.findByText("Files destination")).toBeInTheDocument();
  });

  it("keeps the member visible and shows an alert when removal is not confirmed", async () => {
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = new URL(String(input), "http://localhost").pathname;
      if (path.endsWith("/groups")) return Response.json([]);
      if (path.endsWith("/groups/group-1")) return Response.json({ id: "group-1", user_id: "owner-1", name: "Reviewers", description: "Review", member_count: 2, file_count: 0 });
      if (path.endsWith("/groups/group-1/members/target-1") && init?.method === "DELETE") return Response.json({ error: "outage" }, { status: 503 });
      if (path.endsWith("/groups/group-1/members")) return Response.json([
        { id: "membership-1", user_id: "owner-1", username: "owner", email: "owner@example.test", first_name: "Owner", last_name: "One", role: "owner" },
        { id: "membership-2", user_id: "target-1", username: "target", email: "target@example.test", first_name: "Target", last_name: "One", role: "member" },
      ]);
      if (path.endsWith("/groups/group-1/files")) return Response.json([]);
      throw new Error(`Unhandled fetch: ${path}`);
    }) as typeof fetch;
    const user = userEvent.setup();
    render(<MemoryRouter initialEntries={["/groups/group-1"]}><Routes><Route path="/groups/:id" element={<Groups />} /></Routes></MemoryRouter>);

    await user.click(await screen.findByRole("button", { name: "Remove target" }));
    await user.click(screen.getByRole("button", { name: "Remove member" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Member removal was not confirmed");
    expect(screen.getByRole("button", { name: "Remove target" })).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("confirms that removing a group file preserves independent access paths", async () => {
    let removed = false;
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = new URL(String(input), "http://localhost").pathname;
      if (path.endsWith("/groups")) return Response.json([]);
      if (path.endsWith("/groups/group-1")) return Response.json({ id: "group-1", user_id: "owner-1", name: "Reviewers", description: "Review", member_count: 1, file_count: 1 });
      if (path.endsWith("/groups/group-1/members")) return Response.json([
        { id: "membership-1", user_id: "owner-1", username: "owner", email: "owner@example.test", first_name: "Owner", last_name: "One", role: "owner" },
      ]);
      if (path.endsWith("/groups/group-1/files/file-1") && init?.method === "DELETE") {
        removed = true;
        return Response.json({ message: "File removed from group" });
      }
      if (path.endsWith("/groups/group-1/files")) return Response.json(removed ? [] : [
        { id: "file-1", file_id: "file-1", filename: "review.txt", file_size: 10, created_at: "2026-09-16T00:00:00Z", shared_at: "2026-09-16T00:00:00Z", shared_by: "owner", is_owner: false },
      ]);
      throw new Error(`Unhandled fetch: ${path}`);
    }) as typeof fetch;
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/groups/group-1"]}>
        <Routes>
          <Route path="/groups/:id" element={<Groups />} />
          <Route path="/files" element={<p>Files destination</p>} />
        </Routes>
      </MemoryRouter>,
    );

    await user.click(await screen.findByRole("button", { name: "Remove review.txt from group" }));
    const dialog = screen.getByRole("dialog", { name: "Remove this file from the group?" });
    expect(dialog).toHaveTextContent("Existing direct grants, public links, folder links, and downloaded copies are unchanged");
    await user.click(screen.getByRole("button", { name: "Remove from group" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Existing direct grants and links were not changed");
    expect(screen.queryByText("review.txt")).not.toBeInTheDocument();
  });
});

import { describe, expect, it } from "vitest";

import { chunkOfflineActions, classifyOfflineActions, matchOfflineSyncResults, type SyncableOfflineAction } from "./offline-sync";
import type { OfflineAction } from "./offline-db";

function action(overrides: Partial<SyncableOfflineAction>): SyncableOfflineAction {
  return {
    id: 1,
    action_id: "action-1",
    owner_id: "owner-1",
    type: "delete",
    file_id: "file-1",
    parent_hash: "hash-1",
    updated_at: "2026-09-14T00:00:00.000Z",
    status: "pending",
    ...overrides,
  };
}

describe("offline sync decisions", () => {
  it("holds legacy, foreign-owner, and previously ambiguous work for explicit review", () => {
    const classified = classifyOfflineActions([
      { ...action({}), action_id: undefined, owner_id: undefined } as OfflineAction,
      action({ id: 2, action_id: "foreign", owner_id: "owner-2" }),
      action({ id: 3, action_id: "unknown", status: "unknown" }),
      action({ id: 4, action_id: "ready" }),
    ], "owner-1");

    expect(classified.ready.map((item) => item.action_id)).toEqual(["ready"]);
    expect(classified.review).toHaveLength(3);
  });

  it("matches server outcomes by action id and retains failed, conflicted, and missing results", () => {
    const actions = [
      action({ id: 1, action_id: "delete-a", file_id: "same-file" }),
      action({ id: 2, action_id: "rename-b", file_id: "same-file", type: "rename" }),
      action({ id: 3, action_id: "missing-c", file_id: "other-file" }),
    ];

    const outcomes = matchOfflineSyncResults(actions, [
      { action_id: "rename-b", file_id: "same-file", success: false, conflict: true, error: "Version changed" },
      { action_id: "delete-a", file_id: "same-file", success: true },
    ]);

    expect(outcomes).toEqual([
      { id: 1, actionId: "delete-a", kind: "remove" },
      { id: 2, actionId: "rename-b", kind: "conflict", error: "Version changed" },
      { id: 3, actionId: "missing-c", kind: "unknown", error: "The server did not confirm this action." },
    ]);
  });

  it("does not trust duplicate action ids, wrong file ids, or outcome-unknown errors", () => {
    const actions = [
      action({ id: 1, action_id: "duplicate", file_id: "file-1" }),
      action({ id: 2, action_id: "wrong-file", file_id: "file-2" }),
      action({ id: 3, action_id: "unknown-code", file_id: "file-3" }),
    ];
    const outcomes = matchOfflineSyncResults(actions, [
      { action_id: "duplicate", file_id: "file-1", success: true },
      { action_id: "duplicate", file_id: "file-1", success: true },
      { action_id: "wrong-file", file_id: "another-file", success: true },
      { action_id: "unknown-code", file_id: "file-3", success: false, code: "outcome_unknown" },
    ]);

    expect(outcomes.every((outcome) => outcome.kind === "unknown")).toBe(true);
  });

  it("bounds sequential request chunks to 100 actions", () => {
    const actions = Array.from({ length: 205 }, (_, index) => action({ id: index + 1, action_id: `action-${index}` })) as ReturnType<typeof classifyOfflineActions>["ready"];
    expect(chunkOfflineActions(actions).map((chunk) => chunk.length)).toEqual([100, 100, 5]);
  });
});

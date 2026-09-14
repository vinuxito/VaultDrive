import type { OfflineAction } from "./offline-db";

export interface OfflineSyncResult {
  action_id?: string;
  file_id?: string;
  success?: boolean;
  conflict?: boolean;
  error?: string;
  code?: string;
}

export type SyncableOfflineAction = OfflineAction & { id: number; action_id: string; owner_id: string };

export interface OfflineActionReview {
  action: OfflineAction;
  reason: "legacy" | "different-owner" | "needs-review";
}

export function classifyOfflineActions(actions: OfflineAction[], ownerId: string | null) {
  const ready: SyncableOfflineAction[] = [];
  const review: OfflineActionReview[] = [];

  actions.forEach((action) => {
    if (!action.id || !action.action_id || !action.owner_id) {
      review.push({ action, reason: "legacy" });
    } else if (!ownerId || action.owner_id !== ownerId) {
      review.push({ action, reason: "different-owner" });
    } else if ((action.status ?? "pending") !== "pending") {
      review.push({ action, reason: "needs-review" });
    } else {
      ready.push(action as SyncableOfflineAction);
    }
  });

  return { ready, review };
}

export type OfflineSyncOutcome =
  | { id: number; actionId: string; kind: "remove" }
  | { id: number; actionId: string; kind: "failed" | "conflict" | "unknown"; error: string };

export function matchOfflineSyncResults(
  actions: SyncableOfflineAction[],
  results: OfflineSyncResult[],
): OfflineSyncOutcome[] {
  const resultsByActionId = new Map<string, OfflineSyncResult[]>();
  results.forEach((result) => {
    if (!result.action_id) return;
    const matches = resultsByActionId.get(result.action_id) ?? [];
    matches.push(result);
    resultsByActionId.set(result.action_id, matches);
  });

  return actions.map((action) => {
    const matches = resultsByActionId.get(action.action_id) ?? [];
    const result = matches.length === 1 ? matches[0] : undefined;
    if (!result || result.file_id !== action.file_id) {
      return {
        id: action.id,
        actionId: action.action_id,
        kind: "unknown",
        error: "The server did not confirm this action.",
      };
    }
    if (result.success === true) {
      return { id: action.id, actionId: action.action_id, kind: "remove" };
    }
    if (result.code === "outcome_unknown") {
      return {
        id: action.id,
        actionId: action.action_id,
        kind: "unknown",
        error: result.error || "The server could not confirm this action's outcome.",
      };
    }
    if (result.conflict === true || result.code === "version_conflict") {
      return {
        id: action.id,
        actionId: action.action_id,
        kind: "conflict",
        error: result.error || "The file changed before this action could be applied.",
      };
    }
    return {
      id: action.id,
      actionId: action.action_id,
      kind: "failed",
      error: result.error || "The server rejected this action.",
    };
  });
}

export function chunkOfflineActions(
  actions: SyncableOfflineAction[],
  maxActions = 100,
  maxBytes = 900_000,
): SyncableOfflineAction[][] {
  const chunks: SyncableOfflineAction[][] = [];
  let current: SyncableOfflineAction[] = [];
  let currentBytes = 14;

  actions.forEach((action) => {
    const actionBytes = new TextEncoder().encode(JSON.stringify(action)).byteLength + 1;
    if (current.length > 0 && (current.length >= maxActions || currentBytes + actionBytes > maxBytes)) {
      chunks.push(current);
      current = [];
      currentBytes = 14;
    }
    current.push(action);
    currentBytes += actionBytes;
  });
  if (current.length > 0) chunks.push(current);
  return chunks;
}

import { describe, expect, it } from "vitest";

import {
  explainAgentOperation,
  groupAgentOperations,
  summarizeAgentOperations,
  type AgentOperationEntry,
} from "./agent-operations";

const entries: AgentOperationEntry[] = [
  {
    id: "1",
    action: "agent_api_key.used",
    resource_type: "agent_api_key",
    created_at: "2026-03-16T17:20:00.000Z",
    metadata: { agent_name: "Filemon", resource: "/api/v1/auth/introspect", matched_scope: "files:list" },
  },
  {
    id: "2",
    action: "agent_api_key.scope_denied",
    resource_type: "agent_api_key",
    created_at: "2026-03-16T17:21:00.000Z",
    metadata: { agent_name: "Verifier", resource: "/api/v1/files", required_scope: "files:list" },
  },
  {
    id: "3",
    action: "agent_api_key.revoked",
    resource_type: "agent_api_key",
    created_at: "2026-03-16T17:22:00.000Z",
    metadata: { agent_name: "Filemon", resource: "/api/v1/agent-keys/key-1" },
  },
];

describe("groupAgentOperations", () => {
  it("groups entries by agent name and sorts by latest activity", () => {
    const groups = groupAgentOperations(entries);

    expect(groups).toHaveLength(2);
    expect(groups[0]?.agentName).toBe("Filemon");
    expect(groups[1]?.agentName).toBe("Verifier");
    expect(groups[0]?.entries.map((entry) => entry.id)).toEqual(["3", "1"]);
  });

  it("explains why an operation was allowed or denied", () => {
    expect(explainAgentOperation(entries[0]!)).toContain("Allowed by files:list");
    expect(explainAgentOperation(entries[1]!)).toContain("Blocked: missing files:list");
  });

  it("summarizes the latest agent state for the operator header", () => {
    expect(summarizeAgentOperations(entries, 3)).toMatchObject({
      activeKeys: 3,
      latestEvent: "Key revoked",
      attention: "1 denial to review",
      activeAgents: 2,
    });
  });
});

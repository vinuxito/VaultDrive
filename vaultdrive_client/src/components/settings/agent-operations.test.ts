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

  it("explains and counts guardrail blocks and recoverable trash actions", () => {
    const guardrailEntries: AgentOperationEntry[] = [
      {
        id: "g1",
        action: "agent_api_key.folder_denied",
        resource_type: "agent_api_key",
        created_at: "2026-11-15T12:00:00Z",
        metadata: { reason: "SiblingSecret outside allowed_folder_ids" },
      },
      {
        id: "g2",
        action: "agent_api_key.ip_denied",
        resource_type: "agent_api_key",
        created_at: "2026-11-15T12:01:00Z",
        metadata: { reason: "203.0.113.9" },
      },
      {
        id: "g3",
        action: "agent_api_key.delete_denied",
        resource_type: "agent_api_key",
        created_at: "2026-11-15T12:02:00Z",
      },
      {
        id: "g4",
        action: "file.soft_deleted",
        resource_type: "file",
        created_at: "2026-11-15T12:03:00Z",
        metadata: { reason: "CFDI duplicado" },
      },
    ];

    expect(explainAgentOperation(guardrailEntries[0]!)).toContain("SiblingSecret outside allowed_folder_ids");
    expect(explainAgentOperation(guardrailEntries[1]!)).toContain("203.0.113.9");
    expect(explainAgentOperation(guardrailEntries[2]!)).toContain("llave Solo Papelera");
    expect(explainAgentOperation(guardrailEntries[3]!)).toContain("CFDI duplicado");

    expect(summarizeAgentOperations(guardrailEntries, 2)).toMatchObject({
      activeKeys: 2,
      latestEvent: "Movido a Papelera",
      attention: "3 denials to review",
    });
  });
});

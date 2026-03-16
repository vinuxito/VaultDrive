export interface AgentOperationEntry {
  id: string;
  action: string;
  resource_type: string;
  resource_id?: string;
  created_at: string;
  metadata?: Record<string, unknown>;
}

export interface AgentOperationGroup {
  agentName: string;
  latestAt: string;
  entries: AgentOperationEntry[];
}

export interface AgentOperationSummary {
  activeKeys: number;
  activeAgents: number;
  latestEvent: string;
  attention: string;
}

const actionLabels: Record<string, string> = {
  "agent_api_key.created": "Key created",
  "agent_api_key.revoked": "Key revoked",
  "agent_api_key.used": "Request served",
  "agent_api_key.expired": "Key expired",
  "agent_api_key.scope_denied": "Scope denied",
};

function readAgentName(entry: AgentOperationEntry): string {
  const meta = entry.metadata;
  if (!meta) return "Agent";
  if (typeof meta.agent_name === "string") return meta.agent_name;
  if (typeof meta.name === "string") return meta.name;
  if (typeof meta.key_prefix === "string") return meta.key_prefix;
  return "Agent";
}

export function groupAgentOperations(entries: AgentOperationEntry[]): AgentOperationGroup[] {
  const groups = new Map<string, AgentOperationEntry[]>();

  entries.forEach((entry) => {
    const agentName = readAgentName(entry);
    const current = groups.get(agentName) ?? [];
    current.push(entry);
    groups.set(agentName, current);
  });

  return Array.from(groups.entries())
    .map(([agentName, groupEntries]) => {
      const sortedEntries = [...groupEntries].sort((left, right) => right.created_at.localeCompare(left.created_at));
      return {
        agentName,
        latestAt: sortedEntries[0]?.created_at ?? "",
        entries: sortedEntries,
      };
    })
    .sort((left, right) => right.latestAt.localeCompare(left.latestAt));
}

export function explainAgentOperation(entry: AgentOperationEntry): string {
  const meta = entry.metadata;
  const matchedScope = typeof meta?.matched_scope === "string" ? meta.matched_scope : "";
  const requiredScope = typeof meta?.required_scope === "string" ? meta.required_scope : "";
  const grantedScopes = Array.isArray(meta?.scope_grant)
    ? meta.scope_grant.filter((value): value is string => typeof value === "string")
    : [];

  if (entry.action === "agent_api_key.used") {
    return matchedScope ? `Allowed by ${matchedScope}` : "Allowed by the key's granted scopes";
  }
  if (entry.action === "agent_api_key.scope_denied") {
    return requiredScope ? `Blocked: missing ${requiredScope}` : "Blocked by scope policy";
  }
  if (entry.action === "agent_api_key.created") {
    return grantedScopes.length > 0
      ? `Created with ${grantedScopes.length} granted scope${grantedScopes.length === 1 ? "" : "s"}`
      : "Created and ready for delegated work";
  }
  if (entry.action === "agent_api_key.revoked") {
    return "Revoked immediately by the owner";
  }
  if (entry.action === "agent_api_key.expired") {
    return "Blocked because the key expired";
  }

  return "Review the event metadata for the exact trust decision";
}

export function summarizeAgentOperations(entries: AgentOperationEntry[], activeKeys: number): AgentOperationSummary {
  const groups = groupAgentOperations(entries);
  const latestEntry = [...entries].sort((left, right) => right.created_at.localeCompare(left.created_at))[0];
  const denialCount = entries.filter((entry) => entry.action === "agent_api_key.scope_denied").length;

  return {
    activeKeys,
    activeAgents: groups.length,
    latestEvent: latestEntry ? actionLabels[latestEntry.action] ?? latestEntry.action : "No activity yet",
    attention: denialCount > 0 ? `${denialCount} denial${denialCount === 1 ? "" : "s"} to review` : "No denials in view",
  };
}

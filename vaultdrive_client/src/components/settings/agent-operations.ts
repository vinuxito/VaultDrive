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

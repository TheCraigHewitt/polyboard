import { useStore } from '../store';

export function useAgents() {
  const agents = useStore((state) => state.agents);
  const agentStatuses = useStore((state) => state.agentStatuses);
  const selectedAgentId = useStore((state) => state.selectedAgentId);
  const setSelectedAgentId = useStore((state) => state.setSelectedAgentId);

  const selectedAgent = selectedAgentId
    ? agents.find((a) => a.id === selectedAgentId)
    : null;

  const getAgentStatus = (agentId: string) => {
    return agentStatuses[agentId] || {
      agentId,
      status: 'offline' as const,
      lastHeartbeat: new Date().toISOString(),
    };
  };

  return {
    agents,
    agentStatuses,
    selectedAgent,
    selectedAgentId,
    setSelectedAgentId,
    getAgentStatus,
  };
}

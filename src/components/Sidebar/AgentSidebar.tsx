import { useAgents } from '../../hooks';
import { useStore } from '../../store';
import { AgentCard } from './AgentCard';

export function AgentSidebar() {
  const { agents, selectedAgentId, setSelectedAgentId, getAgentStatus } = useAgents();
  const sidebarCollapsed = useStore((state) => state.sidebarCollapsed);
  const setSidebarCollapsed = useStore((state) => state.setSidebarCollapsed);
  const setPanelCollapsed = useStore((state) => state.setPanelCollapsed);

  const handleAgentClick = (agentId: string) => {
    if (selectedAgentId === agentId) {
      // Deselect and close panel
      setSelectedAgentId(null);
      setPanelCollapsed(true);
    } else {
      // Select and open panel
      setSelectedAgentId(agentId);
      setPanelCollapsed(false);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Collapse Toggle */}
      <button
        onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
        className="p-3 flex items-center justify-center hover:bg-board-bg transition-colors border-b border-border-color"
        title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        <svg
          className={`w-5 h-5 text-text-secondary transition-transform ${
            sidebarCollapsed ? 'rotate-180' : ''
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M11 19l-7-7 7-7m8 14l-7-7 7-7"
          />
        </svg>
      </button>

      {/* Agent List */}
      <div className="flex-1 overflow-y-auto">
        {!sidebarCollapsed && (
          <div className="px-3 py-2 text-xs font-medium text-text-secondary uppercase tracking-wider">
            Agents ({agents.length})
          </div>
        )}
        {agents.map((agent) => (
          <AgentCard
            key={agent.id}
            agent={agent}
            status={getAgentStatus(agent.id)}
            isSelected={selectedAgentId === agent.id}
            onClick={() => handleAgentClick(agent.id)}
            collapsed={sidebarCollapsed}
          />
        ))}
        {agents.length === 0 && !sidebarCollapsed && (
          <div className="p-4 text-sm text-text-secondary text-center">
            No agents found.
            <br />
            <span className="text-xs">Check your OpenClaw config.</span>
          </div>
        )}
      </div>
    </div>
  );
}

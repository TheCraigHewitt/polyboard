import type { Agent, AgentStatus } from '../../types';
import { StatusIndicator } from './StatusIndicator';

interface AgentCardProps {
  agent: Agent;
  status: AgentStatus;
  isSelected: boolean;
  onClick: () => void;
  collapsed: boolean;
}

export function AgentCard({ agent, status, isSelected, onClick, collapsed }: AgentCardProps) {
  if (collapsed) {
    return (
      <button
        onClick={onClick}
        className={`w-full p-3 flex justify-center items-center hover:bg-board-bg transition-colors ${
          isSelected ? 'bg-board-bg' : ''
        }`}
        title={agent.name}
      >
        <div className="relative">
          <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-white font-medium text-sm">
            {agent.name.charAt(0).toUpperCase()}
          </div>
          <div className="absolute -bottom-0.5 -right-0.5">
            <StatusIndicator status={status.status} size="sm" />
          </div>
        </div>
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      className={`w-full p-3 flex items-center gap-3 hover:bg-board-bg transition-colors text-left ${
        isSelected ? 'bg-board-bg' : ''
      }`}
    >
      <div className="relative flex-shrink-0">
        <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center text-white font-medium">
          {agent.name.charAt(0).toUpperCase()}
        </div>
        <div className="absolute -bottom-0.5 -right-0.5">
          <StatusIndicator status={status.status} size="sm" />
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-text-primary truncate">{agent.name}</div>
        <div className="text-xs text-text-secondary truncate">
          {status.statusReason || status.status}
        </div>
      </div>
    </button>
  );
}

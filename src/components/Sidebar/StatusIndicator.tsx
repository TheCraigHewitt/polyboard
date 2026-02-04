import type { AgentStatus } from '../../types';

interface StatusIndicatorProps {
  status: AgentStatus['status'];
  size?: 'sm' | 'md';
}

const statusColors: Record<AgentStatus['status'], string> = {
  working: 'bg-green-500',
  idle: 'bg-yellow-500',
  error: 'bg-red-500',
  offline: 'bg-gray-400',
};

const statusLabels: Record<AgentStatus['status'], string> = {
  working: 'Working',
  idle: 'Idle',
  error: 'Error',
  offline: 'Offline',
};

export function StatusIndicator({ status, size = 'md' }: StatusIndicatorProps) {
  const sizeClasses = size === 'sm' ? 'w-2 h-2' : 'w-3 h-3';

  return (
    <span
      className={`${sizeClasses} rounded-full ${statusColors[status]} inline-block`}
      title={statusLabels[status]}
    />
  );
}

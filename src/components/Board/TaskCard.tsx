import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Task } from '../../types';
import { useStore } from '../../store';
import { useAgents } from '../../hooks';

interface TaskCardProps {
  task: Task;
  onClick: () => void;
}

const priorityColors: Record<string, string> = {
  urgent: 'border-l-red-500',
  high: 'border-l-orange-500',
  medium: 'border-l-yellow-500',
  low: 'border-l-blue-500',
};

const pipelineColors: Record<string, string> = {
  advisory: 'bg-purple-500/20 text-purple-400',
  content: 'bg-blue-500/20 text-blue-400',
  email: 'bg-green-500/20 text-green-400',
  general: 'bg-gray-500/20 text-gray-400',
};

export function TaskCard({ task, onClick }: TaskCardProps) {
  const { agents } = useAgents();
  const selectedTaskId = useStore((state) => state.selectedTaskId);
  const isSelected = selectedTaskId === task.id;

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const assignedAgent = task.assignedTo
    ? agents.find((a) => a.id === task.assignedTo)
    : null;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={`
        bg-card-bg border border-border-color rounded-lg p-3 cursor-pointer
        hover:border-accent transition-colors
        border-l-4 ${priorityColors[task.priority || 'medium']}
        ${isDragging ? 'opacity-50 shadow-lg' : ''}
        ${isSelected ? 'ring-2 ring-accent' : ''}
      `}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <h4 className="text-sm font-medium text-text-primary line-clamp-2">
          {task.title}
        </h4>
      </div>

      {task.description && (
        <p className="text-xs text-text-secondary line-clamp-2 mb-2">
          {task.description}
        </p>
      )}

      <div className="flex items-center justify-between">
        <span
          className={`text-xs px-2 py-0.5 rounded-full ${pipelineColors[task.pipeline]}`}
        >
          {task.pipeline}
        </span>

        {assignedAgent && (
          <div className="flex items-center gap-1">
            <div className="w-5 h-5 rounded-full bg-accent flex items-center justify-center text-white text-xs">
              {assignedAgent.name.charAt(0).toUpperCase()}
            </div>
          </div>
        )}
      </div>

      {task.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {task.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="text-xs px-1.5 py-0.5 bg-board-bg rounded text-text-secondary"
            >
              {tag}
            </span>
          ))}
          {task.tags.length > 3 && (
            <span className="text-xs text-text-secondary">
              +{task.tags.length - 3}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

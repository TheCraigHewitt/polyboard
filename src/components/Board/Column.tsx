import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import type { Task, TaskStatus } from '../../types';
import { TaskCard } from './TaskCard';

interface ColumnProps {
  id: TaskStatus;
  title: string;
  tasks: Task[];
  onTaskClick: (taskId: string) => void;
  onAddTask?: () => void;
}

const columnColors: Record<TaskStatus, string> = {
  inbox: 'border-t-gray-500',
  active: 'border-t-blue-500',
  review: 'border-t-yellow-500',
  done: 'border-t-green-500',
};

export function Column({ id, title, tasks, onTaskClick, onAddTask }: ColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div
      className={`
        flex-1 min-w-[280px] max-w-[350px] flex flex-col
        bg-column-bg rounded-lg border-t-4 ${columnColors[id]}
        ${isOver ? 'ring-2 ring-accent' : ''}
      `}
    >
      {/* Column Header */}
      <div className="p-3 flex items-center justify-between border-b border-border-color">
        <div className="flex items-center gap-2">
          <h3 className="font-medium text-text-primary">{title}</h3>
          <span className="text-xs bg-board-bg px-2 py-0.5 rounded-full text-text-secondary">
            {tasks.length}
          </span>
        </div>
        {onAddTask && (
          <button
            onClick={onAddTask}
            className="p-1 hover:bg-board-bg rounded transition-colors"
            title="Add task"
          >
            <svg className="w-4 h-4 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        )}
      </div>

      {/* Task List */}
      <div
        ref={setNodeRef}
        className="flex-1 p-2 overflow-y-auto space-y-2"
      >
        <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onClick={() => onTaskClick(task.id)}
            />
          ))}
        </SortableContext>

        {tasks.length === 0 && (
          <div className="text-center py-8 text-text-secondary text-sm">
            No tasks
          </div>
        )}
      </div>
    </div>
  );
}

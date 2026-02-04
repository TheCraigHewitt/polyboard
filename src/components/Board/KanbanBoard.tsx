import { useState, useCallback } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  DragOverlay,
} from '@dnd-kit/core';
import { useTasks } from '../../hooks';
import { useStore } from '../../store';
import type { Task, TaskStatus } from '../../types';
import { Column } from './Column';
import { TaskCard } from './TaskCard';
import { TaskModal } from './TaskModal';

const columns: { id: TaskStatus; title: string }[] = [
  { id: 'inbox', title: 'Inbox' },
  { id: 'active', title: 'Active' },
  { id: 'review', title: 'Review' },
  { id: 'done', title: 'Done' },
];

export function KanbanBoard() {
  const { tasks, createTask, updateTask, deleteTask, moveTask, getTasksByStatus } = useTasks();
  const setSelectedTaskId = useStore((state) => state.setSelectedTaskId);
  const setPanelCollapsed = useStore((state) => state.setPanelCollapsed);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [activeTask, setActiveTask] = useState<Task | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const task = tasks.find((t) => t.id === event.active.id);
    if (task) {
      setActiveTask(task);
    }
  }, [tasks]);

  const handleDragOver = useCallback((_event: DragOverEvent) => {
    // Could add visual feedback here
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);

    if (!over) return;

    const taskId = active.id as string;
    const overId = over.id as string;

    // Check if dropped on a column
    const isColumn = columns.some((c) => c.id === overId);
    if (isColumn) {
      moveTask(taskId, overId as TaskStatus);
      return;
    }

    // Dropped on another task - find its column
    const overTask = tasks.find((t) => t.id === overId);
    if (overTask && overTask.id !== taskId) {
      moveTask(taskId, overTask.status);
    }
  }, [moveTask, tasks]);

  const handleTaskClick = useCallback((taskId: string) => {
    setSelectedTaskId(taskId);
    setPanelCollapsed(false);
    const task = tasks.find((t) => t.id === taskId);
    if (task) {
      setEditingTask(task);
      setIsModalOpen(true);
    }
  }, [setSelectedTaskId, setPanelCollapsed, tasks]);

  const handleAddTask = useCallback((status: TaskStatus = 'inbox') => {
    setEditingTask(null);
    setIsModalOpen(true);
    // Pre-set the status for new tasks
    setTimeout(() => {
      const statusSelect = document.querySelector('select[value="inbox"]') as HTMLSelectElement;
      if (statusSelect) {
        statusSelect.value = status;
      }
    }, 0);
  }, []);

  const handleSaveTask = useCallback((taskData: Partial<Task> & { title: string }) => {
    if (editingTask) {
      updateTask(editingTask.id, taskData);
    } else {
      createTask(taskData.title, taskData);
    }
    setEditingTask(null);
  }, [editingTask, createTask, updateTask]);

  const handleDeleteTask = useCallback(() => {
    if (editingTask) {
      deleteTask(editingTask.id);
      setEditingTask(null);
      setIsModalOpen(false);
      setSelectedTaskId(null);
    }
  }, [editingTask, deleteTask, setSelectedTaskId]);

  return (
    <div className="h-full p-4">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 h-full overflow-x-auto">
          {columns.map((column) => (
            <Column
              key={column.id}
              id={column.id}
              title={column.title}
              tasks={getTasksByStatus(column.id)}
              onTaskClick={handleTaskClick}
              onAddTask={column.id === 'inbox' ? () => handleAddTask('inbox') : undefined}
            />
          ))}
        </div>

        <DragOverlay>
          {activeTask && (
            <div className="opacity-80">
              <TaskCard task={activeTask} onClick={() => {}} />
            </div>
          )}
        </DragOverlay>
      </DndContext>

      <TaskModal
        task={editingTask}
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingTask(null);
        }}
        onSave={handleSaveTask}
        onDelete={editingTask ? handleDeleteTask : undefined}
      />
    </div>
  );
}

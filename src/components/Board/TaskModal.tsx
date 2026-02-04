import { useState, useEffect } from 'react';
import type { Task, Pipeline, Priority, TaskStatus } from '../../types';
import { useAgents } from '../../hooks';

interface TaskModalProps {
  task?: Task | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (task: Partial<Task> & { title: string }) => void;
  onDelete?: () => void;
}

export function TaskModal({ task, isOpen, onClose, onSave, onDelete }: TaskModalProps) {
  const { agents } = useAgents();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<TaskStatus>('inbox');
  const [pipeline, setPipeline] = useState<Pipeline>('general');
  const [priority, setPriority] = useState<Priority>('medium');
  const [assignedTo, setAssignedTo] = useState<string>('');
  const [tags, setTags] = useState('');

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description || '');
      setStatus(task.status);
      setPipeline(task.pipeline);
      setPriority(task.priority || 'medium');
      setAssignedTo(task.assignedTo || '');
      setTags(task.tags.join(', '));
    } else {
      setTitle('');
      setDescription('');
      setStatus('inbox');
      setPipeline('general');
      setPriority('medium');
      setAssignedTo('');
      setTags('');
    }
  }, [task, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    onSave({
      title: title.trim(),
      description: description.trim() || undefined,
      status,
      pipeline,
      priority,
      assignedTo: assignedTo || undefined,
      tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-card-bg border border-border-color rounded-lg w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <form onSubmit={handleSubmit}>
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border-color">
            <h2 className="text-lg font-medium text-text-primary">
              {task ? 'Edit Task' : 'New Task'}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="p-1 hover:bg-board-bg rounded transition-colors"
            >
              <svg className="w-5 h-5 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Body */}
          <div className="p-4 space-y-4">
            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">
                Title *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-board-bg border border-border-color rounded px-3 py-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                placeholder="Task title"
                autoFocus
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full bg-board-bg border border-border-color rounded px-3 py-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-accent resize-none"
                placeholder="Task description (markdown supported)"
              />
            </div>

            {/* Status & Pipeline */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">
                  Status
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as TaskStatus)}
                  className="w-full bg-board-bg border border-border-color rounded px-3 py-2 text-text-primary"
                >
                  <option value="inbox">Inbox</option>
                  <option value="active">Active</option>
                  <option value="review">Review</option>
                  <option value="done">Done</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">
                  Pipeline
                </label>
                <select
                  value={pipeline}
                  onChange={(e) => setPipeline(e.target.value as Pipeline)}
                  className="w-full bg-board-bg border border-border-color rounded px-3 py-2 text-text-primary"
                >
                  <option value="general">General</option>
                  <option value="advisory">Advisory</option>
                  <option value="content">Content</option>
                  <option value="email">Email</option>
                </select>
              </div>
            </div>

            {/* Priority & Assigned To */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">
                  Priority
                </label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as Priority)}
                  className="w-full bg-board-bg border border-border-color rounded px-3 py-2 text-text-primary"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">
                  Assigned To
                </label>
                <select
                  value={assignedTo}
                  onChange={(e) => setAssignedTo(e.target.value)}
                  className="w-full bg-board-bg border border-border-color rounded px-3 py-2 text-text-primary"
                >
                  <option value="">Unassigned</option>
                  {agents.map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      {agent.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Tags */}
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">
                Tags
              </label>
              <input
                type="text"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                className="w-full bg-board-bg border border-border-color rounded px-3 py-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                placeholder="Comma-separated tags"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between p-4 border-t border-border-color">
            <div>
              {task && onDelete && (
                <button
                  type="button"
                  onClick={onDelete}
                  className="px-3 py-2 text-sm text-red-500 hover:bg-red-500/10 rounded transition-colors"
                >
                  Delete
                </button>
              )}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm text-text-secondary hover:bg-board-bg rounded transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-sm bg-accent hover:bg-accent-hover text-white rounded transition-colors"
              >
                {task ? 'Save' : 'Create'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

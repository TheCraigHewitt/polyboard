import { useState, useEffect, useCallback } from 'react';
import type { Task, Agent, Pipeline, Priority, TaskStatus } from '../../types';
import { useAgents } from '../../hooks';
import { MentionTextarea } from './MentionTextarea';

interface TaskModalProps {
  task?: Task | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (task: Partial<Task> & { title: string }) => void;
  onDelete?: () => void;
  onAddNote?: (content: string, mentions: string[]) => void;
}

function extractMentions(content: string, agents: Agent[]): string[] {
  const mentions: string[] = [];
  for (const agent of agents) {
    if (content.includes(`@${agent.name}`)) {
      mentions.push(agent.id);
    }
  }
  return mentions;
}

function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffSec = Math.floor((now - then) / 1000);
  if (diffSec < 60) return 'just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

function renderNoteContent(content: string, agents: Agent[]) {
  const agentNames = agents.map((a) => a.name).sort((a, b) => b.length - a.length);
  const pattern = agentNames.length > 0
    ? new RegExp(`(@(?:${agentNames.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')}))`, 'g')
    : null;

  if (!pattern) return <span>{content}</span>;

  const parts = content.split(pattern);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith('@') && agentNames.some((n) => part === `@${n}`)
          ? <span key={i} className="text-accent font-medium">{part}</span>
          : <span key={i}>{part}</span>
      )}
    </>
  );
}

export function TaskModal({ task, isOpen, onClose, onSave, onDelete, onAddNote }: TaskModalProps) {
  const { agents } = useAgents();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<TaskStatus>('inbox');
  const [pipeline, setPipeline] = useState<Pipeline>('general');
  const [priority, setPriority] = useState<Priority>('medium');
  const [assignedTo, setAssignedTo] = useState<string>('');
  const [tags, setTags] = useState('');
  const [noteContent, setNoteContent] = useState('');

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
    setNoteContent('');
  }, [task, isOpen]);

  const handleAddNote = useCallback(() => {
    if (!noteContent.trim() || !onAddNote) return;
    const mentions = extractMentions(noteContent, agents);
    onAddNote(noteContent.trim(), mentions);
    setNoteContent('');
  }, [noteContent, onAddNote, agents]);

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

          {/* Comments */}
          {task && onAddNote && (
            <div className="px-4 pb-4 space-y-3">
              <div className="border-t border-border-color pt-4">
                <h3 className="text-sm font-medium text-text-secondary mb-3">
                  Comments ({task.notes.length})
                </h3>

                {task.notes.length > 0 && (
                  <div className="space-y-3 max-h-60 overflow-y-auto mb-3">
                    {[...task.notes].reverse().map((note) => {
                      const author = note.authorId === 'human'
                        ? null
                        : agents.find((a) => a.id === note.authorId);
                      const authorName = note.authorId === 'human'
                        ? 'You'
                        : author?.name || note.authorId;
                      const authorInitial = note.authorId === 'human'
                        ? 'Y'
                        : (author?.name || note.authorId).charAt(0).toUpperCase();

                      return (
                        <div key={note.id} className="flex gap-2">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-xs shrink-0 ${
                            note.authorId === 'human' ? 'bg-text-secondary' : 'bg-accent'
                          }`}>
                            {authorInitial}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-medium text-text-primary">{authorName}</span>
                              <span className="text-xs text-text-secondary">{formatRelativeTime(note.createdAt)}</span>
                            </div>
                            <p className="text-sm text-text-secondary mt-0.5 break-words">
                              {renderNoteContent(note.content, agents)}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="flex gap-2">
                  <div className="flex-1">
                    <MentionTextarea
                      value={noteContent}
                      onChange={setNoteContent}
                      onSubmit={handleAddNote}
                      placeholder="Add a comment... (use @ to mention agents)"
                      agents={agents}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleAddNote}
                    disabled={!noteContent.trim()}
                    className="self-start px-3 py-2 text-sm bg-accent hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed text-white rounded transition-colors"
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>
          )}

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

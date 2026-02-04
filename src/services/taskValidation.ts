import type { Task, TaskNote, TasksFile, TaskStatus, Pipeline, Priority } from '../types';

const taskStatuses = new Set<TaskStatus>(['inbox', 'active', 'review', 'done']);
const pipelines = new Set<Pipeline>(['advisory', 'content', 'email', 'general']);
const priorities = new Set<Priority>(['low', 'medium', 'high', 'urgent']);

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function normalizeTaskNote(input: unknown): TaskNote | null {
  if (!input || typeof input !== 'object') return null;
  const note = input as Record<string, unknown>;
  if (!isString(note.id)) return null;
  if (!isString(note.authorId)) return null;
  if (!isString(note.content)) return null;
  if (!isString(note.createdAt)) return null;
  return {
    id: note.id,
    authorId: note.authorId,
    content: note.content,
    createdAt: note.createdAt,
  };
}

function isTaskStatus(value: unknown): value is TaskStatus {
  return isString(value) && taskStatuses.has(value as TaskStatus);
}

function isPipeline(value: unknown): value is Pipeline {
  return isString(value) && pipelines.has(value as Pipeline);
}

function isPriority(value: unknown): value is Priority {
  return isString(value) && priorities.has(value as Priority);
}

export function normalizeTask(input: unknown, strict = false): Task | null {
  if (!input || typeof input !== 'object') return null;
  const task = input as Record<string, unknown>;
  const now = new Date().toISOString();

  if (!isString(task.id)) return null;
  if (!isString(task.title)) return null;
  if (!isTaskStatus(task.status)) return null;
  if (!isPipeline(task.pipeline)) return null;

  const createdBy = isString(task.createdBy) ? task.createdBy : (strict ? null : 'unknown');
  if (strict && !createdBy) return null;

  const createdAt = isString(task.createdAt) ? task.createdAt : (strict ? null : now);
  if (strict && !createdAt) return null;

  const updatedAt = isString(task.updatedAt) ? task.updatedAt : (strict ? null : now);
  if (strict && !updatedAt) return null;

  const description = isString(task.description) && task.description.trim() ? task.description : undefined;
  const assignedTo = isString(task.assignedTo) && task.assignedTo.trim() ? task.assignedTo : undefined;
  const priority = isPriority(task.priority) ? task.priority : undefined;
  const tags = Array.isArray(task.tags) ? task.tags.filter(isString) : [];
  const notes = Array.isArray(task.notes)
    ? task.notes.map(normalizeTaskNote).filter((note): note is TaskNote => Boolean(note))
    : [];

  return {
    id: task.id,
    title: task.title,
    description,
    status: task.status,
    assignedTo,
    createdBy,
    pipeline: task.pipeline,
    priority,
    tags,
    notes,
    createdAt,
    updatedAt,
  };
}

export function normalizeTasksFile(input: unknown): TasksFile {
  const now = new Date().toISOString();
  if (!input || typeof input !== 'object') {
    return { version: 1, tasks: [], updatedAt: now };
  }
  const data = input as Record<string, unknown>;
  const version = typeof data.version === 'number' && Number.isFinite(data.version) ? data.version : 1;
  const updatedAt = isString(data.updatedAt) ? data.updatedAt : now;
  const tasksArray = Array.isArray(data.tasks) ? data.tasks : [];
  const tasks = tasksArray
    .map((task) => normalizeTask(task, false))
    .filter((task): task is Task => Boolean(task));

  return { version, tasks, updatedAt };
}

export function normalizeTasksPayload(input: unknown): Task[] | null {
  if (!Array.isArray(input)) return null;
  const tasks: Task[] = [];
  for (const item of input) {
    const normalized = normalizeTask(item, true);
    if (!normalized) {
      return null;
    }
    tasks.push(normalized);
  }
  return tasks;
}

import { useEffect, useCallback, useRef } from 'react';
import { useStore } from '../store';
import type { Task, TaskStatus } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { apiFetch } from '../services/api';

const DEBOUNCE_DELAY = 500;

export function useTasks() {
  const tasks = useStore((state) => state.tasks);
  const setTasks = useStore((state) => state.setTasks);
  const addTaskToStore = useStore((state) => state.addTask);
  const updateTaskInStore = useStore((state) => state.updateTask);
  const deleteTaskFromStore = useStore((state) => state.deleteTask);
  const moveTaskInStore = useStore((state) => state.moveTask);
  const filterPipeline = useStore((state) => state.filterPipeline);
  const filterAgent = useStore((state) => state.filterAgent);

  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSaveRef = useRef(false);
  const hasLoadedRef = useRef(false);
  const suppressSaveRef = useRef(false);
  const lastServerUpdatedAtRef = useRef<string | null>(null);

  // Load tasks on mount
  useEffect(() => {
    async function loadTasks() {
      try {
        const response = await apiFetch('/api/tasks');
        if (response.ok) {
          const data = await response.json();
          suppressSaveRef.current = true;
          setTasks(data.tasks || []);
          lastServerUpdatedAtRef.current = data.updatedAt || null;
        }
      } catch (err) {
        console.error('Failed to load tasks:', err);
      } finally {
        hasLoadedRef.current = true;
      }
    }
    loadTasks();
  }, [setTasks]);

  // Debounced save
  const saveTasks = useCallback(async (tasksToSave: Task[]) => {
    try {
      if (!lastServerUpdatedAtRef.current) {
        try {
          const res = await apiFetch('/api/tasks');
          if (res.ok) {
            const data = await res.json();
            lastServerUpdatedAtRef.current = data.updatedAt || null;
          }
        } catch {
          // Ignore refresh failure
        }
      }

      const baseUpdatedAt = lastServerUpdatedAtRef.current;
      if (!baseUpdatedAt) {
        pendingSaveRef.current = false;
        console.error('Missing baseUpdatedAt, aborting save');
        return;
      }

      const response = await apiFetch('/api/tasks', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tasks: tasksToSave, baseUpdatedAt }),
      });
      if (response.status === 409) {
        const data = await response.json();
        if (data?.current?.tasks) {
          suppressSaveRef.current = true;
          setTasks(data.current.tasks);
          lastServerUpdatedAtRef.current = data.current.updatedAt || null;
        }
        pendingSaveRef.current = false;
        console.warn('Tasks conflict detected. Reloaded latest tasks.');
        return;
      }
      if (response.status === 428) {
        pendingSaveRef.current = false;
        console.error('Server requires baseUpdatedAt for saving tasks.');
        return;
      }
      if (!response.ok) {
        throw new Error('Failed to save tasks');
      }
      const data = await response.json();
      lastServerUpdatedAtRef.current = data.updatedAt || lastServerUpdatedAtRef.current;
      pendingSaveRef.current = false;
    } catch (err) {
      console.error('Failed to save tasks:', err);
    }
  }, [setTasks]);

  const debouncedSave = useCallback((tasksToSave: Task[]) => {
    pendingSaveRef.current = true;
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => {
      saveTasks(tasksToSave);
    }, DEBOUNCE_DELAY);
  }, [saveTasks]);

  // Save when tasks change
  useEffect(() => {
    if (!hasLoadedRef.current) {
      return;
    }
    if (suppressSaveRef.current) {
      suppressSaveRef.current = false;
      return;
    }
    debouncedSave(tasks);
  }, [tasks, debouncedSave]);

  const createTask = useCallback((
    title: string,
    options: Partial<Omit<Task, 'id' | 'title' | 'createdAt' | 'updatedAt'>> = {}
  ): Task => {
    const now = new Date().toISOString();
    const task: Task = {
      id: uuidv4(),
      title,
      status: 'inbox',
      createdBy: 'human',
      pipeline: 'general',
      tags: [],
      notes: [],
      createdAt: now,
      updatedAt: now,
      ...options,
    };
    addTaskToStore(task);
    return task;
  }, [addTaskToStore]);

  const updateTask = useCallback((taskId: string, updates: Partial<Task>) => {
    updateTaskInStore(taskId, updates);
  }, [updateTaskInStore]);

  const deleteTask = useCallback((taskId: string) => {
    deleteTaskFromStore(taskId);
  }, [deleteTaskFromStore]);

  const moveTask = useCallback((taskId: string, newStatus: TaskStatus) => {
    moveTaskInStore(taskId, newStatus);
  }, [moveTaskInStore]);

  // Filtered tasks
  const filteredTasks = tasks.filter((task) => {
    if (filterPipeline !== 'all' && task.pipeline !== filterPipeline) {
      return false;
    }
    if (filterAgent !== 'all' && task.assignedTo !== filterAgent) {
      return false;
    }
    return true;
  });

  const getTasksByStatus = useCallback((status: TaskStatus) => {
    return filteredTasks.filter((t) => t.status === status);
  }, [filteredTasks]);

  return {
    tasks: filteredTasks,
    allTasks: tasks,
    createTask,
    updateTask,
    deleteTask,
    moveTask,
    getTasksByStatus,
  };
}

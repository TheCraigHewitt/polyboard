import { useEffect, useCallback, useRef } from 'react';
import { useStore } from '../store';
import type { Task, TaskStatus } from '../types';
import { v4 as uuidv4 } from 'uuid';

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

  // Load tasks on mount
  useEffect(() => {
    async function loadTasks() {
      try {
        const response = await fetch('/api/tasks');
        if (response.ok) {
          const data = await response.json();
          setTasks(data.tasks || []);
        }
      } catch (err) {
        console.error('Failed to load tasks:', err);
      }
    }
    loadTasks();
  }, [setTasks]);

  // Debounced save
  const saveTasks = useCallback(async (tasksToSave: Task[]) => {
    try {
      const response = await fetch('/api/tasks', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tasks: tasksToSave }),
      });
      if (!response.ok) {
        throw new Error('Failed to save tasks');
      }
      pendingSaveRef.current = false;
    } catch (err) {
      console.error('Failed to save tasks:', err);
    }
  }, []);

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
    if (tasks.length > 0) {
      debouncedSave(tasks);
    }
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
